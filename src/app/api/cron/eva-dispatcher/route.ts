/**
 * Cron — dispara emails programados y welcome series pendientes.
 *
 * Lee y persiste el estado en el store central (Supabase en prod, fichero en dev)
 * vía store.ts — NO en /tmp efímero.
 *
 * Política A ("nunca perder un email"):
 *  - Comprueba el resultado de Resend: si `res.error` (Resend rechaza), el ítem
 *    queda "failed" (NO "sent") y se REINTENTA en pasadas siguientes.
 *  - Tope `MAX_ATTEMPTS` para no reintentar en bucle un email imposible; al
 *    alcanzarlo, queda "failed" definitivo y se deja de intentar.
 *  - Un envío OK marca "sent" y nunca se reprocesa.
 *
 * Disparo recomendado cada ~15 min (vía n8n / cron externo).
 */

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getAllUsers, updateScheduledEmail, updateWelcomeSend } from "@/lib/store";

const MAX_ATTEMPTS = 5; // reintentos máximos antes de darlo por perdido

function fillVars(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET;
  if (expected && !auth.includes(expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No Resend key" }, { status: 200 });
  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM || "Eva (AI-Team) <eva@aiteam.marketing>";

  const users = await getAllUsers();
  const now = Date.now();
  let scheduledSent = 0;
  let welcomeSent = 0;
  let failed = 0;

  for (const [userEmail, user] of Object.entries(users)) {
    if (!user.business) continue;
    const negocio = user.business.nombre;

    // 1. Scheduled emails que les ha llegado el momento
    const sched = user.scheduledEmails ?? [];
    for (const s of sched) {
      const attempts = s.attempts ?? 0;
      // Procesa los pendientes y los "failed" que aún no agotaron reintentos.
      const retriable = s.status === "pending" || (s.status === "failed" && attempts < MAX_ATTEMPTS);
      if (!retriable) continue;
      if (new Date(s.scheduledFor).getTime() > now) continue;

      const recipients: string[] = s.to === "all"
        ? (user.contacts ?? []).map((c) => c.email)
        : [s.to];
      if (recipients.length === 0) {
        // Sin destinatarios no es reintentble: lo marcamos terminal.
        await updateScheduledEmail(userEmail, s.id, { status: "failed", error: "Sin destinatarios", attempts: MAX_ATTEMPTS });
        failed++;
        continue;
      }

      try {
        for (const r of recipients) {
          const cName = user.contacts?.find((c) => c.email === r)?.name || "";
          const res = await resend.emails.send({
            from,
            to: r,
            subject: fillVars(s.subject, { negocio, nombre: cName }),
            html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;padding:20px;white-space:pre-wrap">${fillVars(s.body, { negocio, nombre: cName }).replace(/\n/g, "<br>")}</div>`,
            replyTo: process.env.EVA_REPLY_TO || "cita@parse.aiteam.marketing",
          });
          // Resend NO lanza excepción ante errores de API: los devuelve en res.error.
          if (res.error) throw new Error(res.error.message || "Resend rechazó el envío");
        }
        // Solo si TODOS los envíos fueron aceptados: marcar enviado.
        await updateScheduledEmail(userEmail, s.id, { status: "sent", sentAt: new Date().toISOString() });
        scheduledSent++;
      } catch (e) {
        // Rechazo/error → failed + 1 intento. Se reintentará hasta MAX_ATTEMPTS.
        await updateScheduledEmail(userEmail, s.id, {
          status: "failed",
          error: e instanceof Error ? e.message : "Error",
          attempts: attempts + 1,
        });
        failed++;
      }
    }

    // 2. Welcome series pendientes
    const sends = user.welcomeSends ?? [];
    const series = user.welcomeSeries;
    for (const w of sends) {
      const attempts = w.attempts ?? 0;
      const retriable = w.status === "pending" || (w.status === "failed" && attempts < MAX_ATTEMPTS);
      if (!retriable) continue;
      if (new Date(w.sendAt).getTime() > now) continue;
      if (!series || !series.enabled || !series.emails[w.stepIndex]) {
        await updateWelcomeSend(userEmail, w.id, { status: "cancelled" });
        continue;
      }

      try {
        const e = series.emails[w.stepIndex];
        const cName = user.contacts?.find((c) => c.email === w.contactEmail)?.name || "";
        const res = await resend.emails.send({
          from,
          to: w.contactEmail,
          subject: fillVars(e.subject, { negocio, nombre: cName }),
          html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;padding:20px;white-space:pre-wrap">${fillVars(e.body, { negocio, nombre: cName }).replace(/\n/g, "<br>")}</div>`,
          replyTo: process.env.EVA_REPLY_TO || "cita@parse.aiteam.marketing",
        });
        if (res.error) throw new Error(res.error.message || "Resend rechazó el envío");
        await updateWelcomeSend(userEmail, w.id, { status: "sent", sentAt: new Date().toISOString() });
        welcomeSent++;
      } catch (e) {
        await updateWelcomeSend(userEmail, w.id, {
          status: "failed",
          attempts: attempts + 1,
        });
        failed++;
        console.error("welcome send failed", e);
      }
    }
  }

  return NextResponse.json({ scheduledSent, welcomeSent, failed });
}
