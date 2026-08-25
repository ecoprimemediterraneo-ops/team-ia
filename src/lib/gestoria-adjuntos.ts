// Adjuntos que entran por WhatsApp y por correo, y acaban en el saco.
//
// Los dos canales terminan llamando a `crearFactura`, que es el ÚNICO camino de
// alta: da igual que la foto venga del cliente, del gestor desde su móvil o de
// un PDF adjunto en un correo. Un saco, tres puertas.
//
// QUIÉN PUEDE MANDAR: cualquiera. No se filtra por remitente a propósito — el
// propio gestor manda fotos desde su móvil, y una lista blanca dejaría fuera
// justo ese caso.

import "server-only";
import { crearFactura, leerYGuardar, marcarLeyendo, asignarPorDatoDuro, marcarSiEsDuplicado, tipoDeFichero, type OrigenFactura } from "./gestoria-facturas";

/**
 * Graph de Meta. `META_GRAPH_URL` permite apuntar a otro sitio para poder probar
 * el camino ENTERO —webhook, descarga, alta de la factura, bandeja— sin
 * depender de que Meta tenga un medio real esperando. Sin eso, la única forma de
 * saber si esto funciona es mandar una foto de verdad y cruzar los dedos.
 *
 * **Se ignora en Vercel a propósito.** En producción siempre es el Graph de
 * verdad, pase lo que pase en las variables de entorno: una variable capaz de
 * redirigir llamadas que llevan el token dentro es un agujero, y aquí no puede
 * usarse ni por error.
 */
const GRAPH = (!process.env.VERCEL && process.env.META_GRAPH_URL) || "https://graph.facebook.com/v21.0";

function tokenMeta(): string | undefined {
  const real =
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_ACCESS_TOKEN.length > 0
      ? process.env.WHATSAPP_ACCESS_TOKEN
      : process.env.INSTAGRAM_ACCESS_TOKEN;
  if (real) return real;
  // Contra el Graph de mentira de la prueba local no hay token que valga ni
  // hace falta. Sin esto, la prueba de punta a punta se paraba en la descarga y
  // había que meter un token de verdad en la máquina para probar algo que no
  // llega a Meta. Las dos condiciones juntas no pueden darse en producción.
  if (!process.env.VERCEL && process.env.META_GRAPH_URL) return "prueba-local";
  return undefined;
}

export type AdjuntoWa = { id: string; mime_type?: string; filename?: string };

/**
 * Descarga un medio de WhatsApp. Son DOS peticiones: la Graph API da primero una
 * URL temporal y después se baja el binario con el mismo token — el enlace no es
 * público y sin la cabecera de autorización devuelve 401.
 */
export async function descargarMedia(mediaId: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const token = tokenMeta();
  if (!token) {
    console.warn("[gestoria-adjuntos] sin token de Meta: no se puede descargar el adjunto");
    return null;
  }
  try {
    const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!meta.ok) {
      console.error(`[gestoria-adjuntos] no se pudo leer el medio ${mediaId}: HTTP ${meta.status}`);
      return null;
    }
    const info = (await meta.json()) as { url?: string; mime_type?: string };
    if (!info.url) return null;

    const bin = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!bin.ok) {
      console.error(`[gestoria-adjuntos] no se pudo bajar el binario: HTTP ${bin.status}`);
      return null;
    }
    return {
      buffer: Buffer.from(await bin.arrayBuffer()),
      mime: info.mime_type || bin.headers.get("content-type") || "application/octet-stream",
    };
  } catch (err) {
    console.error("[gestoria-adjuntos] fallo descargando el adjunto:", err);
    return null;
  }
}

/**
 * Guarda en el saco los adjuntos de un mensaje de WhatsApp.
 *
 * Devuelve cuántas facturas ha creado. Cero significa que no había nada
 * aprovechable —un audio, un sticker, un vídeo—, y entonces el webhook sigue con
 * el flujo normal de Pablo como si no hubiera pasado nada.
 */
/**
 * Arranca la lectura SIN hacer esperar a quien llama.
 *
 * POR QUÉ: el webhook de Meta tiene que contestar rápido. Antes se esperaba a
 * que la IA terminase de leer cada documento dentro de la propia petición del
 * webhook; con un PDF eso son varios segundos, y en Vercel la función se corta
 * antes de guardar nada — el documento se quedaba para siempre "sin leer" y
 * solo se leía cuando el gestor lo asignaba a mano. Justo al revés de como
 * tiene que ser: el gestor necesita ver el proveedor y el importe PARA poder
 * decidir de quién es.
 *
 * `after()` de Next corre el trabajo DESPUÉS de mandar la respuesta, y en
 * Vercel mantiene viva la función mientras tanto. Fuera de un contexto de
 * petición (un script, una prueba) no hay respuesta que esperar, así que se
 * hace en el momento.
 */
async function leerEnSegundoPlano(opts: {
  tenantId: string; facturaId: string; contenido: Buffer; mime: string; nombre: string;
}): Promise<void> {
  // Se marca YA, no dentro del trabajo diferido: la lista tiene que decir
  // "Leyendo…" desde el primer refresco, no dentro de diez segundos.
  await marcarLeyendo(opts.tenantId, opts.facturaId).catch(() => {});

  // Leer y, con lo leído, colocarlo en su cliente. Van juntas a propósito: leer
  // sin asignar deja el documento en la bandeja igual que antes, y asignar es
  // justo lo que le ahorra al gestor los diez mil clics al mes.
  const trabajo = async () => {
    try {
      await leerYGuardar(opts);
    } catch (e) {
      console.error("[gestoria-adjuntos] lectura fallida:", e);
    }
    // Se intenta asignar AUNQUE la lectura falle: si no hay NIF porque no se
    // pudo leer, todavía queda el teléfono desde el que llegó.
    await asignarPorDatoDuro(opts.tenantId, opts.facturaId).catch((e) =>
      console.error("[gestoria-adjuntos] asignación fallida:", e),
    );
    // Y DESPUÉS de saber de quién es, mirar si ya estaba: la comparación es por
    // cliente, así que antes de asignarlo no se puede saber.
    await marcarSiEsDuplicado(opts.tenantId, opts.facturaId).catch((e) =>
      console.error("[gestoria-adjuntos] detección de duplicado fallida:", e),
    );
  };

  try {
    const { after } = await import("next/server");
    after(trabajo());
  } catch {
    // Sin contexto de petición: se lee aquí mismo.
    await trabajo();
  }
}

export async function guardarAdjuntosWhatsApp(opts: {
  tenantId: string;
  telefono: string;
  adjuntos: AdjuntoWa[];
}): Promise<number> {
  // Entra SIN dueño y lo coloca `asignarPorDatoDuro` en cuanto está leído.
  //
  // Antes se resolvía aquí a mano comparando el teléfono con el id del cliente.
  // Se ha quitado por dos motivos: solo miraba el teléfono principal, así que
  // una factura enviada desde el móvil de la encargada no se reconocía aunque
  // ese número estuviera en la ficha; y no dejaba escrito por qué se había
  // asignado. Ahora hay UNA sola regla de asignación y la aplica todo el mundo.
  const clienteId = null;

  let creadas = 0;
  for (const adj of opts.adjuntos) {
    // Se filtra ANTES de descargar: no tiene sentido bajarse un vídeo de 20 MB
    // para descubrir después que no es una factura.
    if (!tipoDeFichero(adj.mime_type || "", adj.filename || "")) continue;

    const media = await descargarMedia(adj.id);
    if (!media) continue;
    if (!tipoDeFichero(media.mime, adj.filename || "")) continue;

    try {
      const factura = await crearFactura({
        tenantId: opts.tenantId,
        clienteId,
        origen: "whatsapp",
        nombre: adj.filename || `whatsapp-${adj.id}`,
        contenido: media.buffer,
        mime: media.mime,
        notas: `Entró por WhatsApp desde ${opts.telefono}`,
        remitente: opts.telefono,
      });
      // Leer va DESPUÉS de guardar y sin poder tumbar nada: el documento ya
      // está a salvo. Si la lectura falla, el gestor lo ve igual con el motivo.
      // Y va en segundo plano: el webhook no puede quedarse esperando a la IA.
      await leerEnSegundoPlano({
        tenantId: opts.tenantId, facturaId: factura.id,
        contenido: media.buffer, mime: media.mime, nombre: factura.nombre_original,
      });
      creadas++;
    } catch (err) {
      console.error("[gestoria-adjuntos] no se pudo guardar la factura:", err);
    }
  }
  return creadas;
}

/** La confirmación al cliente. Corta y sin interpretar nada. */
export const acuseDeRecibo = (n: number): string =>
  n === 1 ? "Recibida, gracias." : `Recibidas ${n}, gracias.`;

/**
 * Guarda los adjuntos de un correo que ha leído Lucía.
 *
 * El CUERPO del email no se toca: lo sigue tratando Lucía como hasta ahora. De
 * aquí solo salen los ficheros.
 */
export async function guardarAdjuntosEmail(opts: {
  tenantId: string;
  /** null si el remitente no casa con ningún cliente: entra como sin_asignar. */
  clienteId: string | null;
  adjuntos: Array<{ nombre: string; contenido: Buffer; mime: string }>;
  remitente?: string;
  asunto?: string;
}): Promise<number> {
  let creadas = 0;
  for (const a of opts.adjuntos) {
    if (!tipoDeFichero(a.mime, a.nombre)) continue;
    try {
      const factura = await crearFactura({
        tenantId: opts.tenantId,
        clienteId: opts.clienteId,
        origen: "email" as OrigenFactura,
        nombre: a.nombre,
        contenido: a.contenido,
        mime: a.mime,
        notas: opts.remitente ? `Entró por correo de ${opts.remitente}` : "Entró por correo",
        remitente: opts.remitente,
        asunto: opts.asunto,
      });
      // Igual que en WhatsApp: se lee solo, y sin bloquear la respuesta.
      await leerEnSegundoPlano({
        tenantId: opts.tenantId, facturaId: factura.id,
        contenido: a.contenido, mime: a.mime, nombre: a.nombre,
      });
      creadas++;
    } catch (err) {
      console.error("[gestoria-adjuntos] no se pudo guardar el adjunto de correo:", err);
    }
  }
  return creadas;
}
