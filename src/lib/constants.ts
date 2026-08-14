// Constantes globales de la app.

/**
 * El número que ve el público en el botón flotante de WhatsApp.
 *
 * Es el número REAL de WhatsApp Business de AI-Team (+34 722 82 37 03), el mismo
 * por el que contesta Pablo. Hasta hoy aquí había un móvil personal porque no
 * había número de empresa; ya lo hay.
 *
 * Se puede sobreescribir con `NEXT_PUBLIC_WHATSAPP_NUMBER` sin tocar código —hace
 * falta el prefijo NEXT_PUBLIC_ porque este valor se pinta en el navegador—, y
 * el valor de aquí es el que se usa si no está puesta.
 *
 * Formato internacional, sin "+" ni espacios.
 */
export const WHATSAPP_NUMBER =
  (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, "") || "34722823703";

export const WHATSAPP_DEFAULT_MESSAGE = "Hola, quiero saber más sobre AI-Team";
export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_DEFAULT_MESSAGE
)}`;
