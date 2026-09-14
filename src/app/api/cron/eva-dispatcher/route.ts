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
import { cronAuthError } from "@/lib/cron-auth";
import { Resend } from "resend";
import { getAllUsers, updateScheduledEmail, updateWelcomeSend } from "@/lib/store";
import { kvTryLock, kvUnlock } from "@/lib/supabase";

const MAX_ATTEMPTS = 5; // reintentos máximos antes de darlo por perdido
// Cuánto se reserva una campaña mientras se está mandando. Más que lo que tarda
// una pasada, menos que el hueco entre pasadas.
const LOCK_CAMPANA_MS = 10 * 60_000;

function fillVars(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

export async function GET(req: Request) {
  const authErr = cronAuthError(req);
  if (authErr) return authErr;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No Resend key" }, { status: 200 });
  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM || "Eva (AI-Team) <eva@aiteam.marketing>";

  const users = await getAllUsers();
  const now = Date.now();
  let scheduledSent = 0;
  let welcomeSent = 0;
  let failed = 0;
  let inciertos = 0; // envíos que quizá salieron y no se pudieron confirmar

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

      // UNA PASADA CADA VEZ POR CAMPAÑA.
      //
      // Este cron lo disparan Vercel y n8n, y dos pasadas que se solapan leen
      // las dos la misma lista de "ya enviados" (vacía) y mandan las dos: la
      // lista por destinatario no sirve de nada si nadie serializa las pasadas.
      // Si otra pasada la tiene cogida, esta se la salta y la coge la siguiente.
      const lockCampana = `lock:eva-campana:${userEmail}:${s.id}`;
      if (!(await kvTryLock(lockCampana, LOCK_CAMPANA_MS, "eva-dispatcher"))) {
        console.log(`[eva-dispatcher] campaña ${s.id} en manos de otra pasada; se salta`);
        continue;
      }
      try {

      // A quién ya se le mandó en pasadas anteriores. Un reintento CONTINÚA por
      // donde se quedó; no vuelve a empezar por el primero.
      const yaEnviados = new Set(s.enviados ?? []);
      // Y a quién se EMPEZÓ a mandar sin llegar a confirmarlo: puede que lo
      // recibiera (Resend aceptó y falló el guardado justo después). No se
      // reenvía; se cuenta aparte para que alguien lo mire.
      const intentados = new Set(s.intentados ?? []);
      const dudosos = [...intentados].filter((r) => !yaEnviados.has(r) && recipients.includes(r));
      if (dudosos.length) {
        console.warn(
          `[eva-dispatcher] campaña ${s.id}: ${dudosos.length} destinatario(s) DUDOSOS ` +
            `(se empezó a mandar y no se confirmó; NO se reenvían): ${dudosos.join(", ")}`,
        );
        inciertos += dudosos.length;
      }
      const pendientes = recipients.filter((r) => !yaEnviados.has(r) && !intentados.has(r));

      if (pendientes.length === 0) {
        // Todos recibidos en pasadas anteriores: la campaña está hecha aunque
        // en su día quedara marcada como fallida.
        await updateScheduledEmail(userEmail, s.id, { status: "sent", sentAt: new Date().toISOString() });
        scheduledSent++;
        continue; // el `finally` suelta el candado
      }

      try {
        for (const r of pendientes) {
          const cName = user.contacts?.find((c) => c.email === r)?.name || "";
          // APUNTAR ANTES DE MANDAR. Si esto falla, se corta la campaña sin
          // haber enviado nada: mejor un correo de menos que uno repetido.
          intentados.add(r);
          try {
            await updateScheduledEmail(userEmail, s.id, { intentados: [...intentados] });
          } catch (err) {
            console.error(
              `[eva-dispatcher] campaña ${s.id}: no se puede apuntar el envío a ${r}; ` +
                `se corta la campaña SIN mandarlo para no arriesgar duplicados.`,
              err,
            );
            break;
          }
          const res = await resend.emails.send({
            from,
            to: r,
            subject: fillVars(s.subject, { negocio, nombre: cName }),
            html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;padding:20px;white-space:pre-wrap">${fillVars(s.body, { negocio, nombre: cName }).replace(/\n/g, "<br>")}</div>`,
            replyTo: process.env.EVA_REPLY_TO || "cita@parse.aiteam.marketing",
          });
          // Resend NO lanza excepción ante errores de API: los devuelve en res.error.
          if (res.error) {
            // RECHAZO CONOCIDO: Resend dice que NO ha salido. Eso no es un
            // dudoso, es un no-enviado, así que se quita de la lista de
            // intentados para que el siguiente reintento vuelva a probar.
            // (Dudoso es solo aquel del que no sabemos si salió.)
            intentados.delete(r);
            try {
              await updateScheduledEmail(userEmail, s.id, { intentados: [...intentados] });
            } catch {
              /* si no se puede, el siguiente paso lo tratará como dudoso: nunca de más */
            }
            throw new Error(res.error.message || "Resend rechazó el envío");
          }
          // Se apunta AQUÍ, uno a uno y guardando cada vez. Guardar solo al
          // final del bucle dejaría la lista a medias si la función se corta
          // (tiempo agotado, despliegue en medio), que es exactamente el caso
          // en el que se producían los duplicados.
          yaEnviados.add(r);
          await updateScheduledEmail(userEmail, s.id, { enviados: [...yaEnviados] });
        }
        // Solo si TODOS los envíos fueron aceptados: marcar enviado.
        await updateScheduledEmail(userEmail, s.id, { status: "sent", sentAt: new Date().toISOString() });
        scheduledSent++;
      } catch (e) {
        // Rechazo/error → failed + 1 intento. Se reintentará hasta MAX_ATTEMPTS,
        // pero solo con los que falten: los ya aceptados quedan apuntados.
        await updateScheduledEmail(userEmail, s.id, {
          status: "failed",
          error: e instanceof Error ? e.message : "Error",
          attempts: attempts + 1,
          enviados: [...yaEnviados],
        });
        failed++;
      }
      } finally {
        await kvUnlock(lockCampana);
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

      const lockWelcome = `lock:eva-welcome:${userEmail}:${w.id}`;
      if (!(await kvTryLock(lockWelcome, LOCK_CAMPANA_MS, "eva-dispatcher"))) {
        console.log(`[eva-dispatcher] bienvenida ${w.id} en manos de otra pasada; se salta`);
        continue;
      }
      // Un envío que se empezó y no se confirmó puede haber salido: no se
      // repite. Se marca para que alguien lo revise.
      if (w.intentadoEn && w.status !== "sent") {
        console.warn(`[eva-dispatcher] bienvenida ${w.id} DUDOSA (se empezó el ${w.intentadoEn} y no se confirmó); no se reenvía`);
        inciertos++;
        await kvUnlock(lockWelcome);
        continue;
      }

      try {
        // Apuntar antes de mandar, igual que en las campañas.
        await updateWelcomeSend(userEmail, w.id, { intentadoEn: new Date().toISOString() });
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
      } finally {
        await kvUnlock(lockWelcome);
      }
    }
  }

  return NextResponse.json({ scheduledSent, welcomeSent, failed, inciertos });
}
