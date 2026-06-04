// Ficha de marca / cliente por tenant.
//
// Una sola ficha por tenant alimenta a todos los agentes (Marta para captions,
// Pablo para conversaciones de venta, Eva para emails, Rocío para tono de
// respuesta de reseñas, etc.). Centralizar aquí evita que cada agente recoja
// los datos por su cuenta y se desincronicen.
//
// Pensado para ser leído desde:
//   - src/lib/marta-prompt.ts y los webhooks de Marta/Pablo (contextualización).
//   - Generadores de captions / posts (Marta).
//   - Plantillas de email (Eva).
//   - Página /admin/ficha-cliente (edición desde UI).

import { getTenant, upsertTenant, type Ficha, type StyleConfig, type Tenant } from "./tenants";

export type { Ficha, StyleConfig } from "./tenants";

const DEFAULT_ESTILO: StyleConfig = { preset: "natural" };

/**
 * Ficha vacía con valores neutros. Útil como punto de partida en formularios
 * cuando un tenant todavía no tiene ficha.
 */
export function emptyFicha(): Ficha {
  return {
    nombreNegocio: "",
    sector: "",
    ciudad: "",
    tono: "Cercano y profesional. Castellano de España, tuteo.",
    serviciosClave: [],
    promosActuales: [],
    publicoObjetivo: "",
    notasEstilo: "",
    estilo: { ...DEFAULT_ESTILO },
  };
}

/**
 * Devuelve el StyleConfig del tenant. Si no hay ficha o no hay estilo
 * configurado, devuelve `{ preset: "natural" }`. Punto único para el motor
 * de imagen — todo agente que pinte imágenes para este cliente debe pasar
 * por aquí.
 */
export async function getEstilo(tenantId: string): Promise<StyleConfig> {
  const t = await getTenant(tenantId);
  if (!t || !t.ficha?.estilo) return { ...DEFAULT_ESTILO };
  const e = t.ficha.estilo;
  return {
    preset: e.preset || "natural",
    aiStyle: e.aiStyle,
    logoUrl: e.logoUrl,
  };
}

/**
 * Devuelve la ficha del tenant, con fallback sensato si falta algún campo.
 * Si el tenant no existe o no tiene ficha, devuelve null. Si la ficha existe
 * pero está incompleta, rellena huecos con `emptyFicha()` para que los
 * consumidores no tengan que comprobar cada campo por separado.
 */
export async function getFicha(tenantId: string): Promise<Ficha | null> {
  const t = await getTenant(tenantId);
  if (!t) return null;
  if (!t.ficha) return null;
  const base = emptyFicha();
  return {
    nombreNegocio: t.ficha.nombreNegocio || base.nombreNegocio,
    sector: t.ficha.sector || base.sector,
    ciudad: t.ficha.ciudad || base.ciudad,
    tono: t.ficha.tono || base.tono,
    serviciosClave:
      Array.isArray(t.ficha.serviciosClave) && t.ficha.serviciosClave.length > 0
        ? t.ficha.serviciosClave
        : base.serviciosClave,
    promosActuales: Array.isArray(t.ficha.promosActuales) ? t.ficha.promosActuales : [],
    publicoObjetivo: t.ficha.publicoObjetivo ?? "",
    notasEstilo: t.ficha.notasEstilo ?? "",
    estilo: t.ficha.estilo ?? { ...DEFAULT_ESTILO },
  };
}

/**
 * Igual que `getFicha`, pero NO devuelve null: si no hay ficha, devuelve
 * `emptyFicha()` con el nombre del tenant precargado como nombreNegocio.
 * Útil cuando el consumidor quiere algo siempre, no preocuparse del null.
 */
export async function getFichaOrEmpty(tenantId: string): Promise<Ficha> {
  const f = await getFicha(tenantId);
  if (f) return f;
  const t = await getTenant(tenantId);
  const base = emptyFicha();
  if (t) base.nombreNegocio = t.name;
  return base;
}

/**
 * Guarda la ficha del tenant (parcial o completa). Crea el objeto `ficha`
 * en el tenant si no existía. Devuelve el tenant actualizado o null si el
 * tenant no existe.
 */
export async function saveFicha(
  tenantId: string,
  ficha: Ficha,
): Promise<Tenant | null> {
  const t = await getTenant(tenantId);
  if (!t) return null;
  return upsertTenant({ ...t, ficha });
}

/**
 * Resumen breve para inyectar al prompt de un agente. Texto plano, sin
 * markdown, máximo ~6 líneas.
 */
export function fichaToPromptContext(f: Ficha | null): string {
  if (!f) return "";
  const partes: string[] = [];
  if (f.nombreNegocio) partes.push(`Negocio: ${f.nombreNegocio}.`);
  if (f.sector) partes.push(`Sector: ${f.sector}.`);
  if (f.ciudad) partes.push(`Ciudad: ${f.ciudad}.`);
  if (f.publicoObjetivo) partes.push(`Público objetivo: ${f.publicoObjetivo}.`);
  if (f.serviciosClave.length)
    partes.push(`Servicios clave: ${f.serviciosClave.join(" · ")}.`);
  if (f.promosActuales && f.promosActuales.length)
    partes.push(`Promos vigentes: ${f.promosActuales.join(" · ")}.`);
  if (f.tono) partes.push(`Tono de marca: ${f.tono}`);
  if (f.notasEstilo) partes.push(`Notas de estilo: ${f.notasEstilo}`);
  return partes.join("\n");
}
