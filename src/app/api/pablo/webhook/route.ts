/**
 * Pablo · Webhook WhatsApp Business Cloud API.
 *
 * GET  → handshake hub.challenge
 * POST → eventos entrantes (mensajes nuevos, statuses)
 *
 * Single-tenant por ahora: usa primer founder como owner.
 * Multi-tenant cuando lleguen clientes: lookup por business_phone_id.
 */

import { NextResponse } from "next/server";
import { verifyWaSignature, handleWaChallenge, sendWaText } from "@/lib/pablo-wa-meta";
import {
  upsertWaConversation,
  insertWaMessage,
  getRecentWaMessages,
  setWaConversationStatus,
  createWaLead,
  markWaLeadNotified,
  type WaIntent,
} from "@/lib/pablo-wa-db";
import { classifyWaMessage } from "@/lib/pablo-wa-classifier";
import { generateWaResponse, profileToWaNegocio, type WaNegocioConfig } from "@/lib/pablo-wa-responder";
import { createPabloPending } from "@/lib/pablo-pending";
import { getPabloProfile } from "@/lib/pablo-profile";
import { getResend, RESEND_FROM } from "@/lib/resend";
import { getFounderEmails } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const r = handleWaChallenge(searchParams);
  if (r.ok && r.challenge) return new Response(r.challenge, { status: 200 });
  return NextResponse.json({ error: "verify failed" }, { status: 403 });
}

type WaBody = { object?: string; entry?: WaEntry[] };
type WaEntry = { id?: string; changes?: WaChange[] };
type WaChange = {
  field?: string;
  value?: {
    messaging_product?: string;
    metadata?: { phone_number_id?: string; display_phone_number?: string };
    contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
    messages?: Array<{
      from: string;
      id: string;
      timestamp: string;
      type: string;
      text?: { body: string };
    }>;
  };
};

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-hub-signature-256");

  if (!verifyWaSignature(rawBody, sig)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  let body: WaBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  try {
    await Promise.all((body.entry || []).map((entry) => processWaEntry(entry)));
  } catch (e) {
    console.error("[pablo webhook] error", e);
  }

  return NextResponse.json({ ok: true });
}

async function processWaEntry(entry: WaEntry) {
  for (const change of entry.changes || []) {
    if (change.field !== "messages") continue;
    const v = change.value;
    if (!v) continue;
    const businessPhoneId = v.metadata?.phone_number_id;
    if (!businessPhoneId) continue;

    const contacts = v.contacts || [];
    for (const msg of v.messages || []) {
      if (msg.type !== "text" || !msg.text?.body) continue;
      const profileName = contacts.find((c) => c.wa_id === msg.from)?.profile?.name ?? null;
      await handleWaIncoming({
        waPhone: msg.from,
        profileName,
        text: msg.text.body,
        waMessageId: msg.id,
        businessPhoneId,
      });
    }
  }
}

function getOwnerEmail(): string {
  return getFounderEmails()[0];
}

async function getNegocioConfigForOwner(ownerEmail: string): Promise<WaNegocioConfig> {
  const profile = await getPabloProfile(ownerEmail);
  const cfg = profileToWaNegocio(profile);
  return {
    nombreNegocio: cfg.nombreNegocio || process.env.PABLO_NOMBRE_NEGOCIO || "AI-Team",
    sector: cfg.sector || process.env.PABLO_SECTOR,
    horario: cfg.horario || process.env.PABLO_HORARIO,
    serviciosDestacados: cfg.serviciosDestacados || process.env.PABLO_SERVICIOS,
    tonoMarca: cfg.tonoMarca || process.env.PABLO_TONO || "cercano y profesional",
    reglasCustom: cfg.reglasCustom,
  };
}

async function handleWaIncoming(input: {
  waPhone: string;
  profileName: string | null;
  text: string;
  waMessageId: string;
  businessPhoneId: string;
}) {
  const ownerEmail = getOwnerEmail();
  const negocio = await getNegocioConfigForOwner(ownerEmail);

  const conv = await upsertWaConversation({
    wa_phone_number: input.waPhone,
    wa_profile_name: input.profileName,
    business_phone_id: input.businessPhoneId,
    owner_email: ownerEmail,
  });
  if (!conv) return;

  const incomingMsg = await insertWaMessage({
    conversation_id: conv.id,
    direction: "in",
    content: input.text,
    intent: null,
    confidence: null,
    reasoning: null,
    responded_by: "bot",
    wa_message_id: input.waMessageId,
  });

  const history = await getRecentWaMessages(conv.id, 10);
  const { intent, confidence, reasoning } = await classifyWaMessage(input.text, history);

  await setWaConversationStatus(conv.id, conv.status, intent);

  if (intent === "spam") return;

  if (intent === "queja" || confidence < 0.7) {
    await setWaConversationStatus(conv.id, "escalated", intent);
    await notifyWaEscalation({ ownerEmail, conv, text: input.text, intent, confidence, reasoning });
    return;
  }

  if (intent === "pedir_cita" || intent === "consulta_precio") {
    const lead = await createWaLead({
      conversation_id: conv.id,
      wa_phone_number: conv.wa_phone_number,
      wa_profile_name: conv.wa_profile_name,
      lead_type: intent === "pedir_cita" ? "cita" : "presupuesto",
      notes: input.text.slice(0, 500),
      owner_email: ownerEmail,
    });
    if (lead) {
      await notifyWaLead({ ownerEmail, conv, lead, text: input.text });
      await markWaLeadNotified(lead.id);
    }
  }

  const respuesta = await generateWaResponse(input.text, intent, history, negocio);
  const profile = await getPabloProfile(ownerEmail);
  const modo = profile.modo_activacion;

  if (modo === "ruedines") {
    try {
      const pending = await createPabloPending({
        conversation_id: conv.id,
        wa_phone_number: input.waPhone,
        wa_profile_name: input.profileName,
        owner_email: ownerEmail,
        incoming_message_id: incomingMsg?.id ?? null,
        incoming_text: input.text,
        proposed_response: respuesta,
        intent,
        confidence,
      });
      if (pending) await notifyWaPending({ ownerEmail, pending, conv });
    } catch (e) {
      console.error("[pablo] pending fail:", e);
    }
    return;
  }

  // Modo auto: enviar
  const sent = await sendWaText(input.waPhone, respuesta);
  await insertWaMessage({
    conversation_id: conv.id,
    direction: "out",
    content: respuesta,
    intent,
    confidence,
    reasoning,
    responded_by: "bot",
    wa_message_id: sent.ok ? (sent.messageId ?? null) : null,
  });

  if (!sent.ok) console.warn("[pablo] no enviado:", sent.reason);
}

async function notifyWaEscalation(opts: {
  ownerEmail: string;
  conv: { id: string; wa_profile_name: string | null; wa_phone_number: string };
  text: string;
  intent: WaIntent;
  confidence: number;
  reasoning: string;
}) {
  try {
    const resend = getResend();
    await resend.emails.send({
      from: RESEND_FROM,
      to: opts.ownerEmail,
      subject: `🚨 Pablo WhatsApp · Mensaje escalado (${opts.intent})`,
      text: `Pablo ha escalado un WhatsApp a humano.

Cliente: ${opts.conv.wa_profile_name || opts.conv.wa_phone_number}
Intent: ${opts.intent} (confianza ${opts.confidence.toFixed(2)})
Razón: ${opts.reasoning}

Mensaje:
"${opts.text}"

Pablo NO ha respondido. Contesta tú directamente.

— Pablo · ALFA-W1`,
    });
  } catch (e) {
    console.error("[pablo] notify escalation fail:", e);
  }
}

async function notifyWaLead(opts: {
  ownerEmail: string;
  conv: { wa_profile_name: string | null; wa_phone_number: string };
  lead: { id: string; lead_type: string };
  text: string;
}) {
  try {
    const resend = getResend();
    await resend.emails.send({
      from: RESEND_FROM,
      to: opts.ownerEmail,
      subject: `🎯 Pablo WhatsApp · Lead detectado (${opts.lead.lead_type})`,
      text: `Pablo ha detectado un lead cualificado en WhatsApp.

Tipo: ${opts.lead.lead_type}
Cliente: ${opts.conv.wa_profile_name || opts.conv.wa_phone_number}

Mensaje:
"${opts.text}"

Pablo ya está respondiendo. Llámale si es urgente.

— Pablo · ALFA-W1`,
    });
  } catch (e) {
    console.error("[pablo] notify lead fail:", e);
  }
}

async function notifyWaPending(opts: {
  ownerEmail: string;
  pending: { id: string; proposed_response: string; intent: WaIntent | null; confidence: number | null };
  conv: { wa_profile_name: string | null; wa_phone_number: string };
}) {
  try {
    const resend = getResend();
    const pub = process.env.PUBLIC_URL || "https://aiteam.marketing";
    await resend.emails.send({
      from: RESEND_FROM,
      to: opts.ownerEmail,
      subject: `🛡️ Pablo WhatsApp · Respuesta lista para aprobar`,
      text: `Pablo ha generado respuesta pero está en modo RUEDINES.

Cliente: ${opts.conv.wa_profile_name || opts.conv.wa_phone_number}
Intent: ${opts.pending.intent} (confianza ${opts.pending.confidence?.toFixed(2) ?? "n/a"})

Respuesta propuesta:
"${opts.pending.proposed_response}"

Aprueba o edita:
${pub}/dashboard/pablo

— Pablo · ALFA-W1`,
    });
  } catch (e) {
    console.error("[pablo] notify pending fail:", e);
  }
}
