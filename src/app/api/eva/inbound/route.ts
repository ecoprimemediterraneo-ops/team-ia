// POST /api/eva/inbound — receptor de email ENTRANTE de Eva.
//
// Pensado para Cloudflare Email Routing (gratis): un Email Worker recibe el
// correo a *@aiteam.marketing, lo serializa y hace POST aquí con la cabecera
// `X-Eva-Secret`. Este endpoint:
//   1. Valida el secreto.
//   2. Parsea el email (remitente, asunto, cuerpo).
//   3. Detecta intención de cita y reserva vía ORQUESTADOR (tryAgendarFromText,
//      que ya pasa por reservarSlot → disponibilidad + lock + log).
//   4. Responde al cliente con un email de Eva (confirmación, alternativa o
//      petición de los datos que faltan).
//
// Por qué Cloudflare Email Routing y no SendGrid Inbound Parse:
//   - Gratis e ilimitado (SendGrid Inbound es de pago en volumen y pide
//     dedicar un subdominio MX). Cloudflare ya puede gestionar el DNS del
//     dominio; añadir Email Routing son 2 clics y un registro MX automático.
//   - El Worker da control total del payload (lo mandamos ya en JSON limpio),
//     así no dependemos del multipart raro del Inbound Parse.
//
// AUTH: header `X-Eva-Secret: <EVA_WEBHOOK_SECRET>` (mismo secreto que /cita).

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { tryAgendarFromText, formatStartHumanES } from "@/lib/appointment-intent";
import { getRedirectUri } from "@/lib/gmail";
import { getResend, RESEND_FROM } from "@/lib/resend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InboundPayload = {
  from?: string;        // email del remitente
  from_name?: string;   // nombre si el Worker lo extrae
  subject?: string;
  body?: string;        // texto plano del email
  text?: string;        // alias habitual
};

async function sendEvaReply(to: string, subject: string, text: string): Promise<void> {
  try {
    const resend = getResend();
    await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error("[eva/inbound] no se pudo enviar la respuesta de Eva:", err);
  }
}

export async function POST(req: Request) {
  const h = await headers();
  const expected = process.env.EVA_WEBHOOK_SECRET || "";
  const provided = h.get("x-eva-secret") || "";
  if (!expected) {
    return NextResponse.json({ ok: false, error: "EVA_WEBHOOK_SECRET no configurado." }, { status: 503 });
  }
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: "secret_mismatch" }, { status: 401 });
  }

  let body: InboundPayload;
  try {
    body = (await req.json()) as InboundPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const from = (body.from || "").trim();
  const texto = (body.body || body.text || "").trim();
  if (!from || !texto) {
    return NextResponse.json({ ok: false, error: "Faltan `from` y/o `body` del email." }, { status: 422 });
  }

  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = getRedirectUri(host, proto);

  // Intención + reserva orquestada. Inyectamos el asunto al cuerpo por si la
  // fecha/motivo viene en el asunto.
  const fullText = [body.subject ? `Asunto: ${body.subject}` : "", texto].filter(Boolean).join("\n");

  const ag = await tryAgendarFromText({
    text: fullText,
    agenteOrigen: "eva",
    redirectUri,
    customerNameFallback: body.from_name,
  });

  // Componer respuesta de Eva según el resultado.
  let replySubject = "Re: tu solicitud de cita";
  let replyText = "";
  switch (ag.kind) {
    case "agendada": {
      const cuando = formatStartHumanES(ag.intent.fields.startIso!);
      replySubject = "✅ Cita confirmada";
      replyText = `Hola${body.from_name ? ` ${body.from_name}` : ""},\n\nTu cita queda confirmada para ${cuando}. Si necesitas cambiarla, responde a este correo.\n\nUn saludo,\nEva — AI-Team`;
      break;
    }
    case "slot_taken": {
      const alt = ag.suggested ? formatStartHumanES(ag.suggested) : null;
      replySubject = "Necesitamos ajustar la hora de tu cita";
      replyText = alt
        ? `Hola${body.from_name ? ` ${body.from_name}` : ""},\n\nEsa franja está ocupada, pero tengo disponible ${alt}. ¿Te viene bien? Respóndeme y la confirmo.\n\nUn saludo,\nEva — AI-Team`
        : `Hola,\n\nEsa franja está ocupada y no me queda hueco ese día. ¿Me propones otro día/hora y te confirmo?\n\nUn saludo,\nEva — AI-Team`;
      break;
    }
    case "incomplete": {
      replySubject = "Una última cosa para tu cita";
      replyText = `Hola,\n\nPara cerrar tu cita necesito un dato más. ¿Me confirmas día, hora y motivo de la visita?\n\nUn saludo,\nEva — AI-Team`;
      break;
    }
    case "no_intent": {
      // No parecía una petición de cita: no respondemos automáticamente para
      // no generar ruido. Lo dejamos registrado para revisión manual.
      return NextResponse.json({ ok: true, handled: "no_intent" });
    }
    default: {
      replySubject = "Hemos recibido tu mensaje";
      replyText = `Hola,\n\nHe recibido tu mensaje y lo estamos revisando. Te confirmo enseguida.\n\nUn saludo,\nEva — AI-Team`;
    }
  }

  await sendEvaReply(from, replySubject, replyText);
  return NextResponse.json({ ok: true, kind: ag.kind });
}
