"use client";
import { useEffect, useState } from "react";

type Item = { id: string; nombre: string; descripcion: string | null; precio: number | null; precio_desde: boolean; duracion_min: number | null; categoria: string | null };

export default function PabloCatalogo() {
  const [items, setItems] = useState<Item[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ nombre: "", descripcion: "", precio: "", precio_desde: false, duracion_min: "", categoria: "", keywords: "" });

  async function load() { const r = await fetch("/api/pablo/catalogo"); const j = await r.json(); setItems(j.items || []); }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    await fetch("/api/pablo/catalogo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      nombre: form.nombre, descripcion: form.descripcion || undefined,
      precio: form.precio ? Number(form.precio) : undefined, precio_desde: form.precio_desde,
      duracion_min: form.duracion_min ? Number(form.duracion_min) : undefined,
      categoria: form.categoria || undefined, keywords: form.keywords || undefined,
    }) });
    setForm({ nombre: "", descripcion: "", precio: "", precio_desde: false, duracion_min: "", categoria: "", keywords: "" });
    setShow(false); load();
  }
  async function del(id: string) { if (!confirm("¿Borrar?")) return; await fetch("/api/pablo/catalogo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) }); load(); }

  return (
    <div className="card-hard p-5 bg-white border-[#25D366]">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <h3 className="font-stencil text-2xl">🛍️ Catálogo</h3>
        <button onClick={() => setShow((s) => !s)} className="text-[10px] font-bold uppercase border-2 border-black px-2 py-1">{show ? "Cerrar" : "+ Servicio/producto"}</button>
      </div>
      <p className="text-xs text-black/60 mb-3">Pablo usa el catálogo para responder consultas con precio y duración exactos.</p>

      {show && (
        <form onSubmit={add} className="card-hard p-3 bg-[color:var(--cream)] space-y-2 mb-3">
          <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre*" required className="w-full border-2 border-black px-2 py-1 text-sm" />
          <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción" rows={2} className="w-full border-2 border-black p-2 text-sm" />
          <div className="grid sm:grid-cols-4 gap-2">
            <div className="flex gap-1 items-center">
              <input type="number" step="0.01" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} placeholder="Precio (€)" className="border-2 border-black px-2 py-1 text-sm w-full" />
              <label className="text-[10px]"><input type="checkbox" checked={form.precio_desde} onChange={(e) => setForm({ ...form, precio_desde: e.target.checked })} /> desde</label>
            </div>
            <input type="number" value={form.duracion_min} onChange={(e) => setForm({ ...form, duracion_min: e.target.value })} placeholder="Duración min" className="border-2 border-black px-2 py-1 text-sm" />
            <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Categoría" className="border-2 border-black px-2 py-1 text-sm" />
            <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="Keywords match" className="border-2 border-black px-2 py-1 text-sm" />
          </div>
          <button type="submit" className="btn-mustard text-xs">Añadir</button>
        </form>
      )}

      {items.length === 0 ? <p className="text-sm text-black/50 text-center py-3">Catálogo vacío. Añade servicios/productos.</p> : (
        <div className="flex flex-wrap gap-2">{items.map((i) => (
          <div key={i.id} className="border-2 border-black px-3 py-1 text-xs flex items-center gap-2 bg-white">
            <span className="font-bold">{i.nombre}</span>
            {i.precio != null && <span className="text-[10px] text-black/60">{i.precio_desde ? "desde " : ""}{Number(i.precio).toFixed(2)}€</span>}
            {i.duracion_min && <span className="text-[10px] text-black/50">· {i.duracion_min}min</span>}
            <button onClick={() => del(i.id)} className="text-[color:var(--red)] font-bold hover:bg-[color:var(--red)] hover:text-white px-1">✕</button>
          </div>
        ))}</div>
      )}
    </div>
  );
}
