/**
 * Cron diario 07:00 — Lucía manda email con el resumen IA de Gmail al jefe.
 *
 * Solo para usuarios que tengan Gmail conectado.
 */

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getAllUsers } from "@/lib/store";
import { fetchInbox } from "@/lib/gmail";
import { anthropic } from "@/lib/claude";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET;
  if (expected && !auth.includes(expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await getAllUsers();
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Lucía (AI-Team) <lucia@aiteam.marketing>";
  if (!apiKey) return NextResponse.json({ error: "No Resend key" });
  const resend = new Resend(apiKey);

  // En prod necesitamos URL del sitio. Hardcoded fallback.
  const baseUrl = process.env.PUBLIC_URL || "https://aiteam.marketing";
  const redirect = `${baseUrl}/api/lucia/callback`;

  let sent = 0;
  let skipped = 0;

  for (const [email, user] of Object.entries(users)) {
    if (!user.gmailTokens || !user.business) {
      skipped++;
      continue;
    }
    try {
      const inbox = await fetchInbox(email, redirect, 20);
      if (!inbox || inbox.messages.length === 0) {
        skipped++;
        continue;
      }
      const lines = inbox.messages.map((m, i) =>
        `${i + 1}. [${m.unread ? "NO LEÍDO" : "leído"}] DE: ${m.from} | ASUNTO: ${m.subject} | ${m.snippet}`
      ).join("\n");

      const ai = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: `Eres Lucía, asistente ejecutiva. Genera el resumen matutino de la bandeja del jefe. Negocio: ${user.business.nombre} — ${user.business.sector}. Devuelve markdown con secciones: 🔴 Urgente / 🟡 Importantes / 🟢 Promociones / 📋 3 acciones recomendadas. Sé conciso, directo, español de España.`,
        messages: [{ role: "user", content: `Mis 20 últimos correos:\n\n${lines}` }],
      });
      const summary = ai.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n");

      await resend.emails.send({
        from,
        to: email,
        subject: `☕ Lucía — Tu resumen del ${new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}`,
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:auto;padding:24px">
          <h1 style="font-family:Impact,Arial,sans-serif;font-size:32px;color:#C8202A;text-transform:uppercase;margin:0 0 4px">Buenos días, jefe</h1>
          <p style="margin:0 0 24px;color:#666">Tu bandeja a las 7:00 — leída por Lucía</p>
          <div style="background:#FAF8F3;border:3px solid #000;padding:20px;font-size:14px;line-height:1.6;white-space:pre-wrap">${summary
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/^## (.+)$/gm, '<h2 style="font-family:Impact,sans-serif;font-size:20px;margin:16px 0 8px">$1</h2>')
            .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
            .replace(/^- (.+)$/gm, '<li style="margin:4px 0">$1</li>')
            .replace(/(<li[\s\S]+?<\/li>)/g, "<ul>$1</ul>")
          }</div>
          <p style="margin-top:24px;font-size:13px;color:#666">
            Acción rápida: <a href="${baseUrl}/dashboard/lucia" style="color:#C8202A;font-weight:bold">Abrir Lucía →</a>
          </p>
        </div>`,
      });
      sent++;
    } catch (e) {
      console.error("Lucia daily summary failed for", email, e);
      skipped++;
    }
  }

  return NextResponse.json({ sent, skipped, total: Object.keys(users).length });
}
