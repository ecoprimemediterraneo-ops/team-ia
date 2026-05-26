/**
 * Marta · Webhook Instagram (DMs, comentarios, menciones).
 *
 * GET  /api/marta/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 *      → handshake inicial con Meta
 *
 * POST /api/marta/webhook
 *      → eventos reales (mensajes entrantes, comentarios, etc.)
 *      Meta exige 200 OK en < 5 segundos: procesamos rápido y delegamos.
 */

import { NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  handleVerifyChallenge,
  sendIgDm,
  replyToComment,
  sendPrivateReply,
} from "@/lib/marta-ig-meta";
import {
  upsertConversation,
  insertMessage,
  getRecentMessages,
  setConversationStatus,
  createLead,
  markLeadNotified,
  type Intent,
} from "@/lib/marta-ig-db";
import { classifyIgMessage } from "@/lib/marta-ig-classifier";
import { generateIgResponse, type NegocioConfig } from "@/lib/marta-ig-responder";
import { canSendIgMessage } from "@/lib/marta-ig-ratelimit";
import { getResend, RESEND_FROM } from "@/lib/resend";
import { getFounderEmails } from "@/lib/auth";
import { getMartaProfile, profileToNegocioConfig } from "@/lib/marta-profile";
import { createPending } from "@/lib/marta-pending";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── GET: challenge handshake ─────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const result = handleVerifyChallenge(searchParams);
  if (result.ok && result.challenge) {
    return new Response(result.challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verify failed" }, { status: 403 });
}

// ─── POST: eventos entrantes ──────────────────────────────────────────────────
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  // Parse body
  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Procesar entries sin bloquear la respuesta. Devolvemos 200 enseguida.
  // En Vercel serverless no podemos "fire-and-forget" real, pero acotamos
  // tiempo con maxDuration=30 y procesamos secuencialmente lo mínimo.
  try {
    await Promise.all(
      (body.entry || []).map((entry) => processEntry(entry)),
    );
  } catch (e) {
    console.error("[marta-ig webhook] entry error", e);
    // No devolvemos error a Meta — preferimos 200 para que no reintente.
  }

  return NextResponse.json({ ok: true });
}

// ─── Types ───────────────────────────────────────────────────────────────────
type WebhookBody = {
  object?: string;
  entry?: Entry[];
};

type Entry = {
  id: string;
  time?: number;
  messaging?: MessagingEvent[];
  changes?: ChangeEvent[];
};

type MessagingEvent = {
  sender?: { id: string };
  recipient?: { id: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    attachments?: Array<{ type: string; payload?: { url?: string } }>;
  };
};

type ChangeEvent = {
  field: string; // "comments" | "mentions" | etc.
  value: {
    id?: string;
    text?: string;
    from?: { id: string; username?: string };
    media?: { id: string };
  };
};

// ─── Procesar cada entry ─────────────────────────────────────────────────────
async function processEntry(entry: Entry): Promise<void> {
  const businessAccountId = entry.id;

  // 1) DMs (formato `messaging`)
  for (const msg of entry.messaging || []) {
    if (msg.message?.text && msg.sender?.id) {
      await handleDm({
        igUserId: msg.sender.id,
        text: msg.message.text,
        metaMessageId: msg.message.mid,
        businessAccountId,
      });
    }
  }

  // 2) Comentarios (formato `changes`)
  for (const change of entry.changes || []) {
    if (change.field === "comments" && change.value?.text && change.value.from?.id) {
      await handleComment({
        commentId: change.value.id!,
        igUserId: change.value.from.id,
        igUsername: change.value.from.username,
        text: change.value.text,
        businessAccountId,
      });
    }
    if (change.field === "mentions" && change.value?.media?.id) {
      // Story mention u otra mención: simple log por ahora
      await handleMention({
        mediaId: change.value.media.id,
        igUserId: change.value.from?.id || "unknown",
        igUsername: change.value.from?.username,
        businessAccountId,
      });
    }
  }
}

// ─── Config del negocio: lee de marta_profiles (Supabase) ─────────────────────
// Hoy single-tenant: usamos el primer founder como owner. Multi-tenant en V2.
async function getNegocioConfigForOwner(ownerEmail: string): Promise<NegocioConfig> {
  const profile = await getMartaProfile(ownerEmail);
  const cfg = profileToNegocioConfig(profile);
  // Fallbacks a env si el perfil aún no está rellenado
  return {
    nombreNegocio: cfg.nombreNegocio || process.env.MARTA_NOMBRE_NEGOCIO || "AI-Team",
    sector: cfg.sector || process.env.MARTA_SECTOR || undefined,
    horario: cfg.horario || process.env.MARTA_HORARIO || undefined,
    serviciosDestacados: cfg.serviciosDestacados || process.env.MARTA_SERVICIOS || undefined,
    tonoMarca: cfg.tonoMarca || process.env.MARTA_TONO || "cercano y profesional",
    reglasCustom: cfg.reglasCustom,
  };
}

function getOwnerEmail(businessAccountId: string): string {
  // Single-tenant por ahora: primer founder
  void businessAccountId;
  return getFounderEmails()[0];
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleDm(input: {
  igUserId: string;
  text: string;
  metaMessageId?: string;
  businessAccountId: string;
}) {
  const ownerEmail = getOwnerEmail(input.businessAccountId);
  const negocio = await getNegocioConfigForOwner(ownerEmail);

  // Upsert conversación
  const conv = await upsertConversation({
    ig_user_id: input.igUserId,
    business_account_id: input.businessAccountId,
    owner_email: ownerEmail,
  });
  if (!conv) {
    console.error("[marta-ig] no Supabase, skipping");
    return;
  }

  // Insertar mensaje entrante y guardar id para enlazar al pending
  const incomingMsg = await insertMessage({
    conversation_id: conv.id,
    direction: "in",
    message_type: "dm",
    content: input.text,
    media_url: null,
    intent: null,
    confidence: null,
    reasoning: null,
    responded_by: "bot",
    meta_message_id: input.metaMessageId ?? null,
  });

  // Cargar historial + clasificar
  const history = await getRecentMessages(conv.id, 10);
  const { intent, confidence, reasoning } = await classifyIgMessage(input.text, history);

  // Actualizar último intent en conversación
  await setConversationStatus(conv.id, conv.status, intent);

  // Decisiones por intent
  if (intent === "spam") {
    console.log("[marta-ig] spam, ignorando");
    return;
  }

  if (intent === "queja" || confidence < 0.7) {
    await setConversationStatus(conv.id, "escalated", intent);
    await notifyEscalation({ ownerEmail, conv, text: input.text, intent, confidence, reasoning });
    return; // NO respondemos automáticamente
  }

  // Detectar lead cualificado
  if (intent === "consulta_precio" || intent === "pedir_cita") {
    const lead = await createLead({
      conversation_id: conv.id,
      ig_username: conv.ig_username ?? undefined,
      lead_type: intent === "pedir_cita" ? "cita" : "presupuesto",
      notes: input.text.slice(0, 500),
      owner_email: ownerEmail,
    });
    if (lead) {
      await notifyLead({ ownerEmail, conv, lead, text: input.text });
      await markLeadNotified(lead.id);
    }
  }

  // Generar respuesta
  const respuesta = await generateIgResponse(input.text, intent, history, negocio);

  // Lookup modo de activación del cliente
  const profile = await getMartaProfile(ownerEmail);
  const modo = profile.modo_activacion;

  if (modo === "ruedines") {
    // Modo ruedines: guardar como pending y notificar humano. NO enviar.
    try {
      const pending = await createPending({
        conversation_id: conv.id,
        ig_user_id: input.igUserId,
        ig_username: conv.ig_username,
        owner_email: ownerEmail,
        incoming_message_id: incomingMsg?.id ?? null,
        incoming_text: input.text,
        proposed_response: respuesta,
        intent,
        confidence,
      });
      if (pending) await notifyPending({ ownerEmail, pending, conv });
    } catch (e) {
      console.error("[marta-ig] no se pudo crear pending:", e);
    }
    return;
  }

  // Modo auto: rate limit + enviar
  const rl = canSendIgMessage(input.igUserId);
  if (!rl.ok) {
    console.log("[marta-ig] rate-limited:", rl.reason);
    return;
  }

  const sent = await sendIgDm(input.igUserId, respuesta);

  await insertMessage({
    conversation_id: conv.id,
    direction: "out",
    message_type: "dm",
    content: respuesta,
    media_url: null,
    intent,
    confidence,
    reasoning,
    responded_by: "bot",
    meta_message_id: sent.ok ? (sent.messageId ?? null) : null,
  });

  if (!sent.ok) {
    console.warn("[marta-ig] no se envió:", sent.reason);
  }
}

async function handleComment(input: {
  commentId: string;
  igUserId: string;
  igUsername?: string;
  text: string;
  businessAccountId: string;
}) {
  const ownerEmail = getOwnerEmail(input.businessAccountId);
  const negocio = await getNegocioConfigForOwner(ownerEmail);

  const conv = await upsertConversation({
    ig_user_id: input.igUserId,
    ig_username: input.igUsername,
    business_account_id: input.businessAccountId,
    owner_email: ownerEmail,
  });
  if (!conv) return;

  await insertMessage({
    conversation_id: conv.id,
    direction: "in",
    message_type: "comment",
    content: input.text,
    media_url: null,
    intent: null,
    confidence: null,
    reasoning: null,
    responded_by: "bot",
    meta_message_id: input.commentId,
  });

  const history = await getRecentMessages(conv.id, 10);
  const { intent, confidence } = await classifyIgMessage(input.text, history);

  if (intent === "spam") return;

  // Detección lead cualificado en comentario público
  if (intent === "consulta_precio" || intent === "pedir_cita") {
    try {
      const lead = await createLead({
        conversation_id: conv.id,
        ig_username: conv.ig_username ?? undefined,
        lead_type: intent === "pedir_cita" ? "cita" : "presupuesto",
        notes: `[COMENTARIO PÚBLICO] ${input.text.slice(0, 500)}`,
        owner_email: ownerEmail,
      });
      if (lead) {
        await notifyLead({ ownerEmail, conv, lead, text: input.text });
        await markLeadNotified(lead.id);
      }
    } catch (e) {
      console.error("[marta-ig comment lead]", e);
    }
  }

  // Respuesta pública corta (max 80 chars) + CTA a DM
  const respuestaPublica = "¡Gracias por escribirnos! Te he mandado privado con la info 💬";
  if (respuestaPublica.length <= 80) {
    await replyToComment(input.commentId, respuestaPublica);
  }

  // Private Reply con info completa (solo 7 días tras comment, 1 vez)
  const respuestaDm = await generateIgResponse(input.text, intent, history, negocio);
  await sendPrivateReply(input.commentId, respuestaDm);

  await insertMessage({
    conversation_id: conv.id,
    direction: "out",
    message_type: "comment",
    content: respuestaPublica + "\n\n[DM]: " + respuestaDm,
    media_url: null,
    intent,
    confidence,
    reasoning: null,
    responded_by: "bot",
    meta_message_id: null,
  });

  if (intent === "queja") {
    await setConversationStatus(conv.id, "escalated", intent);
    await notifyEscalation({ ownerEmail, conv, text: input.text, intent, confidence, reasoning: "" });
  }
}

async function handleMention(input: {
  mediaId: string;
  igUserId: string;
  igUsername?: string;
  businessAccountId: string;
}) {
  const ownerEmail = getOwnerEmail(input.businessAccountId);
  const conv = await upsertConversation({
    ig_user_id: input.igUserId,
    ig_username: input.igUsername,
    business_account_id: input.businessAccountId,
    owner_email: ownerEmail,
  });
  if (!conv) return;

  await insertMessage({
    conversation_id: conv.id,
    direction: "in",
    message_type: "mention",
    content: `Te ha mencionado en una story (media ${input.mediaId})`,
    media_url: null,
    intent: null,
    confidence: null,
    reasoning: null,
    responded_by: "bot",
    meta_message_id: input.mediaId,
  });

  // Respuesta amable por DM (cuando Meta apruebe)
  const respuesta = `¡Gracias por mencionarnos! 🙌 Si quieres te contamos más por aquí.`;
  await sendIgDm(input.igUserId, respuesta);

  await insertMessage({
    conversation_id: conv.id,
    direction: "out",
    message_type: "mention",
    content: respuesta,
    media_url: null,
    intent: "saludo",
    confidence: 1,
    reasoning: "respuesta-default a mención",
    responded_by: "bot",
    meta_message_id: null,
  });
}

// ─── Notificaciones por email al founder ─────────────────────────────────────

async function notifyEscalation(opts: {
  ownerEmail: string;
  conv: { id: string; ig_username: string | null; ig_user_id: string };
  text: string;
  intent: Intent;
  confidence: number;
  reasoning: string;
}) {
  try {
    const resend = getResend();
    await resend.emails.send({
      from: RESEND_FROM,
      to: opts.ownerEmail,
      subject: `🚨 Marta IG · Mensaje escalado (${opts.intent})`,
      text: `Marta ha escalado un mensaje en Instagram a humano.

Usuario: ${opts.conv.ig_username || opts.conv.ig_user_id}
Intent: ${opts.intent} (confianza ${opts.confidence.toFixed(2)})
Razonamiento: ${opts.reasoning}

Mensaje:
"${opts.text}"

Contesta tú directamente en Instagram. Marta NO ha respondido automáticamente.

— Marta · DELTA-M5`,
    });
  } catch (e) {
    console.error("[marta-ig] notify escalation fail:", e);
  }
}

async function notifyLead(opts: {
  ownerEmail: string;
  conv: { id: string; ig_username: string | null; ig_user_id: string };
  lead: { id: string; lead_type: string };
  text: string;
}) {
  try {
    const resend = getResend();
    await resend.emails.send({
      from: RESEND_FROM,
      to: opts.ownerEmail,
      subject: `🎯 Marta IG · Lead detectado (${opts.lead.lead_type})`,
      text: `Marta ha detectado un lead cualificado en Instagram.

Tipo: ${opts.lead.lead_type}
Usuario IG: ${opts.conv.ig_username || opts.conv.ig_user_id}

Mensaje original:
"${opts.text}"

Marta ya está respondiendo en automático. Pero conviene que tú revises y llames si es urgente.

— Marta · DELTA-M5`,
    });
  } catch (e) {
    console.error("[marta-ig] notify lead fail:", e);
  }
}

async function notifyPending(opts: {
  ownerEmail: string;
  pending: { id: string; proposed_response: string; intent: Intent | null; confidence: number | null };
  conv: { ig_username: string | null; ig_user_id: string };
}) {
  try {
    const resend = getResend();
    const pub = process.env.PUBLIC_URL || "https://aiteam.marketing";
    await resend.emails.send({
      from: RESEND_FROM,
      to: opts.ownerEmail,
      subject: `🛡️ Marta IG · Respuesta lista para aprobar`,
      text: `Marta ha generado una respuesta pero está en modo RUEDINES — necesita tu aprobación antes de enviarla a Instagram.

Usuario IG: @${opts.conv.ig_username || opts.conv.ig_user_id}
Intent detectado: ${opts.pending.intent} (confianza ${opts.pending.confidence?.toFixed(2) ?? "n/a"})

Respuesta propuesta:
"${opts.pending.proposed_response}"

Aprueba o edita desde tu dashboard:
${pub}/dashboard/marta

(Tras 30 respuestas aprobadas con >85% acierto, Marta te sugerirá pasar a modo Auto.)

— Marta · DELTA-M5`,
    });
  } catch (e) {
    console.error("[marta-ig] notify pending fail:", e);
  }
}
