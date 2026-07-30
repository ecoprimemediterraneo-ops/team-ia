// Sergio — lectura de las webs vigiladas DE VERDAD (lado servidor).
//
// Vive aparte de `sergio.ts` a propósito: `sergio.ts` es puro (tipos, etiquetas y
// conversores) y lo importa el panel del navegador. Este módulo toca la base de
// datos, así que no puede acabar en el bundle del cliente.
//
// Aquí NO hay datos de ejemplo. Si no hay fuentes dadas de alta, se devuelve una
// lista vacía y quien llame enseña un estado vacío honesto.

import "server-only";
import { listSources, listChanges } from "./sergio-db";
import { sourceToCompetidor, type CompetidorVigilado } from "./sergio";

export type ResultadoVigilancia = {
  competidores: CompetidorVigilado[];
  hayFuentes: boolean;
  /** Presente solo si NO se pudo leer: "sin_base_de_datos". Nunca se rellena con datos falsos. */
  motivo?: "sin_base_de_datos";
  detalle?: string;
};

/** Fuentes reales + cuántos cambios se han detectado en cada una. Nunca lanza. */
export async function leerCompetidoresVigilados(): Promise<ResultadoVigilancia> {
  let sources: Awaited<ReturnType<typeof listSources>>;
  try {
    sources = await listSources();
  } catch (e) {
    return {
      competidores: [],
      hayFuentes: false,
      motivo: "sin_base_de_datos",
      detalle: e instanceof Error ? e.message : "no se pudo leer las fuentes",
    };
  }

  // El recuento de cambios es un extra: si falla, se muestran las fuentes igual.
  const porFuente = new Map<string, number>();
  try {
    for (const c of await listChanges({ limit: 200 })) {
      porFuente.set(c.source_id, (porFuente.get(c.source_id) ?? 0) + 1);
    }
  } catch {
    /* sin recuento de cambios */
  }

  const competidores = sources.map((s) => sourceToCompetidor(s, porFuente.get(s.id) ?? 0));
  return { competidores, hayFuentes: competidores.length > 0 };
}
