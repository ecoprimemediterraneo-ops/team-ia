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
/**
 * Los textos que se guardan en el historial van recortados.
 *
 * El bucket de eventos es una sola clave por mes: si se guardan comentarios y
 * DMs enteros sin tope, una cuenta con tráfico la infla hasta que deja de caber.
 * 300 caracteres sobran para reconocer de qué iba un comentario en una lista.
 */
const recorte = (t: string | undefined, max = 300): string | undefined =>
  t === undefined ? undefined : t.length > max ? `${t.slice(0, max)}…` : t;

/**
 * Cuál de las palabras clave de la regla ha disparado, no todas las que tiene.
 *
 * En el historial hay que poder decir "saltó por 'precio'", y una regla puede
 * tener seis palabras. Se busca la primera que aparezca en el comentario; si
 * ninguna cuadra (la regla puede haber casado por `scope` o por otra vía), se
 * devuelven las de la regla para no dejar la columna vacía.
 */
function keywordQueDisparo(rule: CommentRule, texto: string): string | undefined {
  const t = texto.toLowerCase();
  const k = (rule.keywords || []).find((w) => w && t.includes(w.toLowerCase()));
  return k ?? (rule.keywords || [])[0];
}

/** Por qué un comentario que llegó no ha seguido adelante. */
export type MotivoDescarte = "sin_id_o_texto" | "comentario_propio" | "sin_regla";

/**
 * Deja escrito en el registro un comentario que se ha descartado, y por qué.
 *
 * ANTES SE DESCARTABA EN SILENCIO. Las salidas tempranas de aquí abajo solo
 * escribían una línea de `console.log`, y en el plan Hobby de Vercel los logs
 * duran una hora. Un comentario que llegaba sin casar con ninguna regla, o que
 * se escribía desde la propia cuenta para probar, desaparecía: en el panel no
 * salía nada y parecía que el webhook no recibía comentarios. Con el motivo
 * guardado, la fila sale en "Actividad reciente" como "Ignorado" y dice por qué.
 *
 * El `duplicado` NO se registra: es Meta reentregando un comentario que ya se
 * procesó, y apuntarlo llenaría la lista de copias sin decir nada nuevo.
 */
async function registrarDescarte(
  tenantId: string,
  motivo: MotivoDescarte,
  c: ComentarioEntrante,
): Promise<void> {
  await safeLogEvent(tenantId, {
    // Idempotente por comentario y motivo: si Meta reentrega, no se duplica.
    id: makeEventId("comment_descartado", "marta", c.commentId || `sinid_${Date.now()}`, motivo),
    type: "message_in",
    channel: "marta",
    senderId: c.fromId,
    meta: {
      kind: "comment_descartado",
      commentId: c.commentId || undefined,
      mediaId: c.mediaId,
      username: c.username,
      texto: recorte(c.text),
      motivo,
    },
  });
}

export async function procesarComentario(
  tenantId: string,
  entryId: string | undefined,
  c: ComentarioEntrante,
  opts: OpcionesComentario = {},
): Promise<ResultadoComentario> {
  const { commentId, text, fromId, username, mediaId } = c;
  const base = { ok: false, tenantId } as const;

  if (!commentId || !text.trim()) {
    console.log("[marta/comment] DESCARTADO sin_id_o_texto: el comentario no trae id o viene vacío");
    if (!opts.simular) await registrarDescarte(tenantId, "sin_id_o_texto", c);
    return { ...base, parado: "sin_id_o_texto", detalle: "El comentario no trae id o viene vacío." };
  }

  // 1a. Ignorar comentarios de la propia cuenta (no autorresponderse).
  const ownId = entryId || process.env.INSTAGRAM_USER_ID;
  if (fromId && ownId && fromId === ownId) {
    // Dos casos con la misma pinta y distinto significado. Uno es la respuesta
    // pública que acaba de dejar la propia Marta: Meta la reenvía como comentario
    // nuevo y registrarla llenaría la lista con una fila por cada respuesta. El
    // otro es alguien probando desde la cuenta de la marca — lo más natural del
    // mundo, y justo lo que no funciona: ese SÍ se registra, para que se vea.
    const propias = new Set(
      [TEXTO_PUBLICO_POR_DEFECTO, ...(await getCommentRules(tenantId)).map((r) => r.publicReplyText || "")]
        .map((t) => t.trim())
        .filter(Boolean),
    );
    if (propias.has(text.trim())) {
      console.log("[marta/comment] respuesta pública propia reenviada por Meta: se ignora sin registrar");
    } else {
      console.log(
        `[marta/comment] DESCARTADO comentario_propio: escrito desde la propia cuenta (from=${fromId}) "${text.slice(0, 80)}"`,
      );
      if (!opts.simular) await registrarDescarte(tenantId, "comentario_propio", c);
    }
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
      `[marta/comment] DESCARTADO sin_regla: "${text.slice(0, 80)}" (media=${mediaId ?? "?"}, ` +
        `reglas=${rules.length}, activas=${rules.filter((r) => r.enabled).length})`,
    );
    if (!opts.simular) await registrarDescarte(tenantId, "sin_regla", c);
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
      // AMPLIADO para el historial de la pestaña "Comentarios → DM".
      //
      // Antes solo se guardaban ids: `commentId`, `mediaId` y `ruleId`. Eso vale
      // para contar cuántos comentarios entraron, que es lo que necesita el
      // informe mensual, pero no para que el gestor RECONOZCA un comentario en
      // una lista. Con solo el id no se sabe quién escribió, qué escribió ni por
      // qué saltó la regla — y eso es justo lo que hay que enseñar en pantalla.
      meta: {
        kind: "comment",
        commentId,
        mediaId,
        ruleId: rule.id,
        username,
        texto: recorte(text),
        keyword: keywordQueDisparo(rule, text),
      },
    });
  }

  // 3. ¿Este tenant tiene el envío encendido?
  if (!isCommentDmEnabled(tenantId)) {
    const detalle =
      `Envío APAGADO para tenant=${tenantId} (no está en MARTA_COMMENT_DM_TENANTS ` +
      `ni hay MARTA_COMMENT_DM_ENABLED=true).`;
    console.log(`[marta/comment] comment-to-DM GATED. ${detalle} DM que habría salido: "${dmTexto.slice(0, 200)}"`);

    // TAMBIÉN SE REGISTRA CUANDO NO SE ENVÍA, y esto no es un detalle.
    //
    // Con el envío en pausa —que es el estado de hoy, hasta que Meta apruebe el
    // App Review— aquí se salía sin escribir nada de salida. En el historial se
    // vería el comentario entrando y después nada, como si el sistema se hubiera
    // tragado el caso. Y "detectado pero no enviado, porque está en pausa" es
    // información: dice que la regla funciona y que solo falta el permiso.
    await safeLogEvent(tenantId, {
      id: makeEventId("comment_dm_gated", "marta", commentId),
      type: "message_out",
      channel: "marta",
      senderId: fromId,
      meta: {
        kind: "comment_dm",
        commentId,
        ruleId: rule.id,
        username,
        texto: recorte(dmTexto),
        ok: false,
        gated: true,
      },
    });

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
        username,
        texto: recorte(publicText),
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
    meta: {
      kind: "comment_dm",
      commentId,
      ruleId: rule.id,
      username,
      texto: recorte(dmTexto),
      ok: dmOk,
      // El motivo del fallo, tal como lo devuelve Meta. Sin esto, en el
      // historial un DM fallido y uno enviado se ven igual salvo por el color.
      error: dmOk ? undefined : JSON.stringify(sendResult).slice(0, 300),
    },
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
