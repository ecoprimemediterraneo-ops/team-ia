"use client";
import { useEffect, useState } from "react";

type Producto = { id: string; nombre: string; descripcion: string | null; precio: number | null; categoria: string | null; keywords: string | null; url_producto: string | null; imagen_url: string | null };

export default function MartaShopping() {
  const [items, setItems] = useState<Producto[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ nombre: "", descripcion: "", precio: "", categoria: "", keywords: "", url_producto: "" });
  const [busy, setBusy] = useState(false);

  const [tema, setTema] = useState("");
  const [sug, setSug] = useState<{ producto_id: string; nombre: string; por_que: string }[]>([]);
  const [sugBusy, setSugBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/marta/productos");
    const j = await r.json();
    setItems(j.items || []);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/marta/productos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        nombre: form.nombre,
        descripcion: form.descripcion || undefined,
        precio: form.precio ? Number(form.precio) : undefined,
        categoria: form.categoria || undefined,
        keywords: form.keywords || undefined,
        url_producto: form.url_producto || undefined,
      }) });
      const j = await r.json();
      if (!r.ok) alert(j.error || "Error");
      else { setForm({ nombre: "", descripcion: "", precio: "", categoria: "", keywords: "", url_producto: "" }); setShow(false); load(); }
    } finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!confirm("¿Borrar producto?")) return;
    await fetch("/api/marta/productos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    load();
  }

  async function sugerir() {
    if (!tema.trim() || sugBusy) return;
    setSugBusy(true); setSug([]);
    try {
      const r = await fetch("/api/marta/productos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "suggest", captionOrTema: tema }) });
      const j = await r.json();
      if (!r.ok) alert(j.error || "Error");
      else setSug(j.sugerencias || []);
    } finally { setSugBusy(false); }
  }

  return (
    <div className="card-hard p-5 bg-white border-[#FF7A59]">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <h3 className="font-stencil text-2xl">🛍️ Catálogo + tags IG Shopping</h3>
        <button onClick={() => setShow((s) => !s)} className="text-[10px] font-bold uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-[color:var(--mustard)]">{show ? "Cerrar" : "+ Añadir producto"}</button>
      </div>
      <p className="text-xs text-black/60 mb-3">Registra tu catálogo. Marta sugiere qué producto tagear en cada caption/tema.</p>

      {show && (
        <form onSubmit={add} className="card-hard p-3 bg-[color:var(--cream)] space-y-2 mb-3">
          <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre producto*" required className="w-full border-2 border-black px-2 py-1 text-sm" />
          <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción corta" rows={2} className="w-full border-2 border-black p-2 text-sm" />
          <div className="grid sm:grid-cols-2 gap-2">
            <input type="number" step="0.01" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} placeholder="Precio (€)" className="border-2 border-black px-2 py-1 text-sm" />
            <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Categoría" className="border-2 border-black px-2 py-1 text-sm" />
          </div>
          <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="Keywords (separadas por coma)" className="w-full border-2 border-black px-2 py-1 text-sm" />
          <input value={form.url_producto} onChange={(e) => setForm({ ...form, url_producto: e.target.value })} placeholder="URL del producto (opcional)" className="w-full border-2 border-black px-2 py-1 text-sm" />
          <button type="submit" disabled={busy} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Guardando…" : "Añadir al catálogo"}</button>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-black/50 text-center py-4">Sin productos en el catálogo todavía.</p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          {items.map((p) => (
            <div key={p.id} className="border-2 border-black px-3 py-1 text-xs flex items-center gap-2 bg-white">
              <span className="font-bold">{p.nombre}</span>
              {p.precio != null && <span className="text-[10px] text-black/60">{Number(p.precio).toFixed(2)}€</span>}
              {p.categoria && <span className="text-[10px] text-black/50">· {p.categoria}</span>}
              <button onClick={() => del(p.id)} className="text-[color:var(--red)] font-bold hover:bg-[color:var(--red)] hover:text-white px-1">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t-2 border-black/10 pt-3 mt-2">
        <div className="text-xs font-mono uppercase tracking-widest text-black/60 mb-2">💡 Sugerir tags para un post</div>
        <textarea value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Pega aquí el caption o tema del post…" rows={2} className="w-full border-2 border-black p-2 text-sm" />
        <button onClick={sugerir} disabled={sugBusy || !tema.trim() || items.length === 0} className="btn-mustard text-xs disabled:opacity-50 mt-2">
          {sugBusy ? "Pensando…" : "🏷️ Sugerir productos a tagear"}
        </button>
        {sug.length > 0 && (
          <div className="mt-3 space-y-1">
            {sug.map((s, i) => (
              <div key={i} className="border-2 border-[#FF7A59] bg-[color:var(--cream)] p-2 text-xs">
                <b>{s.nombre}</b> — <span className="text-black/70">{s.por_que}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
