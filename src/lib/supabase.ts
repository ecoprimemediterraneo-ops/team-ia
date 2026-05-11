import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!_client) _client = createClient(URL, KEY);
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
  await (sb.from("kv_store") as any)
    .upsert({ key, value, updated_at: new Date().toISOString() });
}
