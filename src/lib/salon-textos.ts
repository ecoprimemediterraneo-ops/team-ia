// Textos del salón que también necesita la pantalla (cliente), por eso viven
// aparte de `salon-acciones.ts`, que es solo de servidor.

/** El texto que se le mandaría a una clienta dormida. Suena a salón, no a plantilla de banco. */
export function textoReactivacion(nombre: string, negocioNombre: string, diasSinVenir: number, servicio?: string, profesional?: string): string {
  const primer = (nombre || "").trim().split(/\s+/)[0] || "";
  const tiempo = diasSinVenir >= 60 ? `unos ${Math.round(diasSinVenir / 30)} meses` : `${diasSinVenir} dias`;
  const que = servicio ? `tu ${servicio.toLowerCase()}` : "una cita";
  const con = profesional ? ` con ${profesional}` : "";
  // Sin signos de apertura y sin emojis: es un WhatsApp, y en un salón se escribe así.
  return `Hola ${primer}, hace ${tiempo} que no te vemos por ${negocioNombre} y te echamos de menos. Si te apetece, te reservamos ${que}${con} esta semana. Dime que dia te viene bien y te busco hueco.`;
}

