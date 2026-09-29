import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;
/** Tiempo máximo de cualquier petición a Supabase. */
const SUPABASE_TIMEOUT_MS = 8_000;
/** Filas por página al listar (PostgREST corta en 1000 por defecto). */
const PAGINA = 1000;

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
    // NINGUNA PETICIÓN SIN LÍMITE DE TIEMPO. Sin esto, un Supabase lento dejaba
    // la reserva colgada hasta que Vercel mataba la función (y Retell o Meta
    // veían un "fallo de conexión" sin rastro en ningún log). Con el límite,
    // la petición falla en seco, se reintenta o se contesta "no puedo ahora".
    _client = createClient(URL, KEY, {
      global: {
        fetch: (input: RequestInfo | globalThis.URL, init?: RequestInit) =>
          fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(SUPABASE_TIMEOUT_MS) }),
      },
    });
  }
  return _client;
}

// Lee un valor JSON del store
/**
 * Como `kvGet`, pero distingue "no existe" (null) de "no se ha podido leer"
 * (LANZA). Para los almacenes que, si no encuentran nada, se siembran de cero:
 * con `kvGet` un fallo pasajero de red devolvía null y se sobrescribía todo.
 */
export async function kvGetEstricto<T>(key: string): Promise<T | null> {
  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("kv_store") as any).select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(`[kv] no se ha podido leer ${key}: ${error.message}`);
  return data ? (data.value as T) : null;
}

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

// Lista los valores cuyas claves empiezan por `prefix`. Devuelve [{key, value}].
//
// Pagina de 1000 en 1000: PostgREST corta cada consulta en 1000 filas SIN
// avisar, así que a partir de la reserva 1001 la agenda "no veía" citas y
// ofrecía como libres huecos ocupados. Y si falla, lo deja escrito: antes
// devolvía [] en silencio. Esta versión sigue devolviendo [] (la usan módulos
// para los que una lista vacía es aceptable); la agenda usa la ESTRICTA.
export async function kvListByPrefix<T>(prefix: string): Promise<{ key: string; value: T }[]> {
  try {
    return await kvListByPrefixEstricto<T>(prefix);
  } catch (err) {
    console.error(`[supabase] no se ha podido listar "${prefix}*": ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

/**
 * Como `kvListByPrefix`, pero LANZA si no se puede leer. Para todo lo que
 * decide si un hueco está libre: "no he podido leer las citas" nunca puede
 * convertirse en "no hay citas".
 * `donde` filtra por un campo del JSON (p. ej. `{ campo: "slug", valor: "x" }`)
 * para no traerse las citas de todos los negocios en cada consulta.
 */
export async function kvListByPrefixEstricto<T>(prefix: string, donde?: { campo: string; valor: string }): Promise<{ key: string; value: T }[]> {
  const sb = getSupabase();
  const out: { key: string; value: T }[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from("kv_store") as any).select("key,value").like("key", `${prefix}%`);
    if (donde) q = q.eq(`value->>${donde.campo}`, donde.valor);
    const { data, error } = await q.order("key").range(desde, desde + PAGINA - 1);
    if (error) throw new Error(`[kv] no se ha podido listar ${prefix}*: ${error.message}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filas = (data as any[]) || [];
    for (const r of filas) out.push({ key: r.key as string, value: r.value as T });
    if (filas.length < PAGINA) return out;
  }
}

const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

/** ¿Hay backend Supabase configurado? Si no, el lock distribuido es no-op. */
export function supabaseEnabled(): boolean {
  return USE_SUPABASE;
}

/**
 * Lock distribuido sobre kv_store.
 *  - Sin Supabase (local): devuelve true siempre (se confía en el mutex en memoria).
 *    La agenda NO usa esto en local: usa `agendaTryLock` (fichero), que sí
 *    aguanta varios procesos a la vez.
 *  - Con Supabase: INSERT atómico (la PK `key` da unicidad). Si la clave ya
 *    existe, solo se puede ROBAR si ha caducado, y el robo es atómico: un UPDATE
 *    condicionado a que siga caducada. Antes se leía y se sobrescribía en dos
 *    pasos, así que dos instancias que llegaban a la vez a un candado caducado
 *    se lo quedaban LAS DOS (y entraban dos citas al mismo hueco).
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
  // 23505 = clave duplicada: el candado existe. Cualquier otro error (red,
  // tiempo agotado) NO es "lo tiene otro": es que no sabemos. No se entra.
  if (ins.error.code && ins.error.code !== "23505") {
    console.error(`[supabase] candado "${key}" no consultable: ${ins.error.message}`);
    return false;
  }
  // exp tiene siempre 13 cifras (ms), así que comparar como texto es correcto.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const robo = await (sb.from("kv_store") as any)
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key)
    .lt("value->>exp", String(now))
    .select("key");
  if (robo.error) {
    console.error(`[supabase] candado "${key}": no se ha podido comprobar si ha caducado: ${robo.error.message}`);
    return false;
  }
  return Array.isArray(robo.data) && robo.data.length === 1;
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

/**
 * Suelta un candado SOLO si sigue siendo de `owner`. Si caducó y lo cogió otro,
 * no se toca (antes se borraba igual y se le quitaba el candado al siguiente).
 */
export async function kvUnlockDe(key: string, owner: string): Promise<void> {
  if (!USE_SUPABASE) return;
  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("kv_store") as any).delete().eq("key", key).eq("value->>owner", owner);
  if (error) console.error(`[supabase] no se ha podido soltar el candado "${key}": ${error.message} (caducará solo)`);
}

export async function kvUnlock(key: string): Promise<void> {
  if (!USE_SUPABASE) return;
  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from("kv_store") as any).delete().eq("key", key);
}
