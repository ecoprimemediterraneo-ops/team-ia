// La bandeja de DMs de Instagram: lo que se ha dicho, y si todavía se puede
// contestar.
//
// POR QUÉ NO VALE `conversation-store`
// ------------------------------------
// Ya existía un almacén de conversaciones para Marta, pero es OTRA COSA: es la
// memoria que necesita la IA para no repetir preguntas, y está construida para
// eso. Tiene tres propiedades que la hacen inservible como bandeja:
//
//   1. NO SE PUEDE LISTAR. La clave es `conv:marta:<igsid>`: para leer una hay
//      que saber ya de quién es. Una bandeja necesita justo lo contrario —
//      enseñar las conversaciones sin saber de antemano quién ha escrito.
//   2. NO ES POR CLIENTE. La clave no lleva tenant, así que dos gestorías
//      distintas compartirían hilos. Como memoria de una sola cuenta funcionaba;
//      como bandeja de varios clientes sería una fuga entre negocios.
//   3. SE BORRA SOLA. A las 24 h sin actividad la conversación se considera
//      caducada y se resetea, y además solo guarda los últimos 10 turnos
//      recortados a 500 caracteres. Es lo correcto para un prompt y es
//      inaceptable para un historial: el cliente abriría la bandeja al día
//      siguiente y no habría nada.
//
// Así que esto es un almacén aparte, POR TENANT y listable. No se toca
// `conversation-store`: la IA sigue usándola exactamente igual.
//
// LA VENTANA DE 24 HORAS
// ----------------------
// Meta solo deja escribir libremente durante las 24 h siguientes al último
// mensaje DEL USUARIO. Fuera de eso hay que usar plantillas aprobadas, que aquí
// no tenemos. Por eso se guarda `ultimoEntranteEn` y se calcula la ventana antes
// de dejar escribir: es mejor un cuadro de texto desactivado que explica el
// motivo que un botón que manda y devuelve el error 131047 de Meta, que no
// significa nada para un peluquero.

import "server-only";
import { kvGet, kvSet, kvListByPrefix, kvDelete, supabaseEnabled } from "./supabase";
import { sendInstagramMessage } from "./marta-graph";
import { tokenInstagramDeTenant } from "./instagram-login";

const PREFIJO = "marta_dm:";

/** Tope de mensajes guardados por conversación. Acota el tamaño de la fila. */
const MAX_MENSAJES = 60;

const VENTANA_MS = 24 * 60 * 60 * 1000;

export type MensajeDm = {
  id: string;
  /** "cliente" = lo escribió la persona. "nosotros" = salió de AI-Team. */
  de: "cliente" | "nosotros";
  texto: string;
  ts: string;
  /** Cómo salió: a mano desde la bandeja, o solo (IA / comentario→DM). */
  via?: "manual" | "automatico";
};

export type ConversacionDm = {
  igsid: string;
  usuario?: string;
  mensajes: MensajeDm[];
  /** Último mensaje ENTRANTE. Es el que abre la ventana de 24 h. */
  ultimoEntranteEn?: string;
  ultimoMovimientoEn: string;
};

function clave(tenantId: string, igsid: string): string {
  return `${PREFIJO}${tenantId}:${igsid}`;
}

/** ¿Se puede escribir libremente a esta conversación ahora mismo? */
export function ventana(c: Pick<ConversacionDm, "ultimoEntranteEn">): {
  abierta: boolean;
  horasQueQuedan: number;
} {
  if (!c.ultimoEntranteEn) return { abierta: false, horasQueQuedan: 0 };
  const restante = new Date(c.ultimoEntranteEn).getTime() + VENTANA_MS - Date.now();
  return { abierta: restante > 0, horasQueQuedan: Math.max(0, Math.floor(restante / 3_600_000)) };
}

/**
 * Apunta un mensaje en la bandeja.
 *
 * NUNCA LANZA. La llama el webhook, y un webhook de Meta que devuelve un error
 * se reintenta: un fallo escribiendo en la bandeja acabaría duplicando DMs al
 * cliente final. Si esto falla, se pierde una fila del historial y se dice en el
 * log; el mensaje ya ha salido igual.
 */
export async function apuntarMensaje(
  tenantId: string,
  igsid: string,
  m: Omit<MensajeDm, "id"> & { id?: string },
  usuario?: string,
): Promise<void> {
  try {
    if (!supabaseEnabled()) return;
    const k = clave(tenantId, igsid);
    const previa = (await kvGet<ConversacionDm>(k)) ?? {
      igsid,
      mensajes: [],
      ultimoMovimientoEn: m.ts,
    };

    const mensaje: MensajeDm = { id: m.id || `${m.de}_${m.ts}`, de: m.de, texto: m.texto, ts: m.ts, via: m.via };

    // Idempotente por id: Meta reentrega webhooks, y sin esto el mismo DM
    // aparecería dos veces en la bandeja.
    if (previa.mensajes.some((x) => x.id === mensaje.id)) return;

    const mensajes = [...previa.mensajes, mensaje]
      .sort((a, b) => a.ts.localeCompare(b.ts))
      .slice(-MAX_MENSAJES);

    await kvSet(k, {
      igsid,
      usuario: usuario || previa.usuario,
      mensajes,
      ultimoEntranteEn: m.de === "cliente" ? m.ts : previa.ultimoEntranteEn,
      ultimoMovimientoEn: m.ts,
    } satisfies ConversacionDm);
  } catch (err) {
    console.error(`[marta/bandeja] no se ha podido apuntar el mensaje tenant=${tenantId}:`, err);
  }
}

/** Las conversaciones de un cliente, la más reciente primero. */
export async function listarConversaciones(tenantId: string): Promise<ConversacionDm[]> {
  if (!supabaseEnabled()) return [];
  const filas = await kvListByPrefix<ConversacionDm>(`${PREFIJO}${tenantId}:`);
  return filas
    .map((f) => f.value)
    .filter(Boolean)
    .sort((a, b) => (b.ultimoMovimientoEn || "").localeCompare(a.ultimoMovimientoEn || ""));
}

export async function leerConversacion(tenantId: string, igsid: string): Promise<ConversacionDm | null> {
  if (!supabaseEnabled()) return null;
  return kvGet<ConversacionDm>(clave(tenantId, igsid));
}

export async function borrarConversacion(tenantId: string, igsid: string): Promise<void> {
  if (supabaseEnabled()) await kvDelete(clave(tenantId, igsid));
}

// -----------------------------------------------------------------------------
// EL ENVÍO A MANO
// -----------------------------------------------------------------------------

/**
 * El fallo viaja con CÓDIGO además del texto.
 *
 * El texto en castellano se queda para quien no mire el código, pero la pantalla
 * necesita el código para poder decir lo mismo en inglés durante la grabación
 * del App Review. Traducir comparando cadenas sería atarse a que nadie cambie
 * una coma.
 */
export type CodigoFallo =
  | "vacio"
  | "sin_cuenta"
  | "fuera_ventana"
  | "token"
  | "config"
  | "generico";

export type ResultadoEnvio = { ok: true } | { ok: false; codigo: CodigoFallo; motivo: string };

/**
 * Manda un DM escrito por el cliente desde la bandeja.
 *
 * Se apoya en `sendInstagramMessage`, que llevaba en el repo sin un solo
 * llamador, pasándole la credencial del TENANT: el envío sale de la cuenta que
 * el cliente conectó y confirmó, no del token de la casa. El camino automático
 * (webhook y comentario→DM) no le pasa credencial y sigue exactamente igual.
 *
 * Los errores se traducen ANTES de salir de aquí. Un "(#10) message sent outside
 * of allowed window" no le dice nada a nadie; que la ventana se ha cerrado, sí.
 */
export async function enviarDmManual(
  tenantId: string,
  igsid: string,
  texto: string,
): Promise<ResultadoEnvio> {
  const limpio = texto.trim();
  if (!limpio) return { ok: false, codigo: "vacio", motivo: "El mensaje está vacío." };

  const conexion = await tokenInstagramDeTenant(tenantId);
  if (!conexion) {
    return { ok: false, codigo: "sin_cuenta", motivo: "No hay ninguna cuenta de Instagram conectada y confirmada." };
  }

  // La ventana se comprueba ANTES de llamar a Meta. Preguntar para que te digan
  // que no es gastar una llamada y un fbtrace_id para nada.
  const c = await leerConversacion(tenantId, igsid);
  if (c && !ventana(c).abierta) {
    return {
      ok: false,
      codigo: "fuera_ventana",
      motivo:
        "Han pasado más de 24 horas desde el último mensaje de esta persona. Instagram no deja " +
        "escribirle hasta que vuelva a escribirte ella.",
    };
  }

  const res = await sendInstagramMessage({ id: igsid }, limpio, {
    token: conexion.token,
    igUserId: conexion.userId,
  });
  const fallo = traducirError(res);

  if (fallo) {
    console.error(`[marta/bandeja] envío manual FALLIDO tenant=${tenantId} a=${igsid}: ${fallo.crudo}`);
    return { ok: false, codigo: fallo.codigo, motivo: fallo.enCristiano };
  }

  console.log(`[marta/bandeja] envío manual OK tenant=${tenantId} a=${igsid}`);
  await apuntarMensaje(tenantId, igsid, {
    de: "nosotros",
    texto: limpio,
    ts: new Date().toISOString(),
    via: "manual",
  });
  return { ok: true };
}

/** Lo que devuelve Meta → una frase que se pueda leer. `null` si salió bien. */
function traducirError(res: unknown): { codigo: CodigoFallo; enCristiano: string; crudo: string } | null {
  if (!res || typeof res !== "object") return null;
  const r = res as Record<string, unknown>;
  if (r.simulado === true) return null;
  if (!("error" in r) && !("skipped" in r)) return null;

  const crudo = JSON.stringify(res).slice(0, 400);

  // 131047 y 10/2534022: los dos códigos con los que Meta dice "fuera de plazo".
  if (/131047|"code":\s*10\b|2534022|outside of allowed window|24 ?h/i.test(crudo)) {
    return {
      codigo: "fuera_ventana",
      enCristiano:
        "Instagram no ha dejado enviarlo: han pasado más de 24 horas desde el último mensaje de " +
        "esta persona. Hay que esperar a que te escriba.",
      crudo,
    };
  }
  if (/190|token/i.test(crudo)) {
    return {
      codigo: "token",
      enCristiano:
        "El permiso de Instagram ha dejado de valer. Vuelve a conectar la cuenta en «Empezar cuenta».",
      crudo,
    };
  }
  if (/missing FACEBOOK_PAGE_ID|missing token/i.test(crudo)) {
    return {
      codigo: "config",
      enCristiano:
        "Esta instalación todavía no puede enviar mensajes: falta configuración en el servidor. " +
        "No es cosa tuya, avísanos.",
      crudo,
    };
  }
  return {
    codigo: "generico",
    enCristiano: "Instagram no ha aceptado el mensaje. Inténtalo otra vez en un momento.",
    crudo,
  };
}
