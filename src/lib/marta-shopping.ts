/**
 * Marta · Catálogo de productos del cliente + sugerencias de tag IG Shopping en cada post.
 */
import { anthropic, MODELS } from "@/lib/claude";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, key);
}

export type Producto = {
  id: string;
  owner_email: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  categoria: string | null;
  keywords: string | null;
  url_producto: string | null;
  imagen_url: string | null;
  active: boolean;
  created_at: string;
};

export async function listProductos(owner_email: string): Promise<Producto[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row).from("marta_productos").select("*").eq("owner_email", owner_email).eq("active", true).order("created_at", { ascending: false });
  return data ?? [];
}

export async function createProducto(input: Omit<Producto, "id" | "created_at" | "active"> & { active?: boolean }) {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row).from("marta_productos").insert({ ...input, active: input.active ?? true }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProducto(id: string, owner_email: string) {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("marta_productos").delete().eq("id", id).eq("owner_email", owner_email);
}

export async function suggestTags(input: { owner_email: string; captionOrTema: string }): Promise<{ producto_id: string; nombre: string; por_que: string }[]> {
  const productos = await listProductos(input.owner_email);
  if (productos.length === 0) return [];

  try {
    const list = productos.map((p) => `- [${p.id}] ${p.nombre}${p.categoria ? ` (${p.categoria})` : ""}${p.keywords ? ` · keywords: ${p.keywords}` : ""}`).join("\n");
    const c = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 600,
      temperature: 0.3,
      system: `Eres Marta. Dado el caption/tema de un post y un catálogo de productos, sugieres 1-3 productos a TAGEAR en el post de IG Shopping. Devuelve JSON estricto.

FORMATO:
{"sugerencias": [{"producto_id":"<id>","nombre":"<nombre>","por_que":"<razón corta>"}]}`,
      messages: [{ role: "user", content: `Caption/tema: ${input.captionOrTema}\n\nCatálogo:\n${list}\n\nDevuelve JSON.` }],
    });
    const block = c.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    return Array.isArray(parsed.sugerencias) ? parsed.sugerencias.slice(0, 3) : [];
  } catch (e) {
    console.error("[marta-shopping]", e);
    return [];
  }
}
