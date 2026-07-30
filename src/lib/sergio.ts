// Sergio — vista de competidores vigilados.
//
// AQUÍ NO HAY DATOS DE EJEMPLO. Antes este fichero exportaba `MOCK_COMPETITORS`:
// siete competidores escritos a mano (nombres, valoraciones de Google, número de
// reseñas, debilidades y oportunidades) que se pintaban en el panel como si
// fueran los competidores reales del negocio. Se han ELIMINADO: un cliente podía
// creerse que eran los suyos.
//
// Lo que se muestra ahora sale ÚNICAMENTE de las fuentes que alguien ha dado de
// alta de verdad (`sergio-db`). Si no hay ninguna, el panel enseña un estado
// vacío que lo dice claramente. Nunca se rellena el hueco con datos inventados.
//
// Nota sobre los campos: las fuentes reales NO guardan valoración de Google,
// número de reseñas, velocidad de respuesta ni "debilidades". Aquellos campos
// solo existían en los datos falsos. Por eso este tipo se limita a lo que el
// sistema sabe de verdad.

import type { Source, SourceCategory, SourceType, Frequency } from "./sergio-db";

export type CompetidorVigilado = {
  id: string;
  nombre: string;
  url: string;
  tipo: SourceType;
  categoria: SourceCategory;
  frecuencia: Frequency;
  activo: boolean;
  ultimaRevision: string | null;   // null = todavía no se ha revisado nunca
  cambiosDetectados: number;
};

export const CATEGORIA_LABEL: Record<SourceCategory, string> = {
  direct_competitor: "Competidor directo",
  adjacent: "Sector adyacente",
  inspiration: "Referencia",
};

export const FRECUENCIA_LABEL: Record<Frequency, string> = {
  daily: "Cada día",
  weekly: "Cada semana",
  biweekly: "Cada dos semanas",
};

/** Convierte una fuente dada de alta en la fila que ve el panel. */
export function sourceToCompetidor(s: Source, cambiosDetectados = 0): CompetidorVigilado {
  return {
    id: s.id,
    nombre: s.competitor_name,
    url: s.url,
    tipo: s.type,
    categoria: s.category,
    frecuencia: s.frequency,
    activo: s.active,
    ultimaRevision: s.last_scraped_at,
    cambiosDetectados,
  };
}

/** Filtro por los campos que EXISTEN de verdad: categoría y si está activa. */
export function filtrarCompetidores(
  lista: CompetidorVigilado[],
  filtro: { categoria?: string; soloActivos?: boolean },
): CompetidorVigilado[] {
  return lista.filter((c) => {
    if (filtro.categoria && c.categoria !== filtro.categoria) return false;
    if (filtro.soloActivos && !c.activo) return false;
    return true;
  });
}
