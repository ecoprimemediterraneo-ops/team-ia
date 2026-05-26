"use client";
import { useEffect, useState } from "react";

type Tmpl = { id: string; sector: string; sentiment: string; titulo: string; body: string };
type Seed = { titulo: string; body: string };

const SENTIMENTS = ["muy_positivo", "positivo", "neutro", "negativo", "muy_negativo"];

export default function RocioTemplatesSector() {
  const [items, setItems] = useState<Tmpl[]>([]);
  const [sectores, setSectores] = useState<string[]>([]);
  const [seeds, setSeeds] = useState<Record<string, Seed[]> | null>(null);
  const [sector, setSector] = useState("clinica");

  async function load(sec = sector) {
    const r = await fetch(`/api/rocio/templates-sector?sector=${sec}`);
    const j = await r.json();
    setItems(j.items || []); setSectores(j.sectores || []); setSeeds(j.seeds || null);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  async function importSeed(sentiment: string, seed: Seed) {
    await fetch("/api/rocio/templates-sector", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sector, sentiment, titulo: seed.titulo, body: seed.body }) });
    load();
  }
  async function del(id: string) { if (!confirm("¿Borrar?")) return; await fetch("/api/rocio/templates-sector", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) }); load(); }
  async function copy(body: string) { await navigator.clipboard.writeText(body).catch(() => {}); alert("✓ Copiado"); }

  return (
    <div className="card-hard p-5 bg-white border-[#FBBF24]">
      <h3 className="font-stencil text-2xl mb-2">🏭 Templates por sector</h3>
      <p className="text-xs text-black/60 mb-3">Plantillas pre-hechas adaptadas al tipo de negocio. Importa las que te gusten.</p>

      <div className="mb-3 flex gap-2 items-center flex-wrap">
        <label className="text-[10px] font-mono uppercase">Sector:</label>
        <select value={sector} onChange={(e) => { setSector(e.target.value); load(e.target.value); }} className="border-2 border-black px-2 py-1 text-sm bg-white">
          {sectores.map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
      </div>

      <div className="text-xs font-mono uppercase tracking-widest text-black/60 mb-1">📦 PLANTILLAS DEL SECTOR</div>
      <div className="grid sm:grid-cols-2 gap-2 mb-4">
        {seeds && SENTIMENTS.map((sent) => (seeds[sent] || []).map((s, i) => (
          <div key={`${sent}-${i}`} className="border-2 border-black/40 p-2 text-xs bg-[color:var(--cream)]">
            <div className="flex justify-between items-center mb-1">
              <b>{s.titulo}</b>
              <button onClick={() => importSeed(sent, s)} className="text-[10px] font-bold border border-black px-2 py-0.5 hover:bg-black hover:text-[color:var(--mustard)]">+ Importar</button>
            </div>
            <p className="text-black/70 italic">{s.body.slice(0, 120)}…</p>
          </div>
        )))}
      </div>

      <div className="text-xs font-mono uppercase tracking-widest text-black/60 mb-1">🎯 TUS TEMPLATES ACTIVOS</div>
      {items.length === 0 ? <p className="text-sm text-black/50 text-center py-3">Sin templates propios. Importa alguno arriba.</p> : (
        <div className="space-y-2">{items.map((t) => (
          <div key={t.id} className="border-2 border-black p-2 bg-white">
            <div className="flex justify-between items-center mb-1 flex-wrap gap-2">
              <div className="flex gap-1 items-center text-[10px] font-mono uppercase"><span className="border border-black/40 px-1.5">{t.sector}</span><span className="border border-black/40 px-1.5">{t.sentiment}</span><b className="text-sm normal-case">{t.titulo}</b></div>
              <div className="flex gap-1">
                <button onClick={() => copy(t.body)} className="text-[10px] font-bold border border-black px-2 py-0.5">📋</button>
                <button onClick={() => del(t.id)} className="text-[10px] text-[color:var(--red)] border border-[color:var(--red)] px-2 py-0.5">✕</button>
              </div>
            </div>
            <p className="text-xs text-black/80">{t.body}</p>
          </div>
        ))}</div>
      )}
    </div>
  );
}
