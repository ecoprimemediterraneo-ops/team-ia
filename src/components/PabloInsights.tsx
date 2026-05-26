"use client";
import { useEffect, useState } from "react";

type Ins = { id: string; titulo: string; insight: string; accion_sugerida: string | null; prioridad: string; status: string; created_at: string };
const COLORS: Record<string, string> = { alta: "#EF4444", media: "#FBBF24", baja: "#94A3B8" };

export default function PabloInsights() {
  const [items, setItems] = useState<Ins[]>([]);
  const [busy, setBusy] = useState(false);
  async function load() { const r = await fetch("/api/pablo/insights"); const j = await r.json(); setItems(j.items || []); }
  useEffect(() => { load(); }, []);
  async function generar() {
    if (busy) return; setBusy(true);
    try { const r = await fetch("/api/pablo/insights", { method: "POST" }); const j = await r.json(); if (!r.ok) alert(j.error); else load(); } finally { setBusy(false); }
  }
  async function setStatus(id: string, status: string) { await fetch("/api/pablo/insights", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }); load(); }
  const activos = items.filter((i) => i.status === "nueva" || i.status === "aceptada");
  return (
    <div className="card-hard p-5 bg-white border-[#25D366]">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <h3 className="font-stencil text-2xl">🧠 Insights IA del negocio</h3>
        <button onClick={generar} disabled={busy} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Analizando…" : "💡 Generar insights"}</button>
      </div>
      <p className="text-xs text-black/60 mb-3">Pablo analiza tus conversaciones y te dice qué cambiar para vender más.</p>
      {activos.length === 0 ? <p className="text-sm text-black/50 text-center py-3">Sin insights. Cuando tengas conversaciones registradas, genera los primeros.</p> : (
        <div className="space-y-2">{activos.map((i) => (
          <div key={i.id} className="border-2 border-black bg-white p-3" style={{ borderLeftWidth: 6, borderLeftColor: COLORS[i.prioridad] || "#000" }}>
            <div className="flex justify-between items-center mb-1 flex-wrap gap-1">
              <b className="text-sm">💡 {i.titulo}</b>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5" style={{ background: COLORS[i.prioridad] || "#999", color: "white" }}>{i.prioridad}</span>
            </div>
            <p className="text-xs text-black/80 mb-2">{i.insight}</p>
            {i.accion_sugerida && <p className="text-xs font-bold border-l-2 border-[#25D366] pl-2 mb-2">→ {i.accion_sugerida}</p>}
            <div className="flex gap-1">
              <button onClick={() => setStatus(i.id, "aceptada")} className="text-[10px] font-bold border-2 border-[#14B8A6] text-[#14B8A6] px-2 py-0.5">✓ Lo haré</button>
              <button onClick={() => setStatus(i.id, "descartada")} className="text-[10px] font-bold border-2 border-black/30 text-black/60 px-2 py-0.5">Descartar</button>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  );
}
