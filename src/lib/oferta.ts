// Fuente ÚNICA de verdad del modelo comercial de AI-Team.
// Cambia precios/oferta AQUÍ y toda la web lo lee. No hardcodees números en componentes.
//
// Modelo (decidido jul 2026):
//   - Producto: Sistema Operativo. Tarifa normal 299€/mes → precio FUNDADOR 149€/mes (−50%),
//     congelado de por vida mientras siga la suscripción.
//   - Beta fundadores: 20 plazas · 6 meses gratis · sin tarjeta · sin permanencia.
//   - Add-on OPCIONAL: Gestión +799€/mes (la operamos por el cliente). Se SUMA → total 948€/mes.

import type { AgentSlug } from "./agents";

export const MONEDA = "€";

// Precio del producto (Sistema Operativo).
export const PRECIO_NORMAL = 299; // tarifa normal
export const PRECIO_FUNDADOR = 149; // precio fundador (−50%), congelado de por vida
export const DESCUENTO_PCT = 50;

// Add-on opcional: Gestión (la operamos nosotros por el cliente). Se SUMA.
export const GESTION_PRECIO = 799;
export const TOTAL_SISTEMA_GESTION = PRECIO_FUNDADOR + GESTION_PRECIO; // 948

// Oferta beta fundadores.
export const BETA = {
  plazas: 20,
  mesesGratis: 6,
  sinTarjeta: true,
  sinPermanencia: true,
} as const;

// Llamadas a la acción unificadas.
export const CTA = {
  primaria: { label: "Solicitar plaza beta", href: "/beta" },
  secundaria: { label: "Ver cómo funciona", href: "#como-funciona" },
  ventas: {
    label: "Hablar con ventas",
    href: "https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min",
  },
} as const;

// Los 4 canales que PROTAGONIZAN la home pública (agente ↔ función), en orden.
// El resto de funciones (reseñas de Google, email marketing, análisis de competencia) van
// incluidas en el producto pero NO se muestran en la home para no saturar: se ven en /precios
// y en /agentes. Regla: la home lidera simple; la profundidad vive en las páginas internas.
export const CANALES_NUCLEO: { slug: AgentSlug; canal: string; beneficio: string }[] = [
  { slug: "pablo", canal: "WhatsApp", beneficio: "Contesta a tus clientes y les da cita, también fuera de horario." },
  { slug: "carmen", canal: "Llamadas", beneficio: "Coge el teléfono y reserva la cita cuando tú estás ocupado." },
  { slug: "marta", canal: "Instagram", beneficio: "Responde los mensajes directos y publica tus posts." },
  { slug: "lucia", canal: "Agenda", beneficio: "Todas tus citas en un sitio, sin dobles reservas." },
];
