"use client";
import { useEffect, useState } from "react";

type KW = { id: string; keyword: string; accion: string; motivo: string | null };
const SEED = [
  { kw: "denuncia", acc: "bloquear_auto", motivo: "Legal" },
  { kw: "abogado", acc: "bloquear_auto", motivo: "Legal" },
  { kw: "reclamación", acc: "escalar", motivo: "Queja formal" },
  { kw: "urgente", acc: "alerta", motivo: "Atención inmediata" },
  { kw: "emergencia", acc: "escalar", motivo: "Crítico" },
  { kw: "dolor fuerte", acc: "escalar", motivo: "Sanitario" },
];

export default function PabloKeywords() {
  const [items, setItems] = useState<KW[]>([]);
  const [form, setForm] = useState({ keyword: "", accion: "alerta", motivo: "" });

  async function load() { const r = await fetch("/api/pablo/keywords"); const j = await r.json(); setItems(j.items || []); }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.keyword.trim()) return;
    await fetch("/api/pablo/keywords", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ keyword: "", accion: form.accion, motivo: "" });
    load();
  }
  async function importSeed(s: { kw: string; acc: string; motivo: string }) {
    await fetch("/api/pablo/keywords", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyword: s.kw, accion: s.acc, motivo: s.motivo }) });
    load();
  }
  async function del(id: string) { await fetch("/api/pablo/keywords", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) }); load(); }

  return (
    <div className="card-hard p-5 bg-white border-[color:var(--red)]">
      <h3 className="font-stencil text-2xl mb-2">🚨 Keywords críticas</h3>
      <p className="text-xs text-black/60 mb-3">Si el cliente escribe estas palabras, Pablo escala/bloquea el modo auto. Protege contra catástrofes.</p>

      <form onSubmit={add} className="card-hard p-3 bg-[color:var(--cream)] mb-3 space-y-2">
        <div className="grid sm:grid-cols-3 gap-2">
          <input value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} placeholder="Palabra/frase" required className="border-2 border-black px-2 py-1 text-sm" />
          <select value={form.accion} onChange={(e) => setForm({ ...form, accion: e.target.value })} className="border-2 border-black px-2 py-1 text-sm bg-white">
            <option value="alerta">Solo alerta</option><option value="escalar">Escalar (avisar dueño)</option><option value="bloquear_auto">Bloquear modo auto</option>
          </select>
          <input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Motivo (opcional)" className="border-2 border-black px-2 py-1 text-sm" />
        </div>
        <button type="submit" className="btn-mustard text-xs">+ Añadir</button>
      </form>

      <div className="text-[10px] uppercase tracking-widest text-black/60 mb-1 font-bold">📦 SUGERIDAS</div>
      <div className="flex flex-wrap gap-1 mb-3">{SEED.map((s, i) => (<button key={i} onClick={() => importSeed(s)} className="text-[10px] border border-black/40 px-2 py-0.5 hover:bg-black hover:text-[color:var(--mustard)]">+ {s.kw} ({s.acc})</button>))}</div>

      {items.length === 0 ? <p className="text-sm text-black/50 text-center py-3">Sin keywords activas.</p> : (
        <div className="space-y-1">{items.map((k) => (
          <div key={k.id} className="border-2 border-black bg-white px-2 py-1 text-xs flex justify-between items-center">
            <div><b>{k.keyword}</b> <span className="text-[10px] uppercase font-mono border border-black/40 px-1 ml-2">{k.accion}</span> {k.motivo && <span className="text-black/60 ml-2">· {k.motivo}</span>}</div>
            <button onClick={() => del(k.id)} className="text-[10px] text-[color:var(--red)] border border-[color:var(--red)] px-2">✕</button>
          </div>
        ))}</div>
      )}
    </div>
  );
}
