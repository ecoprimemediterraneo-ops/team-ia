// Constantes globales de la app.
// Cuando haya número de WhatsApp Business definitivo, actualizar WHATSAPP_NUMBER.
// Formato internacional sin "+" ni espacios.
export const WHATSAPP_NUMBER = "34656989373"; // Personal Cristóbal — cambiar por número Pablo prod cuando esté
export const WHATSAPP_DEFAULT_MESSAGE = "Hola, quiero saber más sobre AI-Team";
export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_DEFAULT_MESSAGE
)}`;
