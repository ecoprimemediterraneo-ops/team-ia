// Los estados de un lead de estética y cómo se llaman en pantalla.
//
// VIVEN APARTE DE `estetica-leads.ts` a propósito: ese módulo lleva
// `import "server-only"` (toca disco, Supabase y el registro de eventos) y la
// cola de leads es un componente de cliente que necesita estas dos constantes
// para pintar los filtros. Importarlas desde allí revienta el build con el
// error de `server-only`, y duplicarlas a mano en el componente es la forma
// segura de que algún día digan cosas distintas. Este módulo es PURO: sin
// disco, sin red, sin secretos.

export type EstadoLead = "nuevo" | "contactado" | "cita_puesta" | "descartado";

export const ESTADOS_LEAD: EstadoLead[] = ["nuevo", "contactado", "cita_puesta", "descartado"];

export const ETIQUETA_ESTADO: Record<EstadoLead, string> = {
  nuevo: "Sin contestar",
  contactado: "Contactado",
  cita_puesta: "Valoración puesta",
  descartado: "Descartado",
};
