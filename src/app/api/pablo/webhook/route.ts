// Webhook receiver de WhatsApp Business (Meta Graph API) para Pablo.
//
// FLUJO:
//   1. Meta llama GET /api/pablo/webhook con hub.verify_token → respondemos challenge si coincide.
//   2. Meta llama POST /api/pablo/webhook cuando llega un mensaje al número WhatsApp Business.
//   3. Extraemos texto + número del remitente, generamos respuesta con Claude Haiku,
//      y la enviamos de vuelta vía Graph API /messages.
//
// Vars de entorno necesarias (.env.local + Vercel):
//   WEBHOOK_VERIFY_TOKEN       — token compartido con Meta para validar el webhook
//   WHATSAPP_PHONE_NUMBER_ID   — ID del número emisor (no el número en sí)
//   WHATSAPP_ACCESS_TOKEN      — long-lived token con scope whatsapp_business_messaging
//   ANTHROPIC_API_KEY          — para generar la respuesta con Claude
//
// Doc Meta: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks

import { NextResponse } from "next/server";
import { comprobarFirmaMeta } from "@/lib/meta-firma";
import { anthropic, MODELS } from "@/lib/claude";
import { PABLO_SYSTEM } from "@/lib/pablo-prompt";
import {
  appendTurn,
  getConversation,
  type Conversation,
} from "@/lib/conversation-store";
import { logEvent, makeEventId } from "@/lib/event-log";
import { esUrgencia, configCarmen, avisarAlDueno, idiomaDe } from "@/lib/carmen-llamadas";
import { pideUnaPersona, textoAvisoAlDueno, textoCitaGuardada, textoServicioNoDisponible, textoNoGuardada, preguntaFaltante, confirmaCitaSinGuardar } from "@/lib/pablo-respuestas";
import { diaDeTexto } from "@/lib/fecha-es";
import { agendaCitasDeTenant, resolveTenantFromMeta, getTenantSector, getTenant, agenteContratado } from "@/lib/tenants";
import { resolverSector } from "@/lib/sectores";
import { getFicha, fichaToPromptContext } from "@/lib/ficha";
import { buildSectorSystem, getSectorPrompt } from "@/lib/sector-prompts";
import { resolverPersona } from "@/lib/persona";
import {
  findPendingProposalByWhatsapp,
  markProposalRejected,
  recordClientReply,
} from "@/lib/marta-proposals";
import { publishProposal } from "@/lib/marta-publish-flow";
import { classifyClientReply } from "@/lib/marta-intent";
import { getRoute, openRoute, closeRoute } from "@/lib/wa-route";
import { regenerateProposal, MAX_REGEN } from "@/lib/marta-regen";
import { sendWhatsAppImage, sendWhatsAppVideo, usarNumeroEmisor, numeroEmisor } from "@/lib/whatsapp-sender";
import { kvTryLock, supabaseEnabled } from "@/lib/supabase";
import {
  tryAgendarFromText,
  detectAppointmentIntent,
  missingFieldsToQuestion,
  formatStartHumanES,
  alreadyBookedForContact,
} from "@/lib/appointment-intent";
import { getBusinessByTenant } from "@/lib/booking";
import { pasoRestauranteSinHueco } from "@/lib/restaurante-flujo";
import { responderEstadoExpediente, anotarEnvioDeDocumentacion, diceQueEnvioDocumentacion } from "@/lib/gestoria-flujo";
import { preguntaPorEstado } from "@/lib/gestoria";
import { guardarAdjuntosWhatsApp, acuseDeRecibo, type AdjuntoWa } from "@/lib/gestoria-adjuntos";
import { destinoDeAdjunto } from "@/lib/gestoria-desvio";
import { esElGestor, transcribir, entender } from "@/lib/gestoria-audio";
import { descargarMedia } from "@/lib/gestoria-adjuntos";
import { esIntencionCancelar, resolverCancelacion, textoCancelacionChat } from "@/lib/booking-cancel-intent";
import { pasoGuion, gestionarCitaExistente, ofrecerAlternativas, cerrarGuion } from "@/lib/cita-por-chat";
import { detectarUrgencia as detectarUrgenciaDental, marcarUrgencia as marcarUrgenciaDental } from "@/lib/dental-urgencias";
import { detectarLeadCualificado, marcarLeadCualificado, quitarMarcadorLeadCualificado } from "@/lib/estetica-leads";
import {
  findEntryByProposalId,
  markCalendarEntryRejected,
} from "@/lib/marta-calendar";
import {
  findPendingRocioByWhatsapp,
  markRocioPublished,
  markRocioRejected,
  recordRocioClientReply,
} from "@/lib/rocio-proposals";
import { replyToReview } from "@/lib/google-business";
import { baseGraph, simulado } from "@/lib/meta-graph-local";

// Logging de eventos del informe mensual. Silencioso ante fallos para no
// romper el flujo principal del webhook.
async function safeLogEvent(...args: Parameters<typeof logEvent>): Promise<void> {
  try {
    await logEvent(...args);
  } catch (err) {
    console.error("[pablo/webhook] event log error:", err);
  }
}

/**
 * REGISTRA UN INTERCAMBIO COMPLETO: lo que entró y lo que se contestó.
 *
 * ⚠️ ESTA ES LA ÚNICA FORMA CORRECTA DE REGISTRAR UNA CONVERSACIÓN DE PABLO.
 * Cualquier camino que responda al cliente TIENE que llamar aquí antes de su
 * `continue`. Si no, el mensaje se ve en WhatsApp pero NO en el panel.
 *
 * Ese fue exactamente el fallo que hubo: el registro vivía solo al final del
 * flujo normal, y los cinco interceptores (Rocío, Marta, cancelación, hueco
 * ocupado, datos incompletos) contestaban y saltaban con `continue`, así que su
 * conversación nunca llegaba al event-log. En el panel parecía que Pablo no
 * había hablado con nadie.
 *
 * Guarda también el TEXTO (recortado). Sin el texto, el event-log sabe que hubo
 * un mensaje pero no cuál, y la bandeja de conversaciones del panel no se puede
 * construir.
 */
async function registrarIntercambio(opts: {
  tenantId: string;
  msgId: string;
  from: string;
  nombre?: string;
  entrante: string;
  respuesta?: string;
  rxTs: string;
  /** De dónde salió la respuesta. Va al log para poder diagnosticar sin adivinar. */
  via: string;
}): Promise<void> {
  const { tenantId, msgId, from, nombre, entrante, respuesta, rxTs, via } = opts;
  const recorta = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, 600);

  await safeLogEvent(tenantId, {
    id: makeEventId("message_in", "pablo", msgId),   // dedup por message_id de Meta
    ts: rxTs,
    type: "message_in",
    channel: "pablo",
    senderId: from,
    meta: { texto: recorta(entrante), ...(nombre ? { nombre } : {}), via },
  });

  if (respuesta) {
    await safeLogEvent(tenantId, {
      id: makeEventId("message_out", "pablo", msgId),
      type: "message_out",
      channel: "pablo",
      senderId: from,
      // latencyMs alimenta el KPI de tiempo de respuesta del panel.
      meta: { texto: recorta(respuesta), latencyMs: Date.now() - Date.parse(rxTs), via },
    });
  }

  console.log(
    `[pablo/webhook] LOG tenant=${tenantId} from=${from} via=${via} ` +
      `in=${entrante.length}ch out=${respuesta ? `${respuesta.length}ch` : "(sin respuesta)"}`,
  );
}

// Idempotencia por id de mensaje de Meta. WhatsApp Cloud API REINTENTA la
// entrega si el webhook no responde 200 rápido — y la regeneración de Marta
// tarda (Haiku + gpt-image-1). Sin esto, cada reintento del MISMO mensaje
// reejecutaba la regeneración → 3 propuestas encadenadas. Reclamamos el msg.id
// UNA sola vez (lock atómico en Supabase; Set en memoria en local): los
// reintentos posteriores se ignoran.
const seenLocal = new Set<string>();
async function claimMessageOnce(msgId: string): Promise<boolean> {
  if (!msgId) return true; // sin id no podemos deduplicar; procesamos
  if (supabaseEnabled()) {
    // kvTryLock inserta atómicamente; si ya existe y está fresco → false.
    return await kvTryLock(`wa-msg:${msgId}`, 10 * 60 * 1000, "pablo");
  }
  if (seenLocal.has(msgId)) return false;
  seenLocal.add(msgId);
  if (seenLocal.size > 2000) seenLocal.clear();
  return true;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * 60 segundos, que es el techo del plan Hobby.
 *
 * NO es para contestarle a Meta —eso tarda milisegundos— sino para el trabajo
 * que queda corriendo DESPUÉS de contestar: leer el documento con la IA. Ese
 * trabajo cuenta dentro de la duración de la misma función, y sin esto se
 * aplicaba el límite por defecto de 10 segundos: la respuesta a Meta salía
 * bien, pero a la lectura la cortaban a mitad y el documento se quedaba en
 * blanco. Justo el fallo que la lectura automática venía a arreglar, movido de
 * sitio. Si aun así se corta (un mensaje con varios PDF), el documento sigue
 * guardado y se recupera con el botón "Leer los que faltan".
 */
export const maxDuration = 60;

const GRAPH_VERSION = "v21.0";

// -----------------------------------------------------------------------------
// GET — verificación inicial del webhook (handshake con Meta)
// -----------------------------------------------------------------------------
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token && expected && token === expected) {
    console.log("[pablo/webhook] GET handshake OK");
    // Meta exige devolver el challenge como text/plain
    return new Response(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[pablo/webhook] GET handshake FAILED", {
    mode,
    tokenMatch: token === expected,
    hasExpected: Boolean(expected),
  });
  return new Response("Forbidden", { status: 403 });
}

// -----------------------------------------------------------------------------
// POST — recepción de mensajes
// -----------------------------------------------------------------------------
type IncomingMsg = {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  // Adjuntos. En GESTORÍA, una imagen o un PDF son una FACTURA y van al saco del
  // cliente; el resto de tipos (audio, vídeo, sticker) se siguen ignorando.
  image?: { id: string; mime_type?: string; caption?: string };
  document?: { id: string; mime_type?: string; filename?: string; caption?: string };
  // Las notas de voz llegan como `audio` con `voice: true`. Un audio adjuntado
  // desde la galería llega igual pero sin ese campo; para nosotros da lo mismo.
  audio?: { id: string; mime_type?: string; voice?: boolean };
};

type WebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        messaging_product?: string;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: IncomingMsg[];
        statuses?: Array<{ id: string; status: string; recipient_id: string }>;
      };
      field?: string;
    }>;
  }>;
};

export async function POST(req: Request) {
  // El cuerpo se lee CRUDO porque la firma de Meta es el HMAC de estos bytes
  // exactos: parsear y volver a serializar cambia espacios y orden, y entonces
  // no cuadra nunca.
  const crudo = await req.text();
  const firma = comprobarFirmaMeta(crudo, req.headers.get("x-hub-signature-256"));
  if (!firma.ok) {
    console.warn("[pablo/webhook] POST rechazado:", firma.motivo);
    return NextResponse.json({ ok: false, error: "firma" }, { status: 401 });
  }
  if (!firma.comprobada) {
    console.warn(`[pablo/webhook] FIRMA SIN COMPROBAR: ${firma.motivo}`);
  }

  let body: WebhookPayload;
  try {
    body = JSON.parse(crudo) as WebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  console.log("[pablo/webhook] POST payload:", JSON.stringify(body).slice(0, 1500));

  // Meta espera 200 rápido. Procesamos best-effort y respondemos al final.
  try {
    const entries = body.entry ?? [];
    for (const entry of entries) {
      const changes = entry.changes ?? [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // Estados (delivered, read, sent) — solo loggear
        if (value.statuses?.length) {
          for (const s of value.statuses) {
            console.log(
              `[pablo/webhook] status ${s.status} msg=${s.id} to=${s.recipient_id}`,
            );
          }
          continue;
        }

        // Resolver tenant a partir del phone_number_id del receptor (nuestro número).
        const phoneNumberId = value.metadata?.phone_number_id;
        const tenantId = await resolveTenantFromMeta({ whatsappPhoneNumberId: phoneNumberId });
        // Número que no es de ningún cliente: no se contesta. Antes se atendía
        // con el tenant por defecto, así que un mensaje ajeno acababa
        // respondido en nombre de otro negocio y apuntado en su cuenta.
        // Se devuelve 200 igualmente: a Meta le decimos que lo hemos recibido
        // (si no, reintenta en bucle), pero aquí no se hace nada con él.
        if (!tenantId) {
          console.warn(
            `[pablo/webhook] IGNORADO: phone_number_id=${phoneNumberId ?? "(ausente)"} no es de ningún tenant. ` +
              `${(value.messages ?? []).length} mensaje(s) sin atender.`,
          );
          continue;
        }
        // Diagnóstico: si el panel no ve la conversación, lo primero es saber en
        // QUÉ tenant se está escribiendo.
        console.log(
          `[pablo/webhook] tenant resuelto=${tenantId} desde phone_number_id=${phoneNumberId ?? "(ausente)"}`,
        );
        // Todo lo que se conteste en esta petición sale por el número que ha recibido.
        usarNumeroEmisor(phoneNumberId);
        // Agentes contratados (multi-marca): si este cliente no tiene a Pablo, no se contesta.
        if (!(await agenteContratado(tenantId, "pablo"))) {
          console.warn(`[pablo/webhook] IGNORADO: el tenant ${tenantId} no tiene contratado a Pablo.`);
          continue;
        }

        const messages = value.messages ?? [];
        const contacts = value.contacts ?? [];
        for (const msg of messages) {
          /** true = este mensaje ya pasó el control de duplicados (venía en audio). */
          let yaReclamado = false;
          // === GESTORÍA: adjunto = FACTURA ===
          // Va lo PRIMERO y termina en `continue`: una foto de un ticket no
          // tiene que pasar por el clasificador Haiku ni por el flujo de agenda.
          // Cualquiera puede mandarla, también el propio gestor desde su móvil,
          // así que NO se filtra por remitente.
          if (msg.type === "image" || msg.type === "document") {
            try {
              // A qué cuenta va la factura. Normalmente la del número que la ha
              // recibido; con un desvío puesto, la de la gestoría a la que le
              // hace de puente ese número mientras no tiene el suyo.
              const destino = await destinoDeAdjunto({ phoneNumberId, tenantResuelto: tenantId });
              const t = await getTenant(destino.tenantId);
              const sector = t ? resolverSector(t) : null;

              // Antes esta rama se saltaba en silencio y el mensaje acababa en
              // "no-texto ignorado": la foto se perdía y Pablo no contestaba
              // nada, que por fuera se ve igual que si estuviera roto. Ahora se
              // dice por qué no se ha guardado.
              if (!t || sector !== "gestoria") {
                console.warn(
                  `[pablo/webhook] ADJUNTO NO GUARDADO: ${msg.type} de ${msg.from} → tenant ${destino.tenantId}` +
                    ` (sector ${sector ?? "sin sector"}, no es gestoría). ${destino.motivo}.` +
                    ` Para que entre, ese número tiene que resolver a una gestoría o hay que poner un desvío` +
                    ` en /api/admin/gestoria-desvio`,
                );
              } else {
                if (!(await claimMessageOnce(msg.id))) {
                  console.log(`[pablo/webhook] adjunto duplicado ignorado: ${msg.id}`);
                  continue;
                }
                // Un mensaje puede traer varios: se crea un registro por cada uno.
                const adjuntos: AdjuntoWa[] = [];
                if (msg.image) adjuntos.push({ id: msg.image.id, mime_type: msg.image.mime_type });
                if (msg.document) {
                  adjuntos.push({
                    id: msg.document.id,
                    mime_type: msg.document.mime_type,
                    filename: msg.document.filename,
                  });
                }

                const creadas = await guardarAdjuntosWhatsApp({
                  tenantId: destino.tenantId, telefono: msg.from, adjuntos,
                });
                console.log(
                  `[pablo/webhook] adjunto de ${msg.from}: ${creadas} factura(s) en ${destino.tenantId}` +
                    `${destino.desviado ? " (POR DESVÍO)" : ""}`,
                );
                if (creadas > 0) {
                  const acuse = acuseDeRecibo(creadas);
                  await sendWhatsAppText(msg.from, acuse);
                  await registrarIntercambio({
                    tenantId: destino.tenantId, msgId: msg.id, from: msg.from,
                    nombre: contacts.find((c) => c.wa_id === msg.from)?.profile?.name,
                    entrante: `[adjunto] ${msg.document?.filename ?? msg.type}`,
                    respuesta: acuse, rxTs: new Date().toISOString(), via: "gestoria_factura_recibida",
                  });
                  continue;
                }
                // Llegó algo que no era ni imagen ni PDF aprovechable. Se avisa
                // en vez de dejar al cliente esperando una respuesta que no llega.
                const nada = "no he podido leer ese archivo. mandamelo como foto o en pdf y lo guardo";
                await sendWhatsAppText(msg.from, nada);
                continue;
              }
            } catch (err) {
              console.error("[pablo/webhook] interceptor de adjuntos falló:", err);
            }
          }

          // === AUDIOS ===
          // Pablo no los escucha todavía. Callarse es la peor respuesta posible:
          // el cliente ve el "visto" y ni contestación, y da por hecho que el
          // sistema está roto. Se contesta corto y con la verdad.
          if (msg.type === "audio") {
            try {
              if (!(await claimMessageOnce(msg.id))) {
                console.log(`[pablo/webhook] audio duplicado ignorado: ${msg.id}`);
                continue;
              }
              const t = await getTenant(tenantId);
              const esGestoria = t ? resolverSector(t) === "gestoria" : false;

              // EL GESTOR SÍ, LOS CLIENTES NO.
              //
              // Jose se lo dicta en el coche y Pablo tiene que actuar. Para un
              // cliente cualquiera la transcripción no está decidida: sería una
              // llamada de pago por cada nota de voz que entre al número, y no
              // hace falta para mandar una factura. Decide el número, no el
              // sector: solo el ownerWhatsapp del tenant.
              if (esGestoria && msg.audio && esElGestor(msg.from, t?.ownerWhatsapp)) {
                const contestado = await atenderAudioDelGestor({
                  tenantId, telefono: msg.from, mediaId: msg.audio.id, mime: msg.audio.mime_type || "audio/ogg",
                });
                await registrarIntercambio({
                  tenantId, msgId: msg.id, from: msg.from,
                  nombre: contacts.find((c) => c.wa_id === msg.from)?.profile?.name,
                  entrante: "[audio del gestor]",
                  respuesta: contestado, rxTs: new Date().toISOString(), via: "gestoria_audio_gestor",
                });
                continue;
              }

              // EL RESTO DE AUDIOS: se transcriben y siguen el MISMO camino que
              // un mensaje escrito.
              //
              // Antes aquí se contestaba "los audios todavia no los escucho" y
              // se acababa la conversación. Media España manda notas de voz en
              // vez de escribir, y a un cliente que le pide a su gestoría "oye,
              // ¿cómo va lo mío?" hablando no se le puede pedir que lo teclee.
              //
              // Se transcribe y se REESCRIBE el mensaje como si hubiera llegado
              // en texto: así no hay un segundo camino que mantener al día. Todo
              // lo que sabe hacer Pablo con un texto lo sabe hacer con un audio.
              const media = msg.audio ? await descargarMedia(msg.audio.id) : null;
              const tr = media
                ? await transcribir(media.buffer, media.mime || msg.audio?.mime_type || "audio/ogg")
                : ({ ok: false, error: "no se ha podido descargar el audio" } as const);

              if (tr.ok && tr.texto.trim()) {
                console.log(`[pablo/webhook] audio de ${msg.from} transcrito: "${tr.texto.slice(0, 80)}"`);
                // A partir de aquí es un mensaje de texto normal y corriente. El
                // `claimMessageOnce` ya se ha consumido arriba, así que se marca
                // para que el camino de texto no lo descarte por duplicado.
                msg.type = "text";
                msg.text = { body: tr.texto.trim() };
                yaReclamado = true;
              } else {
                // NUNCA callado. Si no se ha podido escuchar, se dice y se pide
                // por escrito: el silencio se lee como "esto está roto".
                const respuesta = esGestoria
                  ? "No he podido escuchar ese audio. Me lo escribes, o me mandas la foto de la factura?"
                  : "No he podido escuchar ese audio. Me lo escribes?";
                console.warn(`[pablo/webhook] audio de ${msg.from} sin transcribir: ${"error" in tr ? tr.error : "vacío"}`);
                await sendWhatsAppText(msg.from, respuesta);
                await registrarIntercambio({
                  tenantId, msgId: msg.id, from: msg.from,
                  nombre: contacts.find((c) => c.wa_id === msg.from)?.profile?.name,
                  entrante: "[audio que no se ha podido escuchar]",
                  respuesta, rxTs: new Date().toISOString(), via: "audio_sin_transcribir",
                });
                continue;
              }
            } catch (err) {
              // Un fallo aquí tampoco puede dejar al cliente sin respuesta.
              console.error("[pablo/webhook] no se pudo atender el audio:", err);
              const respuesta = "No he podido escuchar ese audio. Me lo escribes?";
              await sendWhatsAppText(msg.from, respuesta).catch(() => {});
              continue;
            }
          }

          // Solo texto por ahora
          if (msg.type !== "text" || !msg.text?.body) {
            console.log(`[pablo/webhook] mensaje no-texto ignorado: ${msg.type}`);
            continue;
          }

          // Idempotencia: procesa cada mensaje UNA sola vez. Los reintentos de
          // Meta (cuando la regeneración tarda) se ignoran aquí → no se encadenan
          // varias generaciones para el mismo mensaje.
          // `yaReclamado` = venía de un audio, que ya pasó por `claimMessageOnce`
          // arriba. Sin esto, un audio transcrito se descartaría aquí como si
          // fuera un reintento de Meta y Pablo se quedaría mudo.
          if (!yaReclamado && !(await claimMessageOnce(msg.id))) {
            console.log(`[pablo/webhook] mensaje duplicado (reintento de Meta) ignorado: ${msg.id}`);
            continue;
          }

          const from = msg.from; // número del cliente (sin '+')
          const text = msg.text.body;
          const customerName = contacts.find((c) => c.wa_id === from)?.profile?.name;

          // Ts de recepción para medir latencia de respuesta del agente.
          const rxTs = new Date().toISOString();

          console.log(
            `[pablo/webhook] RX from=${from} name=${customerName ?? "?"} text="${text}"`,
          );

          // Recuerda lo ÚLTIMO que se le ha dicho al cliente en este mensaje.
          // Los interceptores de Rocío y Marta responden desde muchas ramas
          // distintas; en vez de registrar en cada una (y olvidarse en la
          // siguiente que se añada), se envía por aquí y al salir se registra lo
          // que quedó apuntado.
          let ultimaRespuesta: string | undefined;
          const responder = async (texto: string) => {
            ultimaRespuesta = texto;
            return sendWhatsAppText(from, texto);
          };

          // === SESIÓN DE RUTEO ===
          // Si este número está en mitad de un flujo con un agente, sus
          // respuestas SIGUIENTES van a ESE agente hasta que el flujo termine
          // (aunque el clasificador falle o la propuesta deje de estar pending).
          const route = await getRoute(from);
          const forceMarta = route?.agent === "marta";

          // === INTERCEPTOR: ¿propuesta de Rocío pendiente (respuesta a reseña)? ===
          // Antes que Marta para no mezclar. Aprobación → publica en Google.
          // Se salta si hay una sesión activa de Marta para este número.
          if (!forceMarta) try {
            const rocioP = await findPendingRocioByWhatsapp(from);
            if (rocioP) {
              const cls = await classifyClientReply(text);
              await recordRocioClientReply(rocioP, text, cls.intent);
              console.log(`[pablo/webhook] Rocio proposal id=${rocioP.id} intent=${cls.intent}`);
              if (cls.intent === "ok") {
                // El usuario que pertenezca al tenant es el receptor —
                // simplificación: usamos el email del fundador para los
                // tokens GBP. En multi-tenant: mapear tenantId→userEmail.
                const founder = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
                const redirectUri = `https://aiteam.marketing/api/rocio/callback`;
                const r = await replyToReview(founder, redirectUri, rocioP.reviewName, rocioP.draftReply);
                if (r.ok) {
                  await markRocioPublished(rocioP);
                  await safeLogEvent(rocioP.tenantId, {
                    id: makeEventId("review_replied", "rocio", rocioP.reviewName),
                    type: "review_replied",
                    channel: "rocio",
                    meta: { rating: rocioP.rating },
                  });
                  await responder("¡Publicado en Google! ⭐ La respuesta ya está visible.");
                } else {
                  console.error(`[pablo/webhook] Rocio reply falló: ${r.reason} ${r.detail}`);
                  await responder("Recibí tu OK, pero Google me ha rechazado la respuesta. Lo revisamos y volvemos a intentarlo.");
                }
              } else if (cls.intent === "rechazar") {
                await markRocioRejected(rocioP);
                await responder("Sin problema, descartado 👌");
              } else {
                await responder("Vale, ¿cómo quieres que reformule la respuesta a la reseña?");
              }
              // También se registra: es una conversación real por WhatsApp.
              await registrarIntercambio({
                tenantId, msgId: msg.id, from, nombre: customerName,
                entrante: text, respuesta: ultimaRespuesta, rxTs, via: "aprobacion_rocio",
              });
              continue;
            }
          } catch (err) {
            console.error("[pablo/webhook] error en interceptor de Rocío:", err);
          }

          // === INTERCEPTOR: ¿propuesta de Marta pendiente para este número? ===
          // Si hay propuesta pendiente, este mensaje NO va a Claude/Pablo.
          // Clasificamos con Haiku la intención y respondemos según las 4 categorías:
          //   ok               → publicar
          //   cambiar_foto     → "¿Qué cambio quieres en la imagen?"
          //   cambiar_caption  → "¿Qué quieres ajustar del texto?"
          //   rechazar         → cancelar propuesta, "OK, descartado"
          //   feedback_general → "Vale, lo ajusto. Cuéntame qué cambias."
          try {
            const proposal = await findPendingProposalByWhatsapp(from);
            if (!proposal && forceMarta) {
              // Sesión de Marta activa pero sin propuesta pendiente: el flujo ya
              // terminó. Limpiamos y dejamos pasar al flujo normal de Pablo.
              await closeRoute(from);
            }
            if (proposal) {
              const cls = await classifyClientReply(text);
              await recordClientReply(proposal, text, cls.intent);
              console.log(
                `[pablo/webhook] Marta proposal id=${proposal.id} intent=${cls.intent} foto=${cls.changeFoto} caption=${cls.changeCaption} (conf=${cls.confidence.toFixed(2)}, src=${cls.source})`,
              );
              const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://aiteam.marketing";

              if (cls.intent === "ok") {
                const pub = await publishProposal(proposal);
                if (pub.ok) {
                  const ack = pub.permalink
                    ? `¡Publicado! 🎉\n\nVer post: ${pub.permalink}`
                    : `¡Publicado! 🎉`;
                  await responder(ack);
                  // publishProposal ya cerró la sesión de ruteo.
                } else if (pub.kind === "disabled") {
                  await responder(
                    "Recibí tu OK, pero la publicación está desactivada ahora mismo. Te aviso en cuanto se reactive.",
                  );
                } else {
                  console.error(`[pablo/webhook] publish falló: ${pub.detail}`);
                  await responder(
                    "Recibí tu OK, pero Instagram me ha rechazado la publicación. Lo revisamos y volvemos a intentarlo.",
                  );
                }
              } else if (cls.intent === "rechazar") {
                await markProposalRejected(proposal);
                // Propaga al calendario si la propuesta venía de allí.
                try {
                  const calEntry = await findEntryByProposalId(proposal.tenantId, proposal.id);
                  if (calEntry) await markCalendarEntryRejected(proposal.tenantId, calEntry.id);
                } catch { /* noop */ }
                await closeRoute(from); // flujo terminado
                await responder(
                  "Sin problema, descartado 👌 Cuando quieras otra propuesta me dices.",
                );
              } else if (!(cls.changeFoto ?? false) && !(cls.changeCaption ?? false)) {
                // feedback_general SIN cambio concreto → pedir aclaración (no
                // regenerar a ciegas). La sesión sigue activa con Marta.
                await responder(
                  "Vale 👍 Dime exactamente qué cambio: la foto, el texto, o ambos — y qué quieres distinto.",
                );
                await openRoute(from, "marta", proposal.id);
              } else {
                // === CAMBIOS: regenerar DE VERDAD (foto y/o texto) ===
                const changeFoto = cls.changeFoto ?? (cls.intent === "cambiar_foto");
                const changeCaption = cls.changeCaption ?? (cls.intent === "cambiar_caption");
                await responder("Vale, lo rehago con esos cambios… dame un momento 🎨");
                const regen = await regenerateProposal({
                  proposal,
                  changeFoto,
                  changeCaption,
                  feedback: text,
                  baseUrl: SITE,
                });
                if (regen.kind === "ok") {
                  const isVid = proposal.mediaType === "REELS" || proposal.mediaType === "STORIES_VIDEO";
                  if (isVid) await sendWhatsAppVideo(from, regen.imageUrl, regen.caption);
                  else await sendWhatsAppImage(from, regen.imageUrl, regen.caption);
                  const partes = [regen.changedFoto ? "imagen" : null, regen.changedCaption ? "texto" : null]
                    .filter(Boolean)
                    .join(" y ");
                  await responder(
                    `Aquí tienes la nueva versión${partes ? ` (${partes})` : ""}. ¿La publico? Responde OK o dime qué más cambio.`,
                  );
                  await openRoute(from, "marta", regen.proposal.id); // sigue el flujo
                } else if (regen.kind === "limit") {
                  await responder(
                    `Llevamos ${MAX_REGEN} versiones 😅 Para no marear, dime "ok" para publicar la última o te llamo y lo cerramos juntos.`,
                  );
                  await openRoute(from, "marta", proposal.id);
                } else if (regen.kind === "needs_video") {
                  await responder(
                    "Para cambiar el vídeo, pásame el MP4 nuevo (vertical 9:16) y lo preparo. El texto sí puedo reescribirlo si me dices cómo.",
                  );
                  await openRoute(from, "marta", proposal.id);
                } else {
                  console.error(`[pablo/webhook] regen falló: ${regen.detail}`);
                  await responder(
                    "Uy, se me atascó al rehacerlo. Dime otra vez qué cambias y lo intento de nuevo.",
                  );
                  await openRoute(from, "marta", proposal.id);
                }
              }
              // Saltamos el flujo normal de Pablo para este mensaje, pero SIN
              // saltarnos el registro: esta también es una conversación real.
              await registrarIntercambio({
                tenantId, msgId: msg.id, from, nombre: customerName,
                entrante: text, respuesta: ultimaRespuesta, rxTs, via: "aprobacion_marta",
              });
              continue;
            }
          } catch (err) {
            console.error("[pablo/webhook] error en interceptor de Marta:", err);
            // Caemos al flujo normal de Pablo si algo falla en el interceptor.
          }

          // === INTERCEPTOR: ¿el cliente quiere reservar cita? ===
          // Solo para sectores que agendan citas de clientes finales (dental,
          // estetica). El sector "vendedor" capta clínicas y NO agenda citas
          // de pacientes, así que se salta el interceptor.
          let sectorAgenda = true;
          try {
            const sk = await getTenantSector(tenantId);
            sectorAgenda = getSectorPrompt(sk).agendaCitas || (await agendaCitasDeTenant(tenantId));
          } catch { /* por defecto intentamos agendar */ }

          // ¿Es un RESTAURANTE? De eso depende que se extraigan personas y zona
          // y que no se le pida "motivo" a quien solo quiere una mesa. Se mira
          // el perfil de sector del tenant, no se cablea en el flujo común: para
          // los otros cuatro sectores `modoRest` queda en undefined y todo este
          // bloque se comporta exactamente igual que antes.
          let modoRest: { restaurante?: boolean } | undefined;
          // ¿Y una GESTORÍA? Ahí la pregunta que más se repite no es una cita,
          // es "¿cómo va lo mío?". Se resuelve en su propia rama, antes del
          // interceptor de agenda. Para los otros sectores queda en undefined.
          let modoGest: { gestoria?: boolean } | undefined;
          let esDental = false;
          // ¿Y una CLÍNICA ESTÉTICA? Ahí lo que hay que no perder no es una
          // urgencia, es un lead. Ver el enganche más abajo, tras la respuesta.
          let esEstetica = false;
          try {
            const t = await getTenant(tenantId);
            const sec = t ? resolverSector(t) : null;
            if (sec === "restaurante") modoRest = { restaurante: true };
            if (sec === "gestoria") modoGest = { gestoria: true };
            if (sec === "dental") esDental = true;
            if (sec === "estetica") esEstetica = true;
          } catch { /* si no se puede saber, se trata como hasta ahora */ }

          // === RUTA DE URGENCIA: solo dental. No intercepta nada — Pablo
          // sigue la conversación exactamente igual, esto solo deja
          // constancia para que la pestaña Hoy y el chat del panel puedan
          // enseñar a quién hay que meter hoy sí o sí. Nunca bloquea el flujo
          // normal: si falla, se ignora. ===
          if (esDental && detectarUrgenciaDental(text)) {
            marcarUrgenciaDental(tenantId, { telefono: from, nombre: customerName, texto: text }).catch(() => {});
          }

          // === INTERCEPTOR: PIDE UNA PERSONA O TIENE UNA URGENCIA ===
          // Como en Carmen: se avisa al WhatsApp del DUEÑO (plantilla de urgencia)
          // y al cliente se le dice la verdad: si el aviso ha salido, que le
          // contactarán; si no, que queda anotado. Antes Pablo contestaba "te
          // atiendo yo" o le ofrecía cita a quien tenía una reacción alérgica.
          if (sectorAgenda) try {
            const tAviso = await getTenant(tenantId);
            const urgente = !!esUrgencia(text, configCarmen(tAviso).urgencias);
            if (urgente || pideUnaPersona(text)) {
              const idiomaAviso = idiomaDe(text) === "en" ? "en" : "es";
              const quien = `${customerName ? `${customerName} ` : ""}(+${from.replace(/\D/g, "")})`;
              const aviso = await avisarAlDueno(tenantId,
                `${urgente ? "URGENCIA" : "Un cliente quiere hablar con una persona"} por WhatsApp\nCliente: ${quien}\n${text.slice(0, 400)}`,
                process.env.CARMEN_URGENCIA_TEMPLATE ? { nombre: process.env.CARMEN_URGENCIA_TEMPLATE, variables: [quien, `${urgente ? "" : "Pide hablar con una persona. "}${text}`.slice(0, 500)] } : undefined);
              const avisado = aviso.enviado && !/simulado/.test(aviso.modo);
              const resp = textoAvisoAlDueno({ avisado, urgente, idioma: idiomaAviso });
              await sendWhatsAppText(from, resp);
              await appendTurn("pablo", tenantId, from, "user", text, customerName);
              await appendTurn("pablo", tenantId, from, "assistant", resp, customerName);
              await logEvent(tenantId, {
                id: makeEventId("pablo_aviso_dueno", msg.id), type: "handoff_human", channel: "pablo", senderId: from,
                meta: { kind: urgente ? "urgencia" : "pide_persona", texto: text.slice(0, 300), aviso: aviso.modo, avisado },
              }).catch(() => {});
              await registrarIntercambio({
                tenantId, msgId: msg.id, from, nombre: customerName,
                entrante: text, respuesta: resp, rxTs, via: urgente ? "urgencia_aviso_dueno" : "persona_aviso_dueno",
              });
              continue;
            }
          } catch (err) {
            console.error("[pablo/webhook] aviso al dueño falló (sigue el flujo normal):", err);
          }

          // === INTERCEPTOR: EL GUION DE HUECOS Y LAS CITAS QUE YA TIENE ===
          // Reglas fijas, sin criterio del modelo (ver `cita-por-chat.ts`):
          //   1. Si se le ofrecieron huecos, lo que conteste se resuelve aquí
          //      (elige uno → se reserva; no quiere ninguno → qué días le van;
          //      segunda ronda fallida → enlace de huecos libres).
          //   2. Si quiere CANCELAR o CAMBIAR la hora de su cita, se hace desde
          //      el chat: se le pregunta, contesta y queda hecho, y el hueco
          //      vuelve a estar libre. Antes solo se le mandaba el enlace web.
          if (sectorAgenda && !modoRest?.restaurante) {
            try {
              const r =
                (await pasoGuion({ tenantId, contacto: from, texto: text, nombreCliente: customerName, agenteOrigen: "pablo" })) ??
                (await gestionarCitaExistente({ tenantId, contacto: from, texto: text }));
              if (r) {
                await sendWhatsAppText(from, r.texto);
                await appendTurn("pablo", tenantId, from, "user", text, customerName);
                await appendTurn("pablo", tenantId, from, "assistant", r.texto, customerName);
                await registrarIntercambio({
                  tenantId, msgId: msg.id, from, nombre: customerName,
                  entrante: text, respuesta: r.texto, rxTs, via: r.via,
                });
                continue;
              }
            } catch (err) {
              console.error("[pablo/webhook] interceptor de guion/citas falló:", err);
            }
          }

          // === INTERCEPTOR (restaurante y respaldo): CANCELAR o MOVER con enlace ===
          // Para restauración se queda el enlace de autocancelación de siempre.
          if (sectorAgenda && modoRest?.restaurante && esIntencionCancelar(text)) {
            try {
              const business = await getBusinessByTenant(tenantId);
              if (business) {
                const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://aiteam.marketing";
                const caso = await resolverCancelacion(business.slug, from, SITE);
                const resp = textoCancelacionChat(caso, `${SITE}/reservas/${business.slug}`, customerName);
                await sendWhatsAppText(from, resp);
                await appendTurn("pablo", tenantId, from, "user", text, customerName);
                await appendTurn("pablo", tenantId, from, "assistant", resp, customerName);
                await registrarIntercambio({
                  tenantId, msgId: msg.id, from, nombre: customerName,
                  entrante: text, respuesta: resp, rxTs, via: "cancelacion",
                });
                continue;
              }
            } catch (err) {
              console.error("[pablo/webhook] interceptor cancelación falló:", err);
            }
          }

          // === INTERCEPTOR: GESTORÍA — "¿cómo va lo mío?" y "ya te lo he mandado" ===
          // Va ANTES del de agenda a propósito: una consulta de estado NO es una
          // cita, y si cayera en el interceptor de reserva acabaría ofreciendo
          // hueco a quien solo preguntaba por su renta. Solo entra si el tenant
          // es de sector gestoría, así que los otros cuatro ni pasan por aquí.
          if (modoGest?.gestoria) try {
            // Primero lo barato: si dice que ya ha mandado los papeles, se anota
            // en su expediente y no se le contesta un estado que no ha pedido.
            if (diceQueEnvioDocumentacion(text)) {
              const anotado = await anotarEnvioDeDocumentacion({ tenantId, telefono: from });
              if (anotado) {
                await sendWhatsAppText(from, anotado.texto);
                await appendTurn("pablo", tenantId, from, "user", text, customerName);
                await appendTurn("pablo", tenantId, from, "assistant", anotado.texto, customerName);
                await registrarIntercambio({
                  tenantId, msgId: msg.id, from, nombre: customerName,
                  entrante: text, respuesta: anotado.texto, rxTs, via: anotado.via,
                });
                continue;
              }
            }

            // ¿Pregunta por el estado? El clasificador de siempre con el bloque
            // de gestoría; `preguntaPorEstado` es el respaldo cuando no hay IA,
            // igual que `fallbackDetection` lo es para las citas.
            let esConsulta = preguntaPorEstado(text);
            let tramitePedido: string | undefined;
            if (process.env.ANTHROPIC_API_KEY) {
              const ig = await detectAppointmentIntent(text, new Date(), modoGest);
              if (ig.fields.consultaEstado) esConsulta = true;
              tramitePedido = ig.fields.tramite;
            }

            if (esConsulta) {
              const resp = await responderEstadoExpediente({ tenantId, telefono: from, tramitePedido });
              if (resp) {
                await sendWhatsAppText(from, resp.texto);
                await appendTurn("pablo", tenantId, from, "user", text, customerName);
                await appendTurn("pablo", tenantId, from, "assistant", resp.texto, customerName);
                await registrarIntercambio({
                  tenantId, msgId: msg.id, from, nombre: customerName,
                  entrante: text, respuesta: resp.texto, rxTs, via: resp.via,
                });
                continue;
              }
            }
          } catch (err) {
            console.error("[pablo/webhook] interceptor gestoría falló:", err);
          }

          if (sectorAgenda) try {
            // Los datos de la cita (nombre + servicio + día/hora) se reúnen a lo
            // largo de VARIOS turnos. Detectamos sobre el TRANSCRIPT completo de
            // la conversación + el mensaje actual, no solo el último mensaje
            // (eso es lo que hacía que Pablo "confirmara" sin registrar nada).
            const convForIntent = await getConversation("pablo", tenantId, from);
            const histTurns = (convForIntent?.turns ?? []).slice(-8);
            const transcript = [
              ...histTurns.map((t) => `${t.role === "user" ? "Cliente" : "Pablo"}: ${t.text}`),
              `Cliente: ${text}`,
            ].join("\n");

            // Detección única sobre el transcript.
            const intent = await detectAppointmentIntent(transcript, new Date(), modoRest);
            if (!intent.fields.nombre && customerName) {
              intent.fields.nombre = customerName;
              intent.missing = intent.missing.filter((m) => m !== "nombre");
            }

            // Guard de idempotencia: si esta cita ya está registrada para este
            // teléfono y esa hora, no la volvemos a reservar — caemos al flujo
            // normal para que Pablo responda con naturalidad.
            const complete =
              intent.wantsAppointment && intent.missing.length === 0 && !!intent.fields.startIso;
            if (complete && (await alreadyBookedForContact(tenantId, from, intent.fields.startIso!))) {
              // ya reservada → no re-reservar; sigue al flujo normal de Pablo.
              throw { __skip: true };
            }

            const idiomaCita = idiomaDe(text) === "en" ? "en" : "es";
            const agRes = await tryAgendarFromText({
              text: transcript,
              intentOverride: intent,
              agenteOrigen: "pablo",
              tenantId,
              redirectUri: `https://aiteam.marketing/api/lucia/callback`,
              customerPhone: from,
              customerNameFallback: customerName,
              modo: modoRest,
              // La confirmación va en ESTE mensaje (uno solo, no dos).
              confirmacionEnConversacion: true,
            });
            // Lo que se contesta en las ramas que no improvisan (y se corta el flujo).
            const contestar = async (resp: string, via: string) => {
              await sendWhatsAppText(from, resp);
              await appendTurn("pablo", tenantId, from, "user", text, customerName);
              await appendTurn("pablo", tenantId, from, "assistant", resp, customerName);
              await registrarIntercambio({ tenantId, msgId: msg.id, from, nombre: customerName, entrante: text, respuesta: resp, rxTs, via });
            };
            if (agRes.kind === "servicio_no_disponible") {
              const negocioSv = await getBusinessByTenant(tenantId);
              if (negocioSv) {
                await contestar(textoServicioNoDisponible(negocioSv, agRes.intent.fields.motivo, idiomaCita), "agenda_servicio_no_disponible");
                continue;
              }
            }
            if (agRes.kind === "error" && agRes.detail === "no_guardada") {
              await contestar(textoNoGuardada(idiomaCita), "agenda_no_guardada");
              continue;
            }
            if (agRes.kind === "agendada") {
              await cerrarGuion(tenantId, from);
              const when = formatStartHumanES(agRes.intent.fields.startIso!);
              const negocioAck = agRes.record ? await getBusinessByTenant(tenantId) : null;
              // UN mensaje con la cita tal como ha quedado GUARDADA (servicio real,
              // profesional, dirección y enlace para anular). El nombre, el que ha
              // dicho en la conversación antes que el de su perfil de WhatsApp.
              // Estilo de casa: sin emojis y sin signos de apertura en WhatsApp.
              const ack = agRes.record && negocioAck
                ? textoCitaGuardada({ record: agRes.record, negocio: negocioAck, nombre: agRes.intent.fields.nombre || customerName, idioma: idiomaCita })
                : `Listo${customerName ? `, ${customerName.split(" ")[0]}` : ""}. Te he agendado *${agRes.intent.fields.motivo}* el ${when}.\n\nSi necesitas cambiarla, dimelo y la movemos.`;
              await sendWhatsAppText(from, ack);
              await appendTurn("pablo", tenantId, from, "user", text, customerName);
              await appendTurn("pablo", tenantId, from, "assistant", ack, customerName);
              // Aquí sí se registraba, pero sin el texto: en el panel salía que
              // hubo mensajes y no cuáles. Ahora va por el mismo sitio que el resto.
              await registrarIntercambio({
                tenantId, msgId: msg.id, from, nombre: customerName,
                entrante: text, respuesta: ack, rxTs, via: "agenda_cita_creada",
              });
              continue;
            }
            if (agRes.kind === "slot_taken") {
              // --- RESTAURANTE: alternativas del turno y, tras dos rondas, lista de espera ---
              // Va en su propia rama y con `continue`, así que la rama de abajo
              // —la de los otros cuatro sectores— se queda literalmente igual.
              if (modoRest?.restaurante && agRes.intent.fields.startIso) {
                const pasoRest = await pasoRestauranteSinHueco({
                  tenantId,
                  intent: agRes.intent,
                  turnos: histTurns,
                  telefono: from,
                  nombreFallback: customerName,
                  redirectUri: `https://aiteam.marketing/api/lucia/callback`,
                });
                if (pasoRest) {
                  await sendWhatsAppText(from, pasoRest.texto);
                  await appendTurn("pablo", tenantId, from, "user", text, customerName);
                  await appendTurn("pablo", tenantId, from, "assistant", pasoRest.texto, customerName);
                  await registrarIntercambio({
                    tenantId, msgId: msg.id, from, nombre: customerName,
                    entrante: text, respuesta: pasoRest.texto, rxTs, via: pasoRest.via,
                  });
                  continue;
                }
              }
              // EL GUION: nunca "no tengo" a secas. Dos huecos reales cercanos; si
              // no le va ninguno, qué días le vienen bien; a la segunda ronda
              // fallida, el enlace de huecos libres. Ver `cita-por-chat.ts`.
              const oferta = await ofrecerAlternativas({
                tenantId, contacto: from, startIso: agRes.intent.fields.startIso!,
                motivo: agRes.intent.fields.motivo || "cita", nombre: agRes.intent.fields.nombre || customerName,
                porque: agRes.motivo, idioma: idiomaCita,
              });
              await sendWhatsAppText(from, oferta.texto);
              await appendTurn("pablo", tenantId, from, "user", text, customerName);
              // La memoria guarda LO QUE SE DIJO (las horas ofrecidas), para que la
              // IA entienda después un "vale, la de las 12".
              await appendTurn("pablo", tenantId, from, "assistant", oferta.texto, customerName);
              await registrarIntercambio({
                tenantId, msgId: msg.id, from, nombre: customerName,
                entrante: text, respuesta: oferta.texto, rxTs, via: oferta.via,
              });
              continue;
            }
            if (agRes.kind === "incomplete" && !modoRest?.restaurante) {
              // Ha dicho el servicio y el DÍA pero no la hora ("¿qué horas tenéis
              // el viernes?"): se le ofrecen huecos REALES de ese día, no se le
              // vuelve a preguntar el día. Con el servicio comprobado antes.
              const dia = agRes.missing.includes("fecha_hora") && agRes.intent.fields.motivo ? diaDeTexto(text) || diaDeTexto(transcript.split("\n").slice(-3).join(" ")) : "";
              const negocioDia = dia ? await getBusinessByTenant(tenantId) : null;
              if (dia && negocioDia) {
                const { servicioPedido } = await import("@/lib/booking");
                if (!servicioPedido(negocioDia, agRes.intent.fields.motivo!)) {
                  await contestar(textoServicioNoDisponible(negocioDia, agRes.intent.fields.motivo, idiomaCita), "agenda_servicio_no_disponible");
                  continue;
                }
                const oferta = await ofrecerAlternativas({
                  tenantId, contacto: from, startIso: `${dia}T00:00:00`, motivo: agRes.intent.fields.motivo!,
                  nombre: agRes.intent.fields.nombre || customerName, porque: "sin_hora", idioma: idiomaCita,
                });
                await contestar(oferta.texto, oferta.via);
                continue;
              }
              const q = idiomaCita === "en" ? preguntaFaltante(agRes.missing, "en") : missingFieldsToQuestion(agRes.missing, modoRest);
              if (q) {
                const respInc = idiomaCita === "en" ? `Sure, I'll book it for you. ${q}` : `Perfecto, te agendo cita. ${q}`;
                await contestar(respInc, "agenda_faltan_datos");
                continue;
              }
            }
            if (agRes.kind === "incomplete") {
              const q = missingFieldsToQuestion(agRes.missing, modoRest);
              if (q) {
                const respInc = `Perfecto, te agendo cita. ${q}`;
                await sendWhatsAppText(from, respInc);
                await appendTurn("pablo", tenantId, from, "user", text, customerName);
                await appendTurn("pablo", tenantId, from, "assistant", q, customerName);
                await registrarIntercambio({
                  tenantId, msgId: msg.id, from, nombre: customerName,
                  entrante: text, respuesta: respInc, rxTs, via: "agenda_faltan_datos",
                });
                continue;
              }
            }
            // kind === "no_intent" o "error" → caemos al flujo normal de Pablo
          } catch (err) {
            // `__skip` = cita ya registrada (idempotencia); no es un error.
            if (!(err && typeof err === "object" && "__skip" in err)) {
              console.error("[pablo/webhook] interceptor agenda falló:", err);
            }
          }

          // Memoria de conversación: si no hay turnos (o estaba stale → ya limpiado
          // on-read por getConversation), tratamos como primer mensaje.
          const conv = await getConversation("pablo", tenantId, from);
          const isNew = !conv || conv.turns.length === 0;

          // Prompt de Pablo, compuesto EN ESTE MOMENTO con el perfil de sector del
          // tenant + la identidad de su negocio. Es lo que hace que el mismo mensaje
          // suene distinto en un salón y en un gestoría.
          //
          // Excepción: la cuenta comercial de AI-Team (sector null) sigue con el
          // prompt de venta de siempre — no es un negocio de cliente.
          let sectorSystem = PABLO_SYSTEM;
          try {
            const persona = await resolverPersona({ tenantId, agente: "pablo", canal: "whatsapp" });
            if (persona.sector) {
              sectorSystem = persona.system;
            } else {
              const sector = await getTenantSector(tenantId);
              const ficha = await getFicha(tenantId);
              sectorSystem = buildSectorSystem(sector, ficha ? fichaToPromptContext(ficha) : undefined);
            }
          } catch (err) {
            console.error("[pablo/webhook] no se pudo componer la persona, uso default:", err);
          }
          let reply = await generateReply(text, customerName, isNew, conv, sectorSystem);
          // NUNCA SE CONFIRMA LO QUE NO SE HA GUARDADO. Aquí (respuesta libre del
          // modelo) no se ha reservado nada en este mensaje: si el modelo dice
          // "te he agendado", es falso y se cambia por la pregunta que falta.
          if (sectorAgenda && confirmaCitaSinGuardar(reply)) {
            console.warn(`[pablo/webhook] respuesta que confirmaba una cita SIN guardarla, cambiada: "${reply.slice(0, 160)}"`);
            reply = idiomaDe(text) === "en"
              ? "To book it I need the service, the day and the time. Which would you like?"
              : "Para dejarte la cita guardada necesito el servicio, el día y la hora. Qué te viene bien?";
          }
          console.log(`[pablo/webhook] AI reply: "${reply}"`);

          // === LEAD CUALIFICADO: solo estética. No intercepta nada — Pablo
          // sigue la conversación exactamente igual, esto solo apunta el lead
          // para que la pestaña "Leads y valoraciones" y el chat del panel
          // puedan enseñar a quién hay que coger hoy. Mismo patrón, misma
          // colocación y mismas garantías que la ruta de urgencia de dental de
          // más arriba: NO se espera (`.catch(() => {})` sin `await`), así que
          // si falla o tarda no bloquea ni retrasa la respuesta al cliente.
          //
          // La señal ya existía y nadie la leía: el prompt de Pablo (ver
          // `claude.ts`) le pide que, cuando detecte un lead cualificado,
          // cierre con `[🎯 Lead cualificado: …]`. Se escribía, se enviaba al
          // cliente dentro del mensaje y se perdía ahí.
          if (esEstetica) {
            const resumen = detectarLeadCualificado(reply);
            if (resumen) {
              marcarLeadCualificado(tenantId, {
                telefono: from,
                nombre: customerName,
                resumen,
                canal: "pablo",
              }).catch(() => {});
            }
            // El marcador es de uso interno — nunca debe llegar al cliente.
            reply = quitarMarcadorLeadCualificado(reply);
          }

          // Enviar de vuelta vía Graph API
          const sendResult = await sendWhatsAppText(from, reply);

          // Persistir turno del usuario y de la IA (después de enviar OK, evita
          // guardar interacciones que nunca llegaron al usuario).
          await appendTurn("pablo", tenantId, from, "user", text, customerName);
          await appendTurn("pablo", tenantId, from, "assistant", reply, customerName);

          // Eventos del informe mensual y de la bandeja (silenciosos ante fallos).
          await registrarIntercambio({
            tenantId, msgId: msg.id, from, nombre: customerName,
            entrante: text, respuesta: reply, rxTs, via: "ia",
          });
          console.log(
            `[pablo/webhook] TX result:`,
            JSON.stringify(sendResult).slice(0, 500),
          );
        }
      }
    }
  } catch (err) {
    console.error("[pablo/webhook] error procesando POST:", err);
    // Devolvemos 200 igualmente: si devolvemos error, Meta reintenta.
  }

  return NextResponse.json({ ok: true });
}

// -----------------------------------------------------------------------------
// Generar respuesta con Claude
// -----------------------------------------------------------------------------
async function generateReply(
  message: string,
  customerName: string | undefined,
  firstMessage: boolean,
  conv: Conversation | null,
  systemPrompt: string = PABLO_SYSTEM,
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "Hola, hemos recibido tu mensaje. Te respondemos en breve.";
  }

  // Reconstruimos el historial previo (sin el mensaje actual) como turnos
  // alternados user/assistant. Si la API rechazara dos turnos seguidos del
  // mismo rol (caso poco probable con webhook real), el último user se
  // fusiona con el mensaje actual abajo.
  const history = (conv?.turns ?? []).map((t) => ({
    role: t.role,
    content: t.text,
  }));

  const currentUserContent =
    `${firstMessage ? "[PRIMER MENSAJE]" : "[CONVERSACIÓN YA INICIADA]"}\n` +
    (customerName
      ? `Mensaje de ${customerName}:\n"${message}"`
      : `Mensaje recibido:\n"${message}"`);

  try {
    const ai = await anthropic.messages.create({
      model: MODELS.fast, // Claude Haiku 4.5
      max_tokens: 400,
      system: systemPrompt,
      messages: [
        ...history,
        { role: "user", content: currentUserContent },
      ],
    });

    const text = ai.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();
    return text || "¡Hola! Hemos recibido tu mensaje, te respondemos en breve.";
  } catch (err) {
    console.error("[pablo/webhook] error generando respuesta IA:", err);
    return "¡Hola! Hemos recibido tu mensaje, te respondemos en cuanto podamos.";
  }
}

// -----------------------------------------------------------------------------
// Enviar mensaje vía WhatsApp Cloud API
// -----------------------------------------------------------------------------
async function sendWhatsAppText(to: string, body: string): Promise<unknown> {
  // Por el número que RECIBIÓ el mensaje (lo fija el POST con `usarNumeroEmisor`),
  // no por el de AI-Team: ver `whatsapp-sender.ts`.
  const phoneNumberId = await numeroEmisor();
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    console.error("[pablo/webhook] faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN");
    return { error: "missing credentials" };
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body, preview_url: false },
  };

  // EL CANDADO (ver src/lib/meta-graph-local.ts): en local esto no sale a Meta.
  // Pablo contesta a clientes de verdad; un token real en el portátil y este
  // `fetch` le manda un WhatsApp a alguien mientras se está programando.
  const base = baseGraph(GRAPH_VERSION);
  if (!base) {
    simulado("pablo/webhook", { to, body });
    return { simulado: true };
  }
  const endpoint = `${base}/${phoneNumberId}/messages`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[pablo/webhook] Graph API ${res.status}:`, json);
    }
    return json;
  } catch (err) {
    console.error("[pablo/webhook] fetch Graph API falló:", err);
    return { error: err instanceof Error ? err.message : "fetch failed" };
  }
}


/**
 * El audio de Jose: se transcribe, se entiende y se CONFIRMA POR ESCRITO.
 *
 * La confirmación no es cortesía: es cómo el gestor se entera de que Pablo ha
 * oído "Bar El Puerto" donde él dijo "Bar del Puerto". Se manda siempre, tanto
 * si se apunta algo como si no.
 */
async function atenderAudioDelGestor(opts: {
  tenantId: string; telefono: string; mediaId: string; mime: string;
}): Promise<string> {
  const media = await descargarMedia(opts.mediaId);
  if (!media) {
    const m = "no he podido bajar el audio. me lo escribes?";
    await sendWhatsAppText(opts.telefono, m);
    return m;
  }

  const tr = await transcribir(media.buffer, media.mime || opts.mime);
  if (!tr.ok) {
    console.warn(`[pablo/webhook] no se ha transcrito el audio: ${tr.error}`);
    const m = "no he podido entender el audio. me lo escribes?";
    await sendWhatsAppText(opts.telefono, m);
    return m;
  }

  const { listarClientes } = await import("@/lib/gestoria-clientes");
  const { apuntarTarea, listarTareas, esRojo, diasHasta } = await import("@/lib/gestoria-hoy");
  const clientes = await listarClientes(opts.tenantId).catch(() => []);
  const intencion = await entender(tr.texto, clientes.map((c) => ({ id: c.id, nombre: c.nombre })));

  let respuesta: string;

  if (intencion.tipo === "recordatorio") {
    const cliente = clientes.find((c) => c.nombre === intencion.clienteNombre) ?? null;
    await apuntarTarea(opts.tenantId, {
      titulo: intencion.titulo,
      detalle: `Dictado por WhatsApp: "${tr.texto}"`,
      vence: intencion.vence,
      clienteId: cliente?.id ?? null,
      clienteNombre: cliente?.nombre ?? null,
      origen: "whatsapp",
      urgente: intencion.urgente,
    });
    respuesta = [
      "apuntado:",
      `- ${intencion.titulo}`,
      intencion.clienteNombre ? `cliente: ${intencion.clienteNombre}` : "sin cliente",
      intencion.vence ? `vence: ${intencion.vence}` : "sin fecha",
      intencion.urgente ? "marcado urgente, sube arriba del todo" : "",
      "si he entendido mal algo, dimelo y lo cambio.",
    ].filter(Boolean).join("\n");
  } else if (intencion.tipo === "pregunta" && intencion.sobre === "hoy") {
    const tareas = (await listarTareas(opts.tenantId)).filter((t) => !t.hecho);
    if (!tareas.length) {
      respuesta = "hoy no tienes nada pendiente.";
    } else {
      const rojas = tareas.filter(esRojo);
      const dia = (v?: string | null) => {
        const d = diasHasta(v);
        if (d === null) return "sin plazo";
        if (d < 0) return `vencio hace ${-d}`;
        if (d === 0) return "hoy";
        if (d === 1) return "mañana";
        return `en ${d} dias`;
      };
      respuesta = [
        `tienes ${tareas.length} cosa${tareas.length === 1 ? "" : "s"}${rojas.length ? `, ${rojas.length} para hoy o mañana` : ""}:`,
        tareas.slice(0, 6).map((t) => `- ${t.titulo}${t.clienteNombre ? ` (${t.clienteNombre})` : ""}, ${dia(t.vence)}`).join("\n"),
        tareas.length > 6 ? `y ${tareas.length - 6} mas en el panel.` : "",
      ].filter(Boolean).join("\n\n");
    }
  } else {
    respuesta = `he entendido: "${tr.texto}". no se si quieres que lo apunte o que te conteste algo. dimelo y lo hago.`;
  }

  await sendWhatsAppText(opts.telefono, respuesta);
  console.log(`[pablo/webhook] audio del gestor (${intencion.tipo}): "${tr.texto.slice(0, 80)}"`);
  return respuesta;
}
