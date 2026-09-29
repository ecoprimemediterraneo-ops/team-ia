// Caché en memoria, CORTA, para lecturas que casi nunca cambian y se repiten en
// cada petición: el mapa de tenants y las fichas de los negocios. Una función de
// Carmen leía los tenants dos veces y las fichas una (tres viajes a Supabase)
// antes de mirar las citas; con esto, en una instancia caliente, ninguno.
//
// Las CITAS no pasan nunca por aquí: se leen siempre frescas, y el candado de
// la agenda sigue revalidando dentro del bloqueo. Lo peor que puede pasar con
// la caché es ver un cambio de horario o de servicios hasta `ttlMs` tarde en
// OTRA instancia; en la misma instancia, cada escritura la invalida al momento.
//
// Devuelve siempre una COPIA: quien lea puede modificar el objeto (p.ej.
// `all[id] = t` antes de guardar) sin ensuciar lo cacheado.

export type CacheCorta<T> = { leer: () => Promise<T>; olvidar: () => void };

export function cacheCorta<T>(ttlMs: number, cargar: () => Promise<T>): CacheCorta<T> {
  let valor: T | undefined;
  let hasta = 0;
  let generacion = 0;
  let enVuelo: Promise<T> | null = null;
  return {
    async leer() {
      if (ttlMs <= 0) return cargar();
      if (valor !== undefined && Date.now() < hasta) return structuredClone(valor);
      if (!enVuelo) {
        const gen = generacion;
        enVuelo = cargar()
          .then((v) => {
            // Si alguien escribió mientras se leía, esta lectura ya es vieja: se
            // devuelve a quien la pidió, pero no se guarda.
            if (gen === generacion) { valor = structuredClone(v); hasta = Date.now() + ttlMs; }
            return v;
          })
          .finally(() => { enVuelo = null; });
      }
      return structuredClone(await enVuelo);
    },
    olvidar() {
      generacion++;
      valor = undefined;
      hasta = 0;
      enVuelo = null;
    },
  };
}

/** TTL de las cachés de datos casi fijos. Solo con Supabase (en local los ficheros ya son instantáneos). */
export function ttlDatosFijos(conSupabase: boolean): number {
  if (!conSupabase) return 0;
  const n = Number(process.env.CACHE_DATOS_FIJOS_MS);
  return Number.isFinite(n) && n >= 0 && process.env.CACHE_DATOS_FIJOS_MS !== undefined ? n : 30_000;
}
