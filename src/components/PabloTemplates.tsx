"use client";
import { useEffect, useState } from "react";

type Tmpl = { id: string; intent: string; titulo: string; body: string; uso_count: number };

export default function PabloTemplates() {
  const [items, setItems] = useState<Tmpl[]>([]);
  const [intents, setIntents] = useState<string[]>([]);
  const [form, setForm] = useState({ intent: "precio", titulo: "", body: "" });
  const [show, setShow] = useState(false);

  async function load() { const r = await fetch("/api/pablo/templates"); const j = await r.json(); setItems(j.items || []); setIntents(j.intents || []); }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.body.trim()) return;
    const r = await fetch("/api/pablo/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!r.ok) { alert("Error"); return; }
    setForm({ intent: form.intent, titulo: "", body: "" });
    setShow(false);
    load();
  }

  async function del(id: string) {
    if (!confirm("¿Borrar template?")) return;
    await fetch("/api/pablo/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    load();
  }

  async function copy(body: string) { await navigator.clipboard.writeText(body).catch(() => {}); alert("✓ Copiado"); }

  return (
    <div className="card-hard p-5 bg-white border-[#25D366]">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <h3 className="font-stencil text-2xl">📝 Templates rápidos</h3>
        <button onClick={() => setShow((s) => !s)} className="text-[10px] font-bold uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-[color:var(--mustard)]">{show ? "Cerrar" : "+ Nuevo"}</button>
      </div>
      <p className="text-xs text-black/60 mb-3">Respuestas pre-hechas por intent. Click → copia → pegas en WhatsApp.</p>

      {show && (
        <form onSubmit={add} className="card-hard p-3 bg-[color:var(--cream)] space-y-2 mb-3">
          <div className="grid sm:grid-cols-3 gap-2">
            <select value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value })} className="border-2 border-black px-2 py-1 text-sm bg-white">
              {intents.map((i) => (<option key={i} value={i}>{i}</option>))}
            </select>
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título" required className="sm:col-span-2 border-2 border-black px-2 py-1 text-sm" />
          </div>
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Cuerpo del mensaje" required rows={3} className="w-full border-2 border-black p-2 text-sm" />
          <button type="submit" className="btn-mustard text-xs">Guardar</button>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-black/50 text-center py-3">Sin templates aún.</p>
      ) : (
        <div className="space-y-2">
          {items.map((t) => (
            <div key={t.id} className="border-2 border-black bg-white p-2">
              <div className="flex justify-between items-center gap-2 mb-1 flex-wrap">
                <div className="flex gap-2 items-center"><span className="text-[10px] font-mono uppercase border border-black/40 px-2 py-0.5">{t.intent}</span><b className="text-sm">{t.titulo}</b></div>
                <div className="flex gap-1">
                  <button onClick={() => copy(t.body)} className="text-[10px] font-bold border border-black px-2 py-0.5 hover:bg-black hover:text-[color:var(--mustard)]">📋</button>
                  <button onClick={() => del(t.id)} className="text-[10px] text-[color:var(--red)] border border-[color:var(--red)] px-2 py-0.5 hover:bg-[color:var(--red)] hover:text-white">✕</button>
                </div>
              </div>
              <p className="text-xs text-black/80 whitespace-pre-wrap">{t.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
