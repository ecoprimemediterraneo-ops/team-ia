/**
 * Sergio · Sistema de alertas por email.
 * Alertas críticas inmediatas + digest diario de cambios altos.
 */
import { Resend } from "resend";
import type { Change } from "./sergio-db";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  return new Resend(key);
}

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
/** Si la source tiene owner_email, prefiérelo. Si no, cae al founder (legacy). */
function resolveRecipient(ownerEmail?: string | null): string {
  return ownerEmail || FOUNDER_EMAIL;
}
const FROM = process.env.RESEND_FROM || "Sergio (AI-Team) <eva@aiteam.marketing>";

function relevanceBadge(r: string) {
  const map: Record<string, string> = {
    critical: "background:#dc2626;color:white;padding:2px 8px;font-weight:bold",
    high: "background:#ea580c;color:white;padding:2px 8px;font-weight:bold",
    medium: "background:#ca8a04;color:white;padding:2px 8px;font-weight:bold",
    low: "background:#6b7280;color:white;padding:2px 8px;font-weight:bold",
  };
  return map[r] ?? map.low;
}

export async function sendCriticalAlert(change: Change, competitorName: string, ownerEmail?: string | null): Promise<void> {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: resolveRecipient(ownerEmail),
    subject: `🔴 SERGIO · ALERTA CRÍTICA: ${competitorName}`,
    html: `
<div style="font-family:monospace;max-width:600px;background:#000;color:#fff;padding:24px">
  <div style="color:#00ff41;font-size:11px;margin-bottom:8px">▶ SERGIO · UNIDAD DE RECONOCIMIENTO · ALERTA CRÍTICA</div>
  <h2 style="color:#fff;margin:0 0 16px">${competitorName}</h2>
  <div style="margin-bottom:12px">
    <span style="${relevanceBadge(change.relevance)}">${change.relevance.toUpperCase()}</span>
    <span style="color:#fff;opacity:0.5;font-size:12px;margin-left:12px">${change.change_type}</span>
  </div>
  <p style="color:#ccc;font-size:14px;line-height:1.6">${change.summary}</p>
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #333">
    <a href="https://aiteam.marketing/admin/sergio/cambios" style="background:#00ff41;color:#000;padding:10px 20px;font-weight:bold;text-decoration:none;display:inline-block;font-size:12px">
      → VER EN PANEL SERGIO
    </a>
  </div>
  <div style="color:#ffffff30;font-size:10px;margin-top:16px">
    Sergio · AI-Team · ${new Date().toLocaleString("es-ES")}
  </div>
</div>`,
  });
}

export async function sendDailyDigest(changes: Change[], competitorNames: Record<string, string>, ownerEmail?: string | null): Promise<void> {
  if (changes.length === 0) return;
  const resend = getResend();
  const to = resolveRecipient(ownerEmail);

  const rows = changes
    .map((c) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #222">
          <span style="${relevanceBadge(c.relevance)};font-size:10px">${c.relevance.toUpperCase()}</span>
        </td>
        <td style="padding:8px;border-bottom:1px solid #222;color:#00ff41;font-size:12px">
          ${competitorNames[c.source_id] ?? "—"}
        </td>
        <td style="padding:8px;border-bottom:1px solid #222;color:#ccc;font-size:12px">
          ${c.summary}
        </td>
      </tr>`)
    .join("");

  await resend.emails.send({
    from: FROM,
    to,
    subject: `🕵️ SERGIO · Digest diario — ${changes.length} cambios detectados`,
    html: `
<div style="font-family:monospace;max-width:700px;background:#000;color:#fff;padding:24px">
  <div style="color:#00ff41;font-size:11px;margin-bottom:8px">▶ SERGIO · DIGEST DIARIO · ${new Date().toLocaleDateString("es-ES")}</div>
  <h2 style="color:#fff;margin:0 0 16px">${changes.length} cambios detectados</h2>
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="color:#ffffff50;font-size:11px">
        <th style="padding:8px;text-align:left">NIVEL</th>
        <th style="padding:8px;text-align:left">COMPETIDOR</th>
        <th style="padding:8px;text-align:left">RESUMEN</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="margin-top:24px">
    <a href="https://aiteam.marketing/admin/sergio/cambios" style="background:#00ff41;color:#000;padding:10px 20px;font-weight:bold;text-decoration:none;display:inline-block;font-size:12px">
      → VER TODOS EN PANEL SERGIO
    </a>
  </div>
  <div style="color:#ffffff30;font-size:10px;margin-top:16px">Sergio · AI-Team · Misión cumplida.</div>
</div>`,
  });
}

export async function sendWeeklyReport(reportContent: string, highlights: string[], ownerEmail?: string | null): Promise<void> {
  const resend = getResend();
  const highlightHtml = highlights.map((h) => `<li style="color:#ccc;margin-bottom:6px">${h}</li>`).join("");

  await resend.emails.send({
    from: FROM,
    to: resolveRecipient(ownerEmail),
    subject: `🕵️ SERGIO · Informe semanal — ${new Date().toLocaleDateString("es-ES")}`,
    html: `
<div style="font-family:monospace;max-width:700px;background:#000;color:#fff;padding:24px">
  <div style="color:#00ff41;font-size:11px;margin-bottom:8px">▶ SERGIO · INFORME SEMANAL DE RECONOCIMIENTO</div>
  <h2 style="color:#fff;margin:0 0 16px">Inteligencia competitiva · Semana ${new Date().toLocaleDateString("es-ES")}</h2>
  <div style="background:#111;border:1px solid #00ff41;padding:16px;margin-bottom:20px">
    <div style="color:#00ff41;font-size:11px;margin-bottom:8px">TL;DR</div>
    <ul style="margin:0;padding-left:16px">${highlightHtml}</ul>
  </div>
  <div style="color:#ccc;font-size:13px;line-height:1.7;white-space:pre-wrap">${reportContent}</div>
  <div style="margin-top:24px">
    <a href="https://aiteam.marketing/admin/sergio/cambios" style="background:#00ff41;color:#000;padding:10px 20px;font-weight:bold;text-decoration:none;display:inline-block;font-size:12px">
      → VER PANEL SERGIO
    </a>
  </div>
  <div style="color:#ffffff30;font-size:10px;margin-top:16px">Sergio · AI-Team · Siguiente reconocimiento: lunes que viene.</div>
</div>`,
  });
}
