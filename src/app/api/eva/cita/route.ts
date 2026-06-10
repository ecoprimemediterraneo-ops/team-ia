// Endpoint de cita por email para Eva.
//
// Casos de uso:
//   A) Llega una respuesta de un cliente pidiendo cita por email.
//      Un servicio de inbound email (Postmark / SendGrid Inbound Parse /
//      Cloudflare Email Routing / etc.) postea aquí el correo crudo.
//   B) Un agente humano (o un test) postea ya los campos extraídos.
//
// AUTH:
//   - Header: `X-Eva-Secret: <EVA_WEBHOOK_SECRET>` (env var en Vercel).
//
// PAYLOAD aceptado (cualquier combinación):
//
//   // Texto libre del email — Eva extrae la intención con Haiku:
//   {
//     "from": "cliente@dominio.com",       // opcional, va a attendees
//     "from_name": "María García",         // opcional, nombre del cliente
//     "subject": "Re: limpieza dental",    // opcional, ayuda al contexto
//     "body": "Hola, querría reservar..."  // texto del email
//   }
//
//   // O ya extraído (sin necesidad de IA):
//   {
//     "nombre": "María García",
//     "motivo": "Limpieza dental",
//     "start": "2026-06-15T10:00:00",
//     "durationMin": 30,
//     "from": "cliente@dominio.com"        // opcional, va a attendees
//   }
//
// IMPORTANTE: Hoy no hay todavía un servicio de inbound email conectado
// a este endpoint. La función está lista. Para activarla en producción
// hay 2 caminos:
//   1. Cloudflare Email Routing → Worker → POST aquí con `body` plano.
//   2. SendGrid Inbound Parse o Postmark Inbound → webhook directo a
//      esta URL, con el header X-Eva-Secret.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { reservarSlot } from "@/lib/orchestrator";
import { tryAgendarFromText, formatStartHumanES } from "@/lib/appointment-intent";
import { getRedirectUri } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EvaPayload = {
  // Forma "texto libre"
  from?: string;
  from_name?: string;
  subject?: string;
  body?: string;
  // Forma "ya extraído"
  nombre?: string;
  motivo?: string;
  start?: string;
  durationMin?: number;
};

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

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

  let body: EvaPayload;
  try {
    body = (await req.json()) as EvaPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = getRedirectUri(host, proto);

  // -------------------------------------------------------------------------
  // Caso B — ya extraído
  // -------------------------------------------------------------------------
  if (body.nombre && body.motivo && body.start) {
    const result = await reservarSlot({
      userEmail: FOUNDER_EMAIL,
      redirectUri,
      nombre: body.nombre,
      motivo: body.motivo,
      startIso: body.start,
      durationMin: body.durationMin ?? 30,
      agenteOrigen: "eva",
      attendees: body.from ? [body.from] : undefined,
    });
    if (!result.ok) {
      if (result.reason === "slot_taken") {
        return NextResponse.json({ ok: false, error: "slot_taken", suggested: result.suggested }, { status: 409 });
      }
      if (result.reason === "locked") {
        return NextResponse.json({ ok: false, error: "locked" }, { status: 423 });
      }
      return NextResponse.json({ ok: false, error: result.detail }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      eventId: result.eventId,
      htmlLink: result.htmlLink,
      eventLogId: result.eventLogId,
    });
  }

  // -------------------------------------------------------------------------
  // Caso A — texto libre del email → extraer con Haiku + agendar
  // -------------------------------------------------------------------------
  if (!body.body?.trim()) {
    return NextResponse.json({
      ok: false,
      error: "Falta `body` (texto del email) o el tríptico nombre/motivo/start.",
    }, { status: 422 });
  }

  const composed = [
    body.subject ? `Asunto: ${body.subject}` : "",
    body.body,
  ].filter(Boolean).join("\n\n");

  const ag = await tryAgendarFromText({
    text: composed,
    agenteOrigen: "eva",
    redirectUri,
    customerNameFallback: body.from_name,
  });

  if (ag.kind === "no_intent") {
    return NextResponse.json({ ok: false, error: "no_intent", message: "El email no parece pedir cita." }, { status: 200 });
  }
  if (ag.kind === "incomplete") {
    return NextResponse.json({ ok: false, error: "incomplete", missing: ag.missing, intent: ag.intent }, { status: 422 });
  }
  if (ag.kind === "slot_taken") {
    return NextResponse.json({ ok: false, error: "slot_taken", suggested: ag.suggested, message: ag.suggested ? `Sugerencia: ${formatStartHumanES(ag.suggested)}` : undefined }, { status: 409 });
  }
  if (ag.kind === "error") {
    return NextResponse.json({ ok: false, error: ag.detail }, { status: 500 });
  }
  // agendada
  return NextResponse.json({
    ok: true,
    eventId: ag.result.eventId,
    htmlLink: ag.result.htmlLink,
    eventLogId: ag.result.eventLogId,
    intent: ag.intent,
  });
}
