"use client";
import { useEffect, useState } from "react";

type Variant = { letra: "A" | "B" | "C"; body: string; rationale: string };
type Test = { id: string; intent: string; tema: string; variantes: Variant[]; winner_letra: string | null; status: string; created_at: string };

const INTENTS = ["precio", "info", "queja", "lead", "pedido", "cita", "ubicacion", "horario"];

export default function PabloAbTest() {
  const [items, setItems] = useState<Test[]>([]);
  const [form, setForm] = useState({ tema: "", intent: "precio" });
  const [busy, setBusy] = useState(false);

  async function load() { const r = await fetch("/api/pablo/abtest"); const j = await r.json(); setItems(j.items || []); }
  useEffect(() => { load(); }, []);

  async function generar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tema.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/pablo/abtest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await r.json();
      if (!r.ok) alert(j.error || "Error");
      else { setForm({ tema: "", intent: form.intent }); load(); }
    } finally { setBusy(false); }
  }

  async function ganador(id: string, winner: "A" | "B" | "C") {
    await fetch("/api/pablo/abtest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve", id, winner }) });
    load();
  }

  async function copy(text: string) { await navigator.clipboard.writeText(text).catch(() => {}); alert("✓ Copiado"); }

  return (
    <div className="card-hard p-5 bg-white border-[#25D366]">
      <h3 className="font-stencil text-2xl mb-2">🅰️🅱️ A/B de respuestas</h3>
      <p className="text-xs text-black/60 mb-3">Pablo te da 3 versiones de respuesta. Pruebas y marcas la que más convierte.</p>
      <form onSubmit={generar} className="card-hard p-3 bg-[color:var(--cream)] mb-4 space-y-2">
        <div className="grid sm:grid-cols-3 gap-2">
          <select value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value })} className="border-2 border-black px-2 py-1 text-sm bg-white">
            {INTENTS.map((i) => (<option key={i} value={i}>{i}</option>))}
          </select>
          <input value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })} placeholder="Tema/contexto (ej: precio implante 800€)" required className="sm:col-span-2 border-2 border-black px-2 py-1 text-sm" />
        </div>
        <button type="submit" disabled={busy || !form.tema.trim()} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Generando…" : "🧪 Generar 3 variantes"}</button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-black/50 text-center py-3">Sin tests aún.</p>
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <div key={t.id} className="border-2 border-black bg-white p-3">
              <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                <div><span className="font-bold text-sm">{t.tema}</span> <span className="text-[10px] font-mono uppercase border border-black/40 px-2 py-0.5 ml-2">{t.intent}</span></div>
                {t.winner_letra && <span className="text-[10px] font-bold uppercase bg-[#14B8A6] text-white px-2 py-0.5">Ganador: {t.winner_letra}</span>}
              </div>
              <div className="grid md:grid-cols-3 gap-2">
                {t.variantes.map((v) => (
                  <div key={v.letra} className={`border-2 p-2 ${t.winner_letra === v.letra ? "border-[#14B8A6] bg-[#14B8A6]/10" : "border-black/40"}`}>
                    <div className="font-bold mb-1">[{v.letra}]</div>
                    <p className="text-xs whitespace-pre-wrap mb-2">{v.body}</p>
                    <p className="text-[10px] text-black/50 italic">{v.rationale}</p>
                    <div className="flex gap-1 mt-2">
                      <button onClick={() => copy(v.body)} className="text-[10px] font-bold border border-black px-2 py-0.5 hover:bg-black hover:text-[color:var(--mustard)]">📋</button>
                      {!t.winner_letra && <button onClick={() => ganador(t.id, v.letra)} className="text-[10px] font-bold border border-black px-2 py-0.5 hover:bg-black hover:text-[color:var(--mustard)]">★ Ganador</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
