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
import { crearFactura, tipoDeFichero, type OrigenFactura } from "./gestoria-facturas";
import { clienteIdDeTelefono, listarClientes } from "./gestoria-clientes";

const GRAPH = "https://graph.facebook.com/v21.0";

function tokenMeta(): string | undefined {
  return process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_ACCESS_TOKEN.length > 0
    ? process.env.WHATSAPP_ACCESS_TOKEN
    : process.env.INSTAGRAM_ACCESS_TOKEN;
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
export async function guardarAdjuntosWhatsApp(opts: {
  tenantId: string;
  telefono: string;
  adjuntos: AdjuntoWa[];
}): Promise<number> {
  // El id de cliente es el teléfono normalizado, así que CUALQUIER número
  // producía un id: un desconocido creaba un "cliente" que no sale en ninguna
  // lista y su factura quedaba invisible en el panel. Ahora se comprueba contra
  // las fichas reales; si no está, entra sin dueño y el gestor la coloca.
  const posible = clienteIdDeTelefono(opts.telefono);
  const conocidos = await listarClientes(opts.tenantId).catch(() => []);
  const clienteId = conocidos.some((c) => c.id === posible) ? posible : null;

  let creadas = 0;
  for (const adj of opts.adjuntos) {
    // Se filtra ANTES de descargar: no tiene sentido bajarse un vídeo de 20 MB
    // para descubrir después que no es una factura.
    if (!tipoDeFichero(adj.mime_type || "", adj.filename || "")) continue;

    const media = await descargarMedia(adj.id);
    if (!media) continue;
    if (!tipoDeFichero(media.mime, adj.filename || "")) continue;

    try {
      await crearFactura({
        tenantId: opts.tenantId,
        clienteId,
        origen: "whatsapp",
        nombre: adj.filename || `whatsapp-${adj.id}`,
        contenido: media.buffer,
        mime: media.mime,
        notas: `Entró por WhatsApp desde ${opts.telefono}`,
        remitente: opts.telefono,
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
      await crearFactura({
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
      creadas++;
    } catch (err) {
      console.error("[gestoria-adjuntos] no se pudo guardar el adjunto de correo:", err);
    }
  }
  return creadas;
}
