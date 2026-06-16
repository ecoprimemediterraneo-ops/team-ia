"use server";

// Server actions del panel LIVE de Marta para el cliente.
// Auth: cualquier usuario con sesión (no solo fundador). El tenantId se
// resuelve desde la sesión — hoy todo va al tenant fundador (single-tenant
// real en producción); cuando exista mapping email→tenantId se cambia aquí.

import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";
import { generateArranque } from "@/lib/marta-arranque";
import { generarCaption } from "@/lib/marta-caption";
import { revalidatePath } from "next/cache";
import { createProposal, findProposalById, markProposalRejected } from "@/lib/marta-proposals";
import { generatePostImage, styleExistingPhoto } from "@/lib/marta-image-gen";
import { publishProposal } from "@/lib/marta-publish-flow";
import { regenerateProposal } from "@/lib/marta-regen";
import { classifyClientReply } from "@/lib/marta-intent";
import { saveSchedule, runSchedule, type ApprovalMode } from "@/lib/marta-schedule";
import {
  saveCommentRule,
  deleteCommentRule,
  setCommentRuleEnabled,
  getCommentRules,
  findMatchingRule,
  renderDmTemplate,
  isCommentDmEnabled,
  type CommentRule,
  type MatchMode,
} from "@/lib/marta-comment-rules";
import { openRoute } from "@/lib/wa-route";
import { resolveTopic } from "@/lib/marta-topics";
import {
  sendWhatsAppImage,
  sendWhatsAppText,
  sendWhatsAppVideo,
} from "@/lib/whatsapp-sender";
import type { ProposalMediaType, MartaProposal } from "@/lib/marta-proposals";
import type { ArranqueState, ProposalState } from "./types";

async function gateTenantId(): Promise<string | null> {
  const s = await getSession();
  if (!s) return null;
  // Single-tenant durante la beta. Mapping email→tenantId va aquí cuando exista.
  return DEFAULT_TENANT_ID;
}

// -----------------------------------------------------------------------------
// Arranque (BIO + N posts)
// -----------------------------------------------------------------------------

export async function arranqueClientAction(
  _prev: ArranqueState,
  formData: FormData,
): Promise<ArranqueState> {
  const tenantId = await gateTenantId();
  if (!tenantId) return { ts: Date.now(), variant: "error", title: "Inicia sesión" };

  const countRaw = parseInt(String(formData.get("count") || "6"), 10);
  const count = Math.min(Math.max(Number.isFinite(countRaw) ? countRaw : 6, 1), 9);

  const result = await generateArranque(tenantId, count);
  if (!("ok" in result) || !result.ok) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "No se pudo generar el arranque",
      detail: "ok" in result ? "" : (result as { detail?: string }).detail || "",
    };
  }
  return {
    ts: Date.now(),
    variant: "ok",
    title: `Generado: BIO + ${result.drafts.length} posts`,
    detail: result.errors.length ? `${result.errors.length} aviso(s).` : "Todo listo para revisar.",
    bio: result.bio.ok ? result.bio.bio : `(bio no generada: ${result.bio.detail})`,
    drafts: result.drafts,
    warnings: result.errors,
  };
}

// -----------------------------------------------------------------------------
// Nueva propuesta → WhatsApp → aprobación → publicación
// -----------------------------------------------------------------------------

export async function nuevaPropuestaClientAction(
  _prev: ProposalState,
  formData: FormData,
): Promise<ProposalState> {
  const tenantId = await gateTenantId();
  if (!tenantId) return { ts: Date.now(), variant: "error", title: "Inicia sesión" };

  // Canal de aprobación: "app" (revisar en el panel) o "whatsapp".
  const canal = String(formData.get("canal") || "app").trim() === "whatsapp" ? "whatsapp" : "app";
  const recipient = String(formData.get("recipient") || "").replace(/\D/g, "");
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  // "tema" ahora es la KEY de un tema predefinido (desplegable).
  const topic = resolveTopic(String(formData.get("tema") || "auto").trim());
  const contextoTexto = String(formData.get("contextoTexto") || "").trim();
  const fotoBriefUser = String(formData.get("fotoBrief") || "").trim();
  // Asunto del caption = el del tema (vacío en "auto" → lo elige la IA).
  const tema = topic.captionTema;
  // Contexto de imagen = guion visual del tema + lo que escriba el cliente.
  const fotoBrief = [topic.imageBrief, fotoBriefUser].filter(Boolean).join(" ");
  const mediaTypeRaw = String(formData.get("mediaType") || "IMAGE").trim().toUpperCase();
  const mediaType: ProposalMediaType =
    mediaTypeRaw === "REELS"
      ? "REELS"
      : mediaTypeRaw === "STORIES_IMAGE"
        ? "STORIES_IMAGE"
        : mediaTypeRaw === "STORIES_VIDEO"
          ? "STORIES_VIDEO"
          : "IMAGE";
  const isVideo = mediaType === "REELS" || mediaType === "STORIES_VIDEO";

  // El número solo es obligatorio si la aprobación va por WhatsApp.
  if (canal === "whatsapp" && !recipient) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "Falta tu número de WhatsApp",
      detail: "Pon tu número con prefijo (ej. 34600111222) o cambia a «Revisar en la app».",
    };
  }
  const hasUrl = /^https?:\/\//.test(imageUrl);

  // Vídeo (reel / story vídeo): el cliente DEBE subir el vídeo. No se genera.
  if (isVideo && !hasUrl) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "Falta el vídeo",
      detail: "Para reels y stories de vídeo tienes que pegar la URL pública del MP4 (no se genera con IA).",
    };
  }

  // -------------------------------------------------------------------------
  // MODO MEZCLA — resolver la imagen final:
  //   imagen + URL  → estilizar la foto del cliente con el estilo de la ficha
  //   imagen sin URL → generar con IA (DALL·E) usando toda la ficha
  //   vídeo          → usar la URL tal cual (subida por el cliente)
  // -------------------------------------------------------------------------
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  let finalUrl = imageUrl;
  let imageSource: MartaProposal["imageSource"] = "subida";
  let imagePrompt: string | undefined;

  if (!isVideo) {
    const isStory = mediaType === "STORIES_IMAGE";
    if (hasUrl) {
      // Estilizar la foto pegada con el estilo de la ficha (si falla, original).
      const styled = await styleExistingPhoto({ tenantId, url: imageUrl, baseUrl });
      if (styled.ok) {
        finalUrl = styled.url;
        imageSource = "subida_estilizada";
      } else {
        finalUrl = imageUrl;
        imageSource = "subida";
        console.warn(`[dashboard/marta/action] estilizado falló, uso foto original: ${styled.detail}`);
      }
    } else {
      // Generar con IA usando TODA la ficha.
      const gen = await generatePostImage({
        tenantId,
        tema: tema || undefined,
        contexto: fotoBrief || undefined, // guion visual del tema + descripción del cliente
        mediaType: isStory ? "STORIES_IMAGE" : "IMAGE",
        baseUrl,
      });
      if (!gen.ok) {
        return {
          ts: Date.now(),
          variant: "error",
          title: "No se pudo generar la imagen",
          detail: `[${gen.reason}] ${gen.detail}`,
        };
      }
      finalUrl = gen.url;
      imageSource = "generada_ia";
      imagePrompt = gen.prompt;
    }
  } else {
    imageSource = "video_subido";
  }

  // 1) Caption desde la ficha.
  const cap = await generarCaption({ tenantId, tema: tema || undefined, contexto: contextoTexto || undefined });
  if (!cap.ok) {
    console.error(`[dashboard/marta/action] generarCaption falló: reason=${cap.reason} detail=${cap.detail}`);
    return {
      ts: Date.now(),
      variant: "error",
      title: "No se pudo generar el texto",
      detail: `[${cap.reason}] ${cap.detail || "Revisa la ficha y la API key de Anthropic."}`,
    };
  }
  const caption = cap.caption;

  // 2) Crear propuesta. En modo "app" NO guardamos número (se revisa en el
  //    panel); en modo "whatsapp" sí, para el flujo de aprobación por chat.
  const proposal = await createProposal({
    tenantId,
    recipientWhatsapp: canal === "whatsapp" ? recipient : "",
    imageUrl: finalUrl,
    caption,
    mediaType,
    imageSource,
    imagePrompt,
    tema: tema || undefined,
    contexto: contextoTexto || undefined,
    fotoBrief: fotoBrief || undefined,
    regenCount: 0,
  });

  // 3a) Modo APP: la propuesta queda lista para revisar/aprobar en el panel.
  if (canal === "app") {
    revalidatePath("/dashboard/marta");
    return {
      ts: Date.now(),
      variant: "ok",
      title: "Propuesta lista para revisar ✅",
      detail: "Ábrela abajo: puedes publicarla, pedir cambios o descartarla sin salir de la app.",
      caption,
      proposalId: proposal.id,
      reviewInApp: true,
    };
  }

  // 3b) Modo WHATSAPP: abrir sesión de ruteo + enviar al cliente.
  await openRoute(recipient, "marta", proposal.id);
  const mediaRes = isVideo
    ? await sendWhatsAppVideo(recipient, finalUrl, caption)
    : await sendWhatsAppImage(recipient, finalUrl, caption);
  if (!mediaRes.ok) {
    return {
      ts: Date.now(),
      variant: "error",
      title: isVideo
        ? "No se pudo enviar el vídeo por WhatsApp"
        : "No se pudo enviar la imagen por WhatsApp",
      detail: `${mediaRes.reason}: ${mediaRes.detail}`,
      caption,
      proposalId: proposal.id,
      recipient,
    };
  }
  const askLabel =
    mediaType === "REELS"
      ? "Reel"
      : mediaType === "STORIES_IMAGE" || mediaType === "STORIES_VIDEO"
        ? "Story"
        : "post";
  await sendWhatsAppText(
    recipient,
    `¿Publico este ${askLabel}? Responde OK para publicar o dime qué cambiar (foto, texto o descartar).`,
  );

  const sourceLabel =
    imageSource === "generada_ia"
      ? "🎨 Imagen generada con IA desde tu ficha."
      : imageSource === "subida_estilizada"
        ? "🖼️ Tu foto, con el estilo de la ficha aplicado."
        : imageSource === "video_subido"
          ? "🎬 Vídeo que subiste."
          : "🖼️ Tu foto.";

  return {
    ts: Date.now(),
    variant: "ok",
    title: "Propuesta enviada a tu WhatsApp ✅",
    detail:
      `${sourceLabel} Cuando respondas OK, Marta publica en Instagram. Si quieres cambios, dile lo que cambiarías y prepara otra.`,
    caption,
    proposalId: proposal.id,
    recipient,
  };
}

// =============================================================================
// Acciones IN-APP sobre una propuesta (sin WhatsApp).
// Devuelven { ok, message } y revalidan el panel.
// =============================================================================

export type InAppResult = { ok: boolean; message: string };

function baseUrlFromEnv(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://aiteam.marketing";
}

/** Aprobar y publicar la propuesta en Instagram desde la app. */
export async function aprobarYPublicarAction(proposalId: string): Promise<InAppResult> {
  const tenantId = await gateTenantId();
  if (!tenantId) return { ok: false, message: "Inicia sesión." };
  const proposal = await findProposalById(tenantId, proposalId);
  if (!proposal) return { ok: false, message: "No encuentro esa propuesta." };
  if (proposal.status !== "pending") return { ok: false, message: "Esta propuesta ya no está pendiente." };

  const pub = await publishProposal(proposal);
  revalidatePath("/dashboard/marta");
  if (pub.ok) {
    return { ok: true, message: pub.permalink ? `¡Publicado! ${pub.permalink}` : "¡Publicado! 🎉" };
  }
  if (pub.kind === "disabled") {
    return { ok: false, message: "La publicación está desactivada (MARTA_PUBLISH_ENABLED). Actívala para publicar." };
  }
  return { ok: false, message: `Instagram rechazó la publicación: ${pub.detail}` };
}

/** Pedir cambios in-app: regenera la propuesta con la instrucción dada. */
export async function pedirCambiosAction(proposalId: string, instruccion: string): Promise<InAppResult> {
  const tenantId = await gateTenantId();
  if (!tenantId) return { ok: false, message: "Inicia sesión." };
  const instr = (instruccion || "").trim();
  if (!instr) return { ok: false, message: "Escribe qué quieres cambiar." };
  const proposal = await findProposalById(tenantId, proposalId);
  if (!proposal) return { ok: false, message: "No encuentro esa propuesta." };
  if (proposal.status !== "pending") return { ok: false, message: "Esta propuesta ya no está pendiente." };

  // Clasificamos la instrucción para saber qué regenerar (foto/caption).
  const cls = await classifyClientReply(instr);
  const changeFoto = cls.changeFoto ?? (cls.intent === "cambiar_foto");
  const changeCaption = cls.changeCaption ?? (cls.intent === "cambiar_caption");
  // Si no marcó nada concreto, regeneramos ambos (es una petición de cambio explícita).
  const regen = await regenerateProposal({
    proposal,
    changeFoto: changeFoto || (!changeFoto && !changeCaption),
    changeCaption: changeCaption || (!changeFoto && !changeCaption),
    feedback: instr,
    baseUrl: baseUrlFromEnv(),
  });

  if (regen.kind === "ok") {
    // La nueva propuesta (nuevo id) es la pendiente; cancelamos la anterior in-app.
    if (!proposal.recipientWhatsapp) await markProposalRejected(proposal);
    revalidatePath("/dashboard/marta");
    return { ok: true, message: "Nueva versión lista. Revísala abajo." };
  }
  if (regen.kind === "limit") return { ok: false, message: "Llegaste al límite de regeneraciones. Publica o descarta." };
  if (regen.kind === "needs_video") return { ok: false, message: "Para cambiar el vídeo, sube un MP4 nuevo." };
  return { ok: false, message: `No se pudo regenerar: ${regen.detail}` };
}

/** Descartar la propuesta. */
export async function descartarAction(proposalId: string): Promise<InAppResult> {
  const tenantId = await gateTenantId();
  if (!tenantId) return { ok: false, message: "Inicia sesión." };
  const proposal = await findProposalById(tenantId, proposalId);
  if (!proposal) return { ok: false, message: "No encuentro esa propuesta." };
  await markProposalRejected(proposal);
  revalidatePath("/dashboard/marta");
  return { ok: true, message: "Propuesta descartada." };
}

// =============================================================================
// Programación automática (pestaña "Programación")
// =============================================================================

export type ProgramacionInput = {
  enabled: boolean;
  daysOfWeek: number[]; // 0=Domingo … 6=Sábado
  hour: number; // 0-23 hora Europe/Madrid
  mode: ApprovalMode;
  postsPerRun: number;
  tema: string;
};

/** Guardar la regla de programación del cliente. */
export async function guardarProgramacionAction(input: ProgramacionInput): Promise<InAppResult> {
  const tenantId = await gateTenantId();
  if (!tenantId) return { ok: false, message: "Inicia sesión." };

  const hour = Math.min(Math.max(Math.trunc(input.hour ?? 10), 0), 23);
  const days = [...new Set((input.daysOfWeek ?? []).filter((d) => d >= 0 && d <= 6))].sort();
  const postsPerRun = Math.min(Math.max(Math.trunc(input.postsPerRun ?? 1), 1), 3);
  // Solo "avisar" está operativo; "directo" se acepta pero el runtime lo trata
  // como "avisar" hasta confirmar instagram_content_publish.
  const mode: ApprovalMode = input.mode === "directo" ? "directo" : "avisar";

  if (input.enabled && days.length === 0) {
    return { ok: false, message: "Elige al menos un día de la semana." };
  }

  await saveSchedule(tenantId, {
    enabled: !!input.enabled,
    daysOfWeek: days,
    hour,
    mode,
    postsPerRun,
    tema: input.tema || "auto",
  });
  revalidatePath("/dashboard/marta");
  return { ok: true, message: "Programación guardada ✅" };
}

/** Ejecutar la programación AHORA (ignora día/hora) para probar el ciclo. */
export async function ejecutarProgramacionAhoraAction(): Promise<InAppResult> {
  const tenantId = await gateTenantId();
  if (!tenantId) return { ok: false, message: "Inicia sesión." };
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  const res = await runSchedule(tenantId, { baseUrl, force: true });
  revalidatePath("/dashboard/marta");
  if (res.created > 0) {
    return {
      ok: true,
      message: `Generada(s) ${res.created} propuesta(s) pendiente(s). Ábrelas en Historial para aprobar.`,
    };
  }
  return {
    ok: false,
    message: `No se generó ninguna propuesta. ${res.details.join(" · ") || "Revisa las API keys de imagen/caption."}`,
  };
}

// =============================================================================
// Comentario → DM (pestaña "Comentarios → DM") — la función estrella de ManyChat
// =============================================================================

function parseKeywords(raw: string): string[] {
  return (raw || "")
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

export type ReglaComentarioInput = {
  id?: string;
  enabled: boolean;
  keywordsRaw: string; // separadas por coma o salto de línea
  matchMode: MatchMode;
  dmMessage: string;
  scope: string; // "all" o un media id concreto
  replyPublic: boolean;
  publicReplyText?: string;
};

/** Crear / actualizar una regla de Comentario → DM. */
export async function guardarReglaComentarioAction(
  input: ReglaComentarioInput,
): Promise<InAppResult & { rule?: CommentRule }> {
  const tenantId = await gateTenantId();
  if (!tenantId) return { ok: false, message: "Inicia sesión." };

  const keywords = parseKeywords(input.keywordsRaw);
  if (keywords.length === 0) {
    return { ok: false, message: "Añade al menos una palabra clave que dispare el DM." };
  }
  if (!input.dmMessage.trim()) {
    return { ok: false, message: "Escribe el mensaje del primer DM." };
  }

  const rule = await saveCommentRule(tenantId, {
    id: input.id,
    enabled: input.enabled,
    keywords,
    matchMode: input.matchMode === "exacto" ? "exacto" : "contiene",
    dmMessage: input.dmMessage.trim(),
    scope: input.scope?.trim() || "all",
    replyPublic: !!input.replyPublic,
    publicReplyText: input.publicReplyText,
  });

  revalidatePath("/dashboard/marta");
  return { ok: true, message: input.id ? "Regla actualizada ✅" : "Regla creada ✅", rule };
}

/** Activar / desactivar una regla. */
export async function toggleReglaComentarioAction(
  id: string,
  enabled: boolean,
): Promise<InAppResult> {
  const tenantId = await gateTenantId();
  if (!tenantId) return { ok: false, message: "Inicia sesión." };
  const r = await setCommentRuleEnabled(tenantId, id, enabled);
  if (!r) return { ok: false, message: "No encuentro esa regla." };
  revalidatePath("/dashboard/marta");
  return { ok: true, message: enabled ? "Regla activada ✅" : "Regla desactivada." };
}

/** Eliminar una regla. */
export async function eliminarReglaComentarioAction(id: string): Promise<InAppResult> {
  const tenantId = await gateTenantId();
  if (!tenantId) return { ok: false, message: "Inicia sesión." };
  const ok = await deleteCommentRule(tenantId, id);
  revalidatePath("/dashboard/marta");
  return ok
    ? { ok: true, message: "Regla eliminada." }
    : { ok: false, message: "No encuentro esa regla." };
}

export type ProbarComentarioResult = {
  ok: boolean;
  message: string;
  matched: boolean;
  ruleId?: string;
  dm?: string;
  willSend?: boolean;
  replyPublic?: boolean;
  publicReplyText?: string;
};

/**
 * Simula un comentario (dry-run): comprueba qué regla casaría y muestra el DM
 * que Marta enviaría — SIN llamar a Meta. Es el equivalente al "Ejecutar ahora"
 * de la programación, pero seguro: nunca manda nada real.
 */
export async function probarComentarioAction(input: {
  text: string;
  mediaId?: string;
}): Promise<ProbarComentarioResult> {
  const tenantId = await gateTenantId();
  if (!tenantId) return { ok: false, matched: false, message: "Inicia sesión." };

  const text = (input.text || "").trim();
  if (!text) {
    return { ok: false, matched: false, message: "Escribe un comentario de prueba." };
  }

  const rules = await getCommentRules(tenantId);
  const mediaId = input.mediaId && input.mediaId.trim() ? input.mediaId.trim() : undefined;
  const rule = findMatchingRule(rules, text, mediaId);

  if (!rule) {
    return {
      ok: true,
      matched: false,
      message: "Ninguna regla casa con ese comentario. Revisa palabras clave, modo y el post (scope).",
    };
  }

  const dm = renderDmTemplate(rule.dmMessage, { usuario: "cliente_demo" });
  const willSend = isCommentDmEnabled();
  return {
    ok: true,
    matched: true,
    ruleId: rule.id,
    dm,
    willSend,
    replyPublic: rule.replyPublic,
    publicReplyText: rule.publicReplyText,
    message: willSend
      ? "✅ Coincide. En real, Marta enviaría este DM al instante:"
      : "✅ Coincide. (Envío aún desactivado hasta el App Review de Meta — este es el DM que mandaría)",
  };
}
