// El historial de "Comentario → DM": qué entró, qué disparó y qué salió.
//
// POR QUÉ EXISTE
// --------------
// La pestaña "Comentarios → DM" del panel solo enseñaba CONFIGURACIÓN: las
// reglas, el aviso de si el envío está encendido y un probador. Nada de lo que
// había pasado de verdad. Desde el panel no se podía responder a la única
// pregunta que se hace quien acaba de activar esto: «¿ha funcionado?».
//
// Y para el App Review de Meta importa el doble: hay que enseñar en vídeo que la
// aplicación recibe comentarios y contesta por DM. Sin una pantalla que lo
// muestre, lo único que se puede grabar es un formulario de configuración.
//
// DE DÓNDE SALEN LOS DATOS: NO SE INVENTA UN ALMACÉN NUEVO
// --------------------------------------------------------
// `marta-comment-flow.ts` ya escribía tres eventos por comentario en el
// event-log (`comment_in`, `comment_reply`, `comment_dm`). Lo que faltaba no era
// el almacén: era que esos eventos guardaran el nombre de usuario, el texto del
// comentario, la palabra clave y el texto enviado — solo tenían identificadores.
// Se han ampliado ahí, y este fichero solo LEE y junta.
//
// LOS DESCARTES TAMBIÉN SALEN. Un comentario que llega y no sigue adelante —no
// casa con ninguna regla, o se escribió desde la propia cuenta— se registra como
// `comment_descartado` con su motivo. Antes se perdía en un log que dura una
// hora, y desde el panel un comentario descartado y uno que nunca llegó se veían
// exactamente igual: no se veían.
//
// CÓMO SE JUNTAN: los eventos de un mismo comentario comparten `commentId`. Se
// agrupan por ahí y cada grupo es una fila de la pantalla.

import "server-only";
import { getMonthEvents, type AnalyticsEvent } from "./event-log";

export type EstadoEnvio = "enviado" | "error" | "en_pausa" | "solo_detectado" | "ignorado";

/** Por qué se descartó. Solo cuando `estado` es "ignorado". */
export type MotivoIgnorado = "sin_regla" | "comentario_propio" | "sin_id_o_texto";

export type FilaHistorial = {
  /** Clave de la fila: el id del comentario, o `dm:<mid>` para un mensaje directo. */
  commentId: string;
  /** De dónde viene la fila: un comentario en un post o un mensaje directo. */
  origen: "comentario" | "dm";
  /** ISO. La hora del comentario entrante, o la del primer evento que haya. */
  ts: string;
  /** El @ de quien comentó. Puede faltar: Meta no siempre lo manda. */
  username?: string;
  /** El identificador interno de Instagram, por si no hay username. */
  senderId?: string;
  /** Lo que escribió: el comentario, o el texto del DM. */
  comentario?: string;
  /** La palabra clave que hizo saltar la regla. */
  keyword?: string;
  /** La regla que ganó. */
  ruleId?: string;
  /** El DM que se envió (o que se habría enviado, si está en pausa). */
  dm?: string;
  /** La respuesta pública en el hilo del post, si la regla la pedía. */
  respuestaPublica?: string;
  estado: EstadoEnvio;
  /** El motivo, cuando algo falló. Texto de Meta, sin traducir. */
  error?: string;
  /** Por qué se ignoró, cuando se ignoró. */
  motivo?: MotivoIgnorado;
};

/** "YYYY-MM" de una fecha, en UTC — el mismo criterio que usa el event-log. */
function mesDe(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

type MetaComentario = {
  kind?: string;
  commentId?: string;
  /** Solo en DMs: el id del mensaje entrante, que empareja lo recibido con la respuesta. */
  mid?: string;
  ruleId?: string;
  username?: string;
  texto?: string;
  keyword?: string;
  ok?: boolean;
  gated?: boolean;
  error?: string;
  motivo?: MotivoIgnorado;
};

// `dm_in` / `dm_out` son los mensajes directos. Antes no estaban en esta lista —
// ni siquiera llevaban `kind`—, así que un DM contestado por Marta no salía nunca
// en "Actividad reciente" aunque el webhook lo hubiera procesado bien.
const KINDS = new Set(["comment", "comment_reply", "comment_dm", "comment_descartado", "dm_in", "dm_out"]);

/**
 * Las últimas N interacciones de comentario→DM, de más reciente a más antigua.
 *
 * Lee el mes en curso y el anterior. Dos y no uno porque el día 1 de mes el
 * historial se quedaría en blanco, y una pantalla vacía se lee como "esto no
 * funciona" en vez de como "aún no ha pasado nada este mes". Dos y no doce
 * porque cada mes es una lectura del almacén y esto se pinta en cada carga.
 */
export async function historialComentarios(
  tenantId: string,
  limite = 20,
): Promise<FilaHistorial[]> {
  const ahora = new Date();
  const anterior = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 1, 1));

  let eventos: AnalyticsEvent[] = [];
  try {
    const [a, b] = await Promise.all([
      getMonthEvents(tenantId, mesDe(ahora)),
      getMonthEvents(tenantId, mesDe(anterior)),
    ]);
    eventos = [...a, ...b];
  } catch {
    // Un almacén que no responde no puede tumbar la pestaña entera: se enseña
    // vacía, que es exactamente lo que se ve cuando no ha pasado nada.
    return [];
  }

  // Solo lo de comentario→DM. El bucket lleva de todo: posts publicados,
  // citas, recalls… y esta pantalla es de una cosa concreta.
  const suyos = eventos.filter((e) => {
    const m = (e.meta ?? {}) as MetaComentario;
    return e.channel === "marta" && typeof m.kind === "string" && KINDS.has(m.kind);
  });

  const porComentario = new Map<string, FilaHistorial>();
  // De más antiguo a más nuevo: así el evento de salida, que llega después,
  // escribe el estado final encima del provisional.
  for (const e of [...suyos].sort((x, y) => x.ts.localeCompare(y.ts))) {
    const m = (e.meta ?? {}) as MetaComentario;
    const esDm = m.kind === "dm_in" || m.kind === "dm_out";
    // Un DM se agrupa por su `mid` (lo recibido y la respuesta comparten el del
    // mensaje entrante). Un descarte "sin id" no tiene commentId: se agrupa por
    // el id del evento para que no se junten todos en una sola fila.
    const id = esDm ? `dm:${m.mid || e.id}` : m.commentId || `evento:${e.id}`;
    const fila: FilaHistorial = porComentario.get(id) ?? {
      commentId: id,
      origen: esDm ? "dm" : "comentario",
      ts: e.ts,
      estado: "solo_detectado",
    };

    // El username llega en todos los eventos; se queda el primero que venga.
    if (!fila.username && m.username) fila.username = m.username;
    if (!fila.senderId && e.senderId) fila.senderId = e.senderId;
    if (!fila.ruleId && m.ruleId) fila.ruleId = m.ruleId;

    if (m.kind === "comment") {
      // La hora que se enseña es la de ENTRADA del comentario, no la del envío:
      // es la que el gestor puede cruzar con lo que ve en Instagram.
      fila.ts = e.ts;
      fila.comentario = m.texto;
      fila.keyword = m.keyword;
    } else if (m.kind === "dm_in") {
      fila.ts = e.ts;
      fila.comentario = m.texto;
    } else if (m.kind === "dm_out") {
      fila.dm = m.texto;
      fila.estado = m.ok === false ? "error" : "enviado";
      if (m.error) fila.error = m.error;
    } else if (m.kind === "comment_descartado") {
      fila.ts = e.ts;
      fila.comentario = m.texto;
      fila.estado = "ignorado";
      fila.motivo = m.motivo;
    } else if (m.kind === "comment_reply") {
      fila.respuestaPublica = m.texto;
      if (m.ok === false && !fila.error) fila.error = m.error;
    } else if (m.kind === "comment_dm") {
      fila.dm = m.texto;
      // `gated` no es un fallo: es que el envío está en pausa a propósito
      // mientras Meta no apruebe los permisos. Mezclarlo con los errores haría
      // que el panel gritara "error" por algo que está bien configurado.
      fila.estado = m.gated ? "en_pausa" : m.ok ? "enviado" : "error";
      if (m.error) fila.error = m.error;
    }

    porComentario.set(id, fila);
  }

  return [...porComentario.values()]
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, limite);
}
