// Mandarle un documento al cliente. Del gestor al cliente, que es la vuelta que
// faltaba.
//
// POR WHATSAPP, NO POR UN PORTAL
// ------------------------------
// El cliente ya manda sus facturas por WhatsApp: ese es el sitio donde está.
// Un portal con usuario y contraseña es lo que tiene Bilky, y de sus cincuenta
// clientes lo usan cinco. Un documento que hay que ir a buscar es un documento
// que no se recoge. Así que va al mismo chat, sin que el cliente entre a ningún
// sitio.
//
// LO DELICADO VA POR ENLACE QUE CADUCA, PERO SIGUE SIENDO WHATSAPP
// ----------------------------------------------------------------
// Un modelo del IVA con la base imponible del año entero reenviado a un grupo
// es un problema. Para eso el mensaje lleva un enlace que caduca en vez del
// fichero: si alguien lo reenvía mañana, no abre nada. Pero el enlace llega al
// mismo chat y se abre de un toque — no hay que registrarse.
//
// LA VENTANA DE 24 HORAS
// ----------------------
// WhatsApp solo deja escribir libremente dentro de las 24 h siguientes al último
// mensaje del cliente. Cuando el cliente acaba de pedir el documento —que es el
// caso de siempre— la ventana está abierta y sale. Fuera de la ventana, Meta lo
// rechaza y aquí se dice tal cual, con el código de error, en vez de dar el
// envío por bueno.

import "server-only";
import { urlFirmada, subirFichero, FIRMA_SEGUNDOS } from "./gestoria-facturas";
import { sendWhatsAppDocument, sendWhatsAppText } from "./whatsapp-sender";


/**
 * El motivo del fallo, en cristiano.
 *
 * `sendWhatsApp*` devuelve códigos internos —"missing_credentials",
 * "graph_error"— y eso acababa impreso tal cual en la pantalla del gestor. Un
 * gestor no tiene por qué saber inglés ni saber qué es una credencial: tiene que
 * saber si el cliente ha recibido el papel y, si no, a quién llamar.
 */
export function motivoEnEspanol(reason: string | undefined): string {
  switch (reason) {
    case "missing_credentials":
      return "falta configurar la conexión de WhatsApp. Avisa al administrador de AI-Team: no es cosa tuya y no se arregla desde aquí.";
    case "graph_error":
      return "WhatsApp ha rechazado el envío. Mira el detalle de abajo; si no queda claro, avisa al administrador de AI-Team.";
    case "network_error":
      return "no se ha podido conectar con WhatsApp. Vuelve a intentarlo en un minuto; si sigue igual, avisa al administrador de AI-Team.";
    default:
      return reason && reason.trim() ? reason : "no se ha podido enviar.";
  }
}

/** Fail-closed: sin la variable, se prepara el mensaje y no sale nada. */
export const envioDocsEnabled = (): boolean =>
  (process.env.GESTORIA_ENVIO_DOCS_ENABLED || "").toLowerCase() === "true";

export type ModoEnvio = "fichero" | "enlace";

/**
 * Qué documentos van por enlace y no como fichero.
 *
 * No es una lista de "documentos secretos": es la lista de lo que lleva dentro
 * la contabilidad entera de alguien. Un certificado de estar al corriente se
 * puede reenviar sin daño; un modelo 390 con el resumen anual, no.
 */
const DELICADO = [
  "MODELO 303", "MODELO 390", "MODELO 111", "MODELO 190", "MODELO 130",
  "MODELO 200", "MODELO 347", "MODELO 349", "IVA", "IRPF", "SOCIEDADES",
  "NOMINA", "NOMINAS", "SEGUROS SOCIALES", "TC1", "TC2", "RENTA",
  "BALANCE", "CUENTAS ANUALES", "MAYOR", "LIBRO",
];

/** Por defecto, lo que el nombre del fichero delate. El gestor puede cambiarlo. */
export function modoSugerido(nombre: string): ModoEnvio {
  const n = (nombre || "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ");
  return DELICADO.some((d) => n.includes(d)) ? "enlace" : "fichero";
}

const minutos = Math.round(FIRMA_SEGUNDOS / 60);

/** El texto que acompaña al documento. Tono de casa: corto y sin florituras. */
export function textoEnvio(opts: {
  nombreGestoria: string;
  descripcion: string;
  modo: ModoEnvio;
  enlace?: string;
}): string {
  const cabeza = `te mando ${opts.descripcion}.`;
  if (opts.modo === "fichero") return cabeza;
  return [
    cabeza,
    opts.enlace ?? "(enlace)",
    `el enlace caduca en ${minutos} minutos. si se te pasa, dimelo y te lo mando otra vez.`,
  ].join("\n\n");
}

export type ResultadoEnvio = {
  enviado: boolean;
  modo: ModoEnvio;
  /** El mensaje tal cual saldría. Se devuelve siempre, se envíe o no. */
  mensaje: string;
  /** La ruta en el almacén, para poder volver a firmarla. */
  ruta: string;
  motivo?: string;
  detalle?: string;
};

/**
 * Guarda el documento y se lo manda al cliente.
 *
 * Se guarda SIEMPRE, aunque el envío esté apagado o falle: así queda constancia
 * de qué se le mandó a quién, y se puede reintentar sin volver a subirlo.
 */
export async function enviarDocumentoAlCliente(opts: {
  tenantId: string;
  clienteId: string;
  telefono: string;
  nombreGestoria: string;
  nombre: string;
  contenido: Buffer;
  mime: string;
  descripcion?: string;
  modo?: ModoEnvio;
}): Promise<ResultadoEnvio> {
  const modo = opts.modo ?? modoSugerido(opts.nombre);
  const descripcion = (opts.descripcion || "").trim() || opts.nombre;

  // Va al mismo sitio que las facturas, bajo la carpeta del cliente. No se
  // inventa un almacén nuevo para lo que sale.
  const ruta = await subirFichero({
    tenantId: opts.tenantId,
    clienteId: `${opts.clienteId}/enviados`,
    nombre: opts.nombre,
    contenido: opts.contenido,
    mime: opts.mime,
  });

  // La URL tiene que ser ABSOLUTA. En producción, Supabase ya devuelve una
  // completa; en local devuelve una ruta relativa, y un enlace relativo dentro
  // de un WhatsApp no es un enlace, es texto.
  const firmada = await urlFirmada(ruta);
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_URL || "https://aiteam.marketing").replace(/\/$/, "");
  const enlace = firmada && !/^https?:\/\//.test(firmada) ? `${base}${firmada}` : firmada;
  const mensaje = textoEnvio({ nombreGestoria: opts.nombreGestoria, descripcion, modo, enlace: enlace ?? undefined });

  if (!envioDocsEnabled()) {
    return { enviado: false, modo, mensaje, ruta, motivo: "el envío de documentos está apagado. Lo enciende el administrador de AI-Team; hasta entonces se prepara el mensaje pero no sale." };
  }
  if (!opts.telefono) {
    return { enviado: false, modo, mensaje, ruta, motivo: "este cliente no tiene teléfono en su ficha. Ponle el móvil y vuelve a intentarlo." };
  }
  if (!enlace) {
    // Sin URL firmada no hay ni fichero que Meta pueda bajarse ni enlace que
    // mandar. Se dice, en vez de mandar un mensaje sin el documento.
    return {
      enviado: false, modo, mensaje, ruta,
      motivo: "el documento no tiene todavía un enlace que WhatsApp pueda abrir.",
      detalle: "en local, sin Supabase, los ficheros no tienen URL pública: esto solo funciona en producción",
    };
  }

  const r = modo === "fichero"
    ? await sendWhatsAppDocument(opts.telefono, enlace, opts.nombre, `te mando ${descripcion}.`)
    : await sendWhatsAppText(opts.telefono, mensaje);

  if (r.ok) return { enviado: true, modo, mensaje, ruta };

  return {
    enviado: false, modo, mensaje, ruta,
    motivo: motivoEnEspanol(r.reason),
    // El 131047 de Meta es "fuera de la ventana de 24 h". Decirlo con su nombre
    // ahorra media hora de buscar por qué "no llega".
    detalle: `${r.detail ?? ""}${String(r.detail ?? "").includes("131047")
      ? " · Han pasado más de 24 h desde el último mensaje del cliente: WhatsApp no deja escribir libremente. Pídele que te escriba algo, o hace falta una plantilla aprobada."
      : ""}`,
  };
}
