import { Resend } from "resend";

export function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY no configurada");
  return new Resend(key);
}

export const RESEND_FROM = process.env.RESEND_FROM || "AI-Team <onboarding@resend.dev>";

// Dirección a la que deben volver las respuestas de los clientes para que el
// inbound parser (SendGrid → /api/eva/inbound) las reciba. Configurable por env;
// default al subdominio de parse de SendGrid.
export const EVA_REPLY_TO = process.env.EVA_REPLY_TO || "cita@parse.aiteam.marketing";
