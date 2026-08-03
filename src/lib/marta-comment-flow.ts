// El camino completo de un comentario de Instagram: de que llega el webhook a
// que sale el DM y la respuesta pública en el hilo.
//
// Estaba dentro de `api/marta/webhook/route.ts`. Se saca aquí por una razón
// concreta: el único modo de ejecutarlo era ir a Instagram y comentar a mano, y
// un camino que no se puede disparar tampoco se puede diagnosticar. Ahora lo
// llaman los dos: el webhook de verdad y /api/admin/marta-probar-comentario.
//
// FLUJO:
//   1. Ignoramos comentarios propios de la cuenta y duplicados (dedup por id).
//   2. Buscamos la primera regla habilitada que casa (keyword + scope).
//   3. Respuesta PÚBLICA al comentario (si la regla la pide). Va PRIMERO porque
//      es lo que se ve en el post: quien mira el hilo entiende que le han
//      contestado, y es el orden que se graba para el App Review de Meta.
//   4. PRIMER DM = plantilla fija de la regla, vía PRIVATE REPLY
//      (recipient.comment_id → exento de la ventana de 24h, mecanismo ManyChat).
//   5. Sembramos la conversación con ese DM como turno "assistant", para que si
//      el usuario responde por privado, el motor de IA de DMs siga el hilo.
//
// Los pasos 3 y 4 son independientes: si uno falla, el otro se intenta igual y
// el fallo queda en el log Y en el event-log. Peor que no contestar es contestar
// a medias sin que nadie se entere — que es exactamente lo que pasaba.
//
// El envío real está gated POR TENANT (ver `isCommentDmEnabled`): encendido para
// el tenant propio, apagado para el resto mientras Meta no apruebe
// instagram_manage_comments + instagram_business_manage_messages. Apagado, se
// detecta y se registra la coincidencia pero NO se llama a Meta.

import "server-only";
import { appendTurn } from "./conversation-store";
import { logEvent, makeEventId } from "./event-log";
import {
  getCommentRules,
  findMatchingRule,
  findMatchingRules,
  renderDmTemplate,
  markCommentProcessed,
  isCommentDmEnabled,
  type CommentRule,
} from "./marta-comment-rules";
import {
  replyToComment,
  sendInstagramPrivateReply,
  type ResultadoRespuestaPublica,
} from "./marta-graph";

export const TEXTO_PUBLICO_POR_DEFECTO = "¡Te acabo de escribir por privado! 📩";

async function safeLogEvent(...args: Parameters<typeof logEvent>): Promise<void> {
  try {
    await logEvent(...args);
  } catch (err) {
    console.error("[marta/comment] event log error:", err);
  }
}

export type ComentarioEntrante = {
  commentId: string;
  text: string;
  fromId?: string;
  username?: string;
  mediaId?: string;
};

export type OpcionesComentario = {
  /** No llama a Meta: resuelve reglas y dice qué haría. Para probar en seco. */
  simular?: boolean;
  /** Salta el dedup por commentId, para poder repetir la misma prueba. */
  saltarDedup?: boolean;
};

/** Por qué se paró el camino, cuando se para. */
export type MotivoParada =
  | "sin_id_o_texto"
  | "comentario_propio"
  | "duplicado"
  | "sin_regla"
  | "envio_apagado";

export type ResultadoComentario = {
  ok: boolean;
  parado?: MotivoParada;
  detalle: string;
  tenantId: string;
  /** La regla que GANA. Si hay varias que casan, es la primera por prioridad. */
  regla?: Pick<CommentRule, "id" | "keywords" | "scope" | "replyPublic" | "publicReplyText">;
  /**
   * TODAS las reglas que casan, en orden de prioridad. Con más de una, la que
   * manda es la primera: si esa tiene `replyPublic: false` no hay respuesta
   * pública por mucho que otra regla que también casa la tenga activada.
   */
  reglasQueCasan?: Array<{ id: string; replyPublic: boolean; scope: string }>;
  dm?: { texto: string; enviado: boolean; resultado?: unknown };
  publica?: {
    pedida: boolean;
    texto?: string;
    enviada: boolean;
    resultado?: ResultadoRespuestaPublica;
  };
};

/**
 * Procesa un comentario entrante de punta a punta.
 *
 * Devuelve el detalle de lo que ha pasado en cada paso en vez de `void`: el
 * webhook lo usa para loguear y la ruta de prueba para enseñarlo tal cual.
 */
export async function procesarComentario(
  tenantId: string,
  entryId: string | undefined,
  c: ComentarioEntrante,
  opts: OpcionesComentario = {},
): Promise<ResultadoComentario> {
  const { commentId, text, fromId, username, mediaId } = c;
  const base = { ok: false, tenantId } as const;

  if (!commentId || !text.trim()) {
    console.log("[marta/comment] comentario sin id/texto ignorado");
    return { ...base, parado: "sin_id_o_texto", detalle: "El comentario no trae id o viene vacío." };
  }

  // 1a. Ignorar comentarios de la propia cuenta (no autorresponderse).
  const ownId = entryId || process.env.INSTAGRAM_USER_ID;
  if (fromId && ownId && fromId === ownId) {
    console.log("[marta/comment] comentario propio ignorado");
    return { ...base, parado: "comentario_propio", detalle: "Es un comentario de la propia cuenta." };
  }

  // 1b. Dedup por comment.id (anti doble-DM si Meta reentrega el webhook).
  if (!opts.saltarDedup) {
    const isNew = await markCommentProcessed(tenantId, commentId);
    if (!isNew) {
      console.log(`[marta/comment] comentario duplicado ignorado id=${commentId}`);
      return { ...base, parado: "duplicado", detalle: `El comentario ${commentId} ya se procesó (dedup 72h).` };
    }
  }

  // 2. ¿Hay regla que case?
  const rules = await getCommentRules(tenantId);
  const rule = findMatchingRule(rules, text, mediaId);
  const todas = findMatchingRules(rules, text, mediaId);
  const reglasQueCasan = todas.map((r) => ({ id: r.id, replyPublic: !!r.replyPublic, scope: r.scope }));

  if (!rule) {
    console.log(
      `[marta/comment] comentario sin regla que case: "${text.slice(0, 80)}" (media=${mediaId ?? "?"})`,
    );
    return {
      ...base,
      parado: "sin_regla",
      detalle: `Ninguna regla activa casa con "${text.slice(0, 60)}".`,
      reglasQueCasan,
    };
  }

  // Con más de una regla que casa, la primera es la que manda. Si la que gana no
  // pide respuesta pública y otra sí, el hilo se queda mudo y desde el panel
  // parece que la configuración es correcta — porque lo es, pero de otra regla.
  if (todas.length > 1) {
    console.warn(
      `[marta/comment] OJO: ${todas.length} reglas casan con este comentario. ` +
        `Manda ${rule.id} (replyPublic=${!!rule.replyPublic}). ` +
        `Las demás: ${todas.slice(1).map((r) => `${r.id}(replyPublic=${!!r.replyPublic})`).join(", ")}`,
    );
  }

  const reglaResumen = {
    id: rule.id,
    keywords: rule.keywords,
    scope: rule.scope,
    replyPublic: rule.replyPublic,
    publicReplyText: rule.publicReplyText,
  };
  const dmTexto = renderDmTemplate(rule.dmMessage, { usuario: username });
  const publicText = (rule.publicReplyText || "").trim() || TEXTO_PUBLICO_POR_DEFECTO;
  const rxTs = new Date().toISOString();
  console.log(
    `[marta/comment] COMMENT match rule=${rule.id} from=${fromId ?? "?"} "${text.slice(0, 80)}" ` +
      `replyPublic=${!!rule.replyPublic}`,
  );

  // Registrar el comentario entrante (idempotente por commentId).
  if (!opts.simular) {
    await safeLogEvent(tenantId, {
      id: makeEventId("comment_in", "marta", commentId),
      ts: rxTs,
      type: "message_in",
      channel: "marta",
      senderId: fromId,
      meta: { kind: "comment", commentId, mediaId, ruleId: rule.id },
    });
  }

  // 3. ¿Este tenant tiene el envío encendido?
  if (!isCommentDmEnabled(tenantId)) {
    const detalle =
      `Envío APAGADO para tenant=${tenantId} (no está en MARTA_COMMENT_DM_TENANTS ` +
      `ni hay MARTA_COMMENT_DM_ENABLED=true).`;
    console.log(`[marta/comment] comment-to-DM GATED. ${detalle} DM que habría salido: "${dmTexto.slice(0, 200)}"`);
    return {
      ...base,
      parado: "envio_apagado",
      detalle,
      regla: reglaResumen,
      reglasQueCasan,
      dm: { texto: dmTexto, enviado: false },
      publica: { pedida: !!rule.replyPublic, texto: rule.replyPublic ? publicText : undefined, enviada: false },
    };
  }

  // Modo simulación: hasta aquí llega sin tocar Meta.
  if (opts.simular) {
    return {
      ok: true,
      tenantId,
      detalle: "Simulación: la regla casa y el envío está encendido. NO se ha llamado a Meta.",
      regla: reglaResumen,
      reglasQueCasan,
      dm: { texto: dmTexto, enviado: false },
      publica: { pedida: !!rule.replyPublic, texto: rule.replyPublic ? publicText : undefined, enviada: false },
    };
  }

  // 4. Respuesta PÚBLICA al comentario (primero: es lo que se ve en el post).
  let publica: ResultadoComentario["publica"];
  if (rule.replyPublic) {
    const res = await replyToComment(commentId, publicText);
    publica = { pedida: true, texto: publicText, enviada: res.ok, resultado: res };

    // El resultado se GUARDA como evento, salga bien o mal. Antes solo había una
    // línea de console.log que nadie miraba y por eso el fallo era invisible.
    await safeLogEvent(tenantId, {
      id: makeEventId("comment_reply_out", "marta", commentId),
      type: "message_out",
      channel: "marta",
      senderId: fromId,
      meta: {
        kind: "comment_reply",
        commentId,
        ruleId: rule.id,
        ok: res.ok,
        replyId: res.replyId,
        via: res.gano,
        error: res.error,
        // La traza entera de intentos: status HTTP + código de Meta + fbtrace_id.
        intentos: res.intentos,
      },
    });

    if (!res.ok) {
      console.error(`[marta/comment] respuesta pública FALLIDA comment=${commentId}: ${res.error}`);
    }
  } else {
    console.log(`[marta/comment] regla ${rule.id} sin respuesta pública (replyPublic=false)`);
    publica = { pedida: false, enviada: false };
  }

  // 5. El primer DM, por private reply (exento de la ventana de 24 h).
  const sendResult = await sendInstagramPrivateReply(commentId, dmTexto);
  const dmOk = !(sendResult && typeof sendResult === "object" && "error" in sendResult);
  console.log(`[marta/comment] private reply TX:`, JSON.stringify(sendResult).slice(0, 300));

  // 6. Sembrar la conversación para que la IA continúe el hilo por DM.
  if (fromId) {
    try {
      await appendTurn("marta", fromId, "assistant", dmTexto, username);
    } catch (err) {
      console.error("[marta/comment] no se pudo sembrar la conversación:", err);
    }
  }

  await safeLogEvent(tenantId, {
    id: makeEventId("comment_dm_out", "marta", commentId),
    type: "message_out",
    channel: "marta",
    senderId: fromId,
    meta: { kind: "comment_dm", commentId, ruleId: rule.id, ok: dmOk },
  });

  return {
    ok: true,
    tenantId,
    detalle:
      `Procesado. DM ${dmOk ? "enviado" : "FALLIDO"}; ` +
      (publica.pedida ? `respuesta pública ${publica.enviada ? "enviada" : "FALLIDA"}.` : "sin respuesta pública."),
    regla: reglaResumen,
    reglasQueCasan,
    dm: { texto: dmTexto, enviado: dmOk, resultado: sendResult },
    publica,
  };
}
