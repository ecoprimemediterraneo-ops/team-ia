// =============================================================================
// FASE 4 — Informe completo del diagnóstico por email (vía Eva / Resend).
//
// Reutiliza la MISMA infraestructura de envío que el resto del proyecto
// (getResend + RESEND_FROM de src/lib/resend.ts). NO monta un cliente nuevo.
//
// A diferencia del adelanto en pantalla (Fase 3, solo semáforo + titular +
// €/mes), aquí va el DETALLE COMPLETO: cada frente desarrollado en formato
// PROBLEMA + SOLUCIÓN ("esto tienes flojo" → "esto hace el sistema por ti").
//
// Robustez:
//   - Si NO hay RESEND_API_KEY (p. ej. en local): no rompe; loguea que "se
//     habría enviado" y devuelve modo "log_local" para poder revisar el
//     contenido sin enviar.
//   - Si Resend devuelve error: se captura y se devuelve modo "error". Nunca
//     lanza: un fallo de correo no debe tirar la experiencia del cliente.
//
// Voz "el sistema": sin nombres de agente. CTA a /beta (no se tocan enlaces
// de cal.com).
// =============================================================================

import { getResend, EVA_REPLY_TO } from "./resend";
import type { DiagnosticoRecord, FrenteResultado, InformeEmailInfo, Semaforo, Check, EstadoCheck } from "./diagnostico";

const BETA_URL = "https://aiteam.marketing/beta";

const SEM = {
  rojo: { color: "#C8202A", text: "#ffffff", label: "MAL" },
  ambar: { color: "#F5C518", text: "#000000", label: "MEJORABLE" },
  verde: { color: "#16A34A", text: "#ffffff", label: "BIEN" },
} satisfies Record<Semaforo, { color: string; text: string; label: string }>;

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function eur(n: number): string {
  return n.toLocaleString("es-ES");
}

const CHECK_ICON: Record<EstadoCheck, string> = {
  ok: "✅",
  flojo: "🟡",
  falta: "❌",
  no_verificable: "🔒",
};

function lineaCheck(c: Check): string {
  const txt = `${esc(c.etiqueta)}${c.detalle ? ` <span style="color:#888">— ${esc(c.detalle)}</span>` : ""}`;
  const color = c.estado === "no_verificable" ? "#777" : "#333";
  return `<tr>
    <td style="width:22px;vertical-align:top;font-size:13px;padding:2px 0">${CHECK_ICON[c.estado]}</td>
    <td style="font-family:Arial,sans-serif;font-size:13px;line-height:1.45;color:${color};padding:2px 0">${txt}</td>
  </tr>`;
}

function bloqueFrente(f: FrenteResultado): string {
  const s = SEM[f.semaforo];
  const checks = (f.checks || []).map(lineaCheck).join("");
  return `
  <tr><td style="padding:0 0 14px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #000;border-collapse:separate">
      <tr>
        <td style="background:${s.color};color:${s.text};font-family:Arial,sans-serif;font-weight:bold;font-size:13px;letter-spacing:.06em;padding:8px 14px;text-transform:uppercase">
          ${esc(f.titulo)} · ${s.label}
        </td>
      </tr>
      <tr><td style="padding:14px 16px;background:#ffffff">
        <div style="font-family:Arial,sans-serif;font-weight:bold;font-size:16px;color:#0c0c0c;margin:0 0 10px 0">${esc(f.titular)}</div>
        ${checks ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px 0">${checks}</table>` : ""}
        <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#333;margin:0 0 8px 0">
          <span style="color:#C8202A;font-weight:bold">Lo que tienes flojo:</span> ${esc(f.problema)}
        </div>
        <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#333">
          <span style="color:#C8202A;font-weight:bold">Lo que hace el sistema:</span> ${esc(f.solucion)}
        </div>
      </td></tr>
    </table>
  </td></tr>`;
}

function bloqueHonestidad(record: DiagnosticoRecord): string {
  const h = record.resultado.honestidad;
  if (!h || (!h.auditado.length && !h.conectar.length)) return "";
  const lista = (items: string[], color: string) =>
    items.map((i) => `<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:${color};padding:1px 0">· ${esc(i)}</div>`).join("");
  return `
  <tr><td style="padding:6px 0 14px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #000">
      <tr><td style="background:#000;color:#F5C518;font-family:Arial,sans-serif;font-weight:bold;font-size:13px;letter-spacing:.06em;padding:8px 14px;text-transform:uppercase">
        Qué hemos podido auditar desde fuera
      </td></tr>
      <tr><td style="padding:14px 16px;background:#fff">
        <div style="font-family:Arial,sans-serif;font-weight:bold;font-size:13px;color:#16A34A;margin-bottom:4px">✓ Auditado desde fuera</div>
        ${lista(h.auditado, "#333") || '<div style="font-size:13px;color:#888">—</div>'}
        <div style="font-family:Arial,sans-serif;font-weight:bold;font-size:13px;color:#0c0c0c;margin:14px 0 4px">🔒 Para auditar a fondo, conecta tus cuentas</div>
        ${lista(h.conectar, "#777") || '<div style="font-size:13px;color:#888">—</div>'}
        <div style="font-family:Arial,sans-serif;font-size:12px;color:#888;margin-top:10px;line-height:1.5">Estos puntos no se pueden leer desde fuera con certeza: requieren conectar tus cuentas (Instagram, Google, WhatsApp). En la demo te enseñamos cómo y el sistema audita el resto en profundidad.</div>
      </td></tr>
    </table>
  </td></tr>`;
}

export function construirInformeEmail(record: DiagnosticoRecord): { subject: string; html: string } {
  const r = record.resultado;
  const nombre = record.nombre?.trim() || "tu negocio";
  const subject = `Tu diagnóstico completo · ${nombre}`.slice(0, 90);

  const desglose = r.dinero.desglose
    .filter((d) => d.eur > 0)
    .map(
      (d) =>
        `<tr><td style="font-family:Arial,sans-serif;font-size:13px;color:#444;padding:2px 0">· ${esc(d.concepto)}</td>
         <td style="font-family:Arial,sans-serif;font-size:13px;color:#444;text-align:right;white-space:nowrap;padding:2px 0">${eur(d.eur)} €</td></tr>`,
    )
    .join("");

  const frentes = r.frentes.map(bloqueFrente).join("");

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF8F3">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F3">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%">

        <!-- Cabecera -->
        <tr><td style="background:#000;padding:18px 20px">
          <div style="font-family:Arial,sans-serif;color:#F5C518;font-weight:bold;font-size:12px;letter-spacing:.18em;text-transform:uppercase">Diagnóstico digital · AI-Team</div>
        </td></tr>

        <!-- Saludo + titular -->
        <tr><td style="background:#fff;border:2px solid #000;border-top:none;padding:24px 20px">
          <div style="font-family:Arial,sans-serif;font-size:15px;color:#0c0c0c;margin:0 0 6px 0">Hola, aquí tienes el diagnóstico completo de <b>${esc(nombre)}</b>.</div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2;font-weight:bold;color:#0c0c0c;margin:10px 0 0 0">${esc(r.resumenTitular)}</div>
        </td></tr>

        <!-- Número estrella -->
        <tr><td style="background:#000;padding:24px 20px;text-align:center">
          <div style="font-family:Arial,sans-serif;font-size:13px;color:#ffffff;opacity:.7;text-transform:uppercase;letter-spacing:.08em">Estás perdiendo aproximadamente</div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:46px;font-weight:bold;color:#F5C518;line-height:1.1;margin:6px 0 0 0">~${eur(r.dinero.totalMesEUR)} €/mes</div>
          <div style="font-family:Arial,sans-serif;font-size:14px;color:#ffffff;opacity:.65;margin-top:4px">≈ ${eur(r.dinero.totalAnioEUR)} €/año</div>
        </td></tr>

        <!-- Explicación + desglose -->
        <tr><td style="background:#fff;border:2px solid #000;border-top:none;padding:18px 20px">
          <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.55;color:#555;margin:0 0 12px 0">${esc(r.dinero.explicacion)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${desglose}</table>
        </td></tr>

        <!-- Separador -->
        <tr><td style="padding:22px 0 10px 0">
          <div style="font-family:Arial,sans-serif;font-size:18px;font-weight:bold;color:#0c0c0c">Los 5 frentes, al detalle</div>
          <div style="font-family:Arial,sans-serif;font-size:13px;color:#666;margin-top:2px">Cada punto auditado, qué tienes flojo y qué hace el sistema por ti.</div>
        </td></tr>

        <!-- Frentes -->
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${frentes}</table>
        </td></tr>

        <!-- Honestidad: auditado vs conéctalo -->
        ${bloqueHonestidad(record)}

        <!-- CTA -->
        <tr><td style="background:#F5C518;border:3px solid #000;padding:24px 20px;text-align:center">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:#0c0c0c;margin:0 0 6px 0">¿Quieres que lo arreglemos por ti?</div>
          <div style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 16px 0">Te lo enseñamos funcionando con tu negocio en una demo de 15 minutos, sin compromiso.</div>
          <a href="${BETA_URL}" style="display:inline-block;background:#000;color:#F5C518;font-family:Arial,sans-serif;font-weight:bold;font-size:16px;text-decoration:none;text-transform:uppercase;letter-spacing:.06em;padding:14px 28px;border:2px solid #000">Pide tu demo →</a>
        </td></tr>

        <!-- Pie -->
        <tr><td style="padding:18px 20px;text-align:center">
          <div style="font-family:Arial,sans-serif;font-size:12px;color:#999;line-height:1.5">
            Diagnóstico generado por el sistema de AI-Team.<br>
            Enviado desde eva@aiteam.marketing · <a href="https://aiteam.marketing" style="color:#C8202A">aiteam.marketing</a>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html };
}

/**
 * Envía el informe completo. Nunca lanza: devuelve siempre un InformeEmailInfo
 * (enviado / log_local / error) para registrarlo en el lead.
 */
export async function enviarInformeDiagnostico(record: DiagnosticoRecord): Promise<InformeEmailInfo> {
  const at = new Date().toISOString();
  const to = record.email;
  const { subject, html } = construirInformeEmail(record);

  // Sin clave de Resend (p. ej. local): no enviamos, pero dejamos constancia.
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[diagnostico-email] (LOCAL / sin RESEND_API_KEY) SE HABRÍA ENVIADO el informe a ${to} · asunto: "${subject}" · ${html.length} bytes`,
    );
    return { intentado: true, enviado: false, modo: "log_local", to, subject, at };
  }

  try {
    const resend = getResend();
    // Reusa el remitente del proyecto (env). Fallback neutro a la dirección de
    // Eva sin personificar al agente, coherente con la voz "el sistema".
    const from = process.env.RESEND_FROM || "AI-Team <eva@aiteam.marketing>";
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      replyTo: EVA_REPLY_TO,
    });
    if (error) {
      console.error("[diagnostico-email] Resend devolvió error:", error);
      return { intentado: true, enviado: false, modo: "error", to, subject, error: String((error as { message?: string }).message || error), at };
    }
    return { intentado: true, enviado: true, modo: "resend", to, subject, id: data?.id, at };
  } catch (e) {
    console.error("[diagnostico-email] excepción al enviar:", e);
    return { intentado: true, enviado: false, modo: "error", to, subject, error: e instanceof Error ? e.message : "error", at };
  }
}
