import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!_client) {
    // Se deja dicho A QUÉ PROYECTO se está escribiendo, una vez por arranque.
    //
    // El host no es un secreto —la clave sí, y esa no se toca—, pero en Vercel
    // las dos variables están marcadas como sensibles y no hay forma de leerlas
    // de vuelta. Nos pasó: la cuenta de Supabase que teníamos a mano no tenía
    // ningún proyecto y no había manera de saber contra cuál estaba corriendo
    // producción. Una línea en el log lo resuelve para siempre.
    // Ojo: la constante `URL` de este módulo tapa al constructor URL del
    // lenguaje, así que el host se saca a mano.
    const host = URL.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    console.log(`[supabase] proyecto: ${host}`);
    _client = createClient(URL, KEY);
  }
  return _client;
}

// Lee un valor JSON del store
export async function kvGet<T>(key: string): Promise<T | null> {
  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("kv_store") as any)
    .select("value")
    .eq("key", key)
    .single();
  if (error || !data) return null;
  return data.value as T;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("kv_store") as any)
    .upsert({ key, value, updated_at: new Date().toISOString() });
  // No se lanza excepción —tumbaría un webhook por un fallo de escritura— pero
  // SÍ se deja constancia. Antes no se miraba el error siquiera: si Supabase se
  // caía o la clave dejaba de valer, cada guardado se perdía en silencio y todo
  // parecía seguir funcionando, porque la lectura siguiente devuelve null y el
  // sistema vuelve a sembrar los valores por defecto. Un fallo así solo se nota
  // semanas después, cuando falta algo que nadie recuerda haber guardado.
  if (error) {
    console.error(`[supabase] NO SE HA GUARDADO "${key}": ${error.message ?? JSON.stringify(error)}`);
  }
}

// Lista los valores cuyas claves empiezan por `prefix`. Para colecciones
// pequeñas (propuestas de Marta, ≤ pocas decenas). Devuelve [{key, value}].
export async function kvListByPrefix<T>(prefix: string): Promise<{ key: string; value: T }[]> {
  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("kv_store") as any)
    .select("key,value")
    .like("key", `${prefix}%`);
  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => ({ key: r.key as string, value: r.value as T }));
}

const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

/** ¿Hay backend Supabase configurado? Si no, el lock distribuido es no-op. */
export function supabaseEnabled(): boolean {
  return USE_SUPABASE;
}

/**
 * Lock distribuido best-effort sobre kv_store.
 *  - Sin Supabase (local): devuelve true siempre (se confía en el mutex en memoria).
 *  - Con Supabase: intenta INSERT atómico (la PK `key` da unicidad). Si la clave
 *    ya existe y el lock sigue fresco (exp > now) → false. Si está caducado → lo
 *    roba (upsert) y devuelve true.
 */
export async function kvTryLock(key: string, ttlMs: number, owner: string): Promise<boolean> {
  if (!USE_SUPABASE) return true;
  const sb = getSupabase();
  const now = Date.now();
  const value = { owner, at: now, exp: now + ttlMs };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ins = await (sb.from("kv_store") as any).insert({
    key,
    value,
    updated_at: new Date().toISOString(),
  });
  if (!ins.error) return true; // adquirido limpio
  // La clave existe — ¿sigue fresco el lock?
  const cur = await kvGet<{ exp: number }>(key);
  if (cur && cur.exp > now) return false; // en manos de otro, aún válido
  await kvSet(key, value); // caducado → robar
  return true;
}

/**
 * Borra una clave del kv. Mismo mecanismo que `kvUnlock`, que ya borraba, pero
 * con nombre honesto: aquel se llama así porque libera un lock, y usarlo para
 * borrar un registro de negocio se leería como un error.
 */
export async function kvDelete(key: string): Promise<void> {
  if (!USE_SUPABASE) return;
  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from("kv_store") as any).delete().eq("key", key);
}

export async function kvUnlock(key: string): Promise<void> {
  if (!USE_SUPABASE) return;
  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from("kv_store") as any).delete().eq("key", key);
}
