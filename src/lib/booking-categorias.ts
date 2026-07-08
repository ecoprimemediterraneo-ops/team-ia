// =============================================================================
// AI-Team Booking — Categorías-familia predeterminadas (estilo Booksy).
//
// Set de familias de servicios que se ofrecen al crear un salón para
// preseleccionar/elegir (editables). Las usa:
//   - el importador Booksy (mapea cada servicio extraído a una de estas familias)
//   - el alta manual / OwnerConfig (checklist de familias al crear el salón)
//
// Los ids son ESTABLES (mismo formato que el seed: `cat_<clave>`), así que dos
// salones comparten el id de "Cabello" aunque cada uno tenga sus propios
// servicios. Un salón puede además añadir categorías propias fuera de esta lista.
// =============================================================================

import type { Categoria } from "./booking";

export type CategoriaFamilia = Categoria & {
  /** Sinónimos/palabras clave para casar servicios extraídos (importador) → familia. */
  keywords: string[];
};

/** Familias por defecto, en el orden en que se muestran (más comunes primero). */
export const CATEGORIAS_FAMILIA: CategoriaFamilia[] = [
  { id: "cat_cabello", nombre: "Cabello", keywords: ["pelo", "cabello", "corte", "peinado", "tinte", "color", "mechas", "balayage", "brushing", "recogido", "alisado", "keratina", "peluqueria", "peluquería", "lavado", "secado", "hidratacion capilar"] },
  { id: "cat_barberia", nombre: "Barbería", keywords: ["barba", "barbero", "barberia", "barbería", "afeitado", "arreglo de barba", "corte caballero", "degradado"] },
  { id: "cat_unas", nombre: "Uñas", keywords: ["uña", "uñas", "manicura", "pedicura", "semipermanente", "gel", "acrilico", "acrílico", "nivelacion", "esmaltado", "nail"] },
  { id: "cat_cejas_pestanas", nombre: "Cejas y pestañas", keywords: ["ceja", "cejas", "pestaña", "pestañas", "lifting", "laminado", "extensiones de pestañas", "lash", "brow", "tinte de cejas", "depilacion de cejas", "diseño de cejas", "hd brows"] },
  { id: "cat_micro", nombre: "Micropigmentación", keywords: ["micropigmentacion", "micropigmentación", "microblading", "micro", "microshading", "powder brows", "nanoblading", "delineado permanente", "labios micro", "tricopigmentacion"] },
  { id: "cat_depilacion", nombre: "Depilación", keywords: ["depilacion", "depilación", "cera", "laser", "láser", "hilo", "ipl", "fotodepilacion", "waxing", "depilacion facial", "depilacion corporal"] },
  { id: "cat_facial", nombre: "Facial", keywords: ["facial", "limpieza facial", "hidratacion facial", "peeling", "antiedad", "antiarrugas", "dermapen", "radiofrecuencia facial", "higiene facial", "tratamiento facial", "mesoterapia facial"] },
  { id: "cat_corporal", nombre: "Corporal", keywords: ["corporal", "reductor", "anticelulitico", "anticelulítico", "reafirmante", "presoterapia", "maderoterapia", "cavitacion", "cavitación", "radiofrecuencia corporal", "tratamiento corporal"] },
  { id: "cat_masaje", nombre: "Masajes", keywords: ["masaje", "relajante", "descontracturante", "deportivo", "drenaje", "linfatico", "linfático", "quiromasaje", "spa", "piedras calientes"] },
  { id: "cat_maquillaje", nombre: "Maquillaje", keywords: ["maquillaje", "makeup", "novia", "social", "automaquillaje", "asesoria de imagen", "make up"] },
  { id: "cat_estetica_avanzada", nombre: "Estética avanzada", keywords: ["botox", "acido hialuronico", "ácido hialurónico", "relleno", "hilos tensores", "plasma", "prp", "aparatologia", "aparatología", "medicina estetica", "medicina estética"] },
  { id: "cat_bronceado", nombre: "Bronceado", keywords: ["bronceado", "spray tan", "autobronceador", "solarium", "uva"] },
];

// Elimina marcas diacríticas combinantes (U+0300–U+036F) sin escribirlas como
// literales en el fichero. Así "láser" y "laser" casan igual.
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(DIACRITICS, "").trim();
}

/**
 * Casa el nombre de una categoría (o de un servicio) con una familia por defecto.
 * Devuelve la CategoriaFamilia que mejor encaja, o null si ninguna aplica.
 * Estrategia: coincidencia por nombre exacto → por keyword contenida.
 */
export function matchFamilia(texto: string): CategoriaFamilia | null {
  const t = norm(texto);
  if (!t) return null;
  // 1) nombre de familia contenido en el texto (o al revés)
  for (const fam of CATEGORIAS_FAMILIA) {
    const fn = norm(fam.nombre);
    if (t === fn || t.includes(fn) || fn.includes(t)) return fam;
  }
  // 2) keyword contenida
  let best: { fam: CategoriaFamilia; len: number } | null = null;
  for (const fam of CATEGORIAS_FAMILIA) {
    for (const kw of fam.keywords) {
      const k = norm(kw);
      if (k && t.includes(k) && (!best || k.length > best.len)) best = { fam, len: k.length };
    }
  }
  return best?.fam ?? null;
}

/** Devuelve la familia por su id (para preselección en el alta). */
export function familiaPorId(id: string): CategoriaFamilia | undefined {
  return CATEGORIAS_FAMILIA.find((f) => f.id === id);
}

/** Categorías (sin keywords) listas para guardar en un BusinessBooking. */
export function familiasComoCategorias(ids: string[]): Categoria[] {
  return ids
    .map((id) => familiaPorId(id))
    .filter((f): f is CategoriaFamilia => !!f)
    .map((f) => ({ id: f.id, nombre: f.nombre }));
}
