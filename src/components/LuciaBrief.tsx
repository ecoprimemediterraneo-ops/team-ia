"use client";
import { useEffect, useState } from "react";

type Brief = { id: string; brief_date: string; resumen: string; emails_urgentes: number; emails_total: number; reuniones_hoy: number; propuestas_pendientes: number; highlights: string[] };

export default function LuciaBrief() {
  const [items, setItems] = useState<Brief[]>([]);
  const [busy, setBusy] = useState(false);
  async function load() { const r = await fetch("/api/lucia/brief"); const j = await r.json(); setItems(j.items || []); }
  useEffect(() => { load(); }, []);
  async function generar() {
    if (busy) return; setBusy(true);
    try { const r = await fetch("/api/lucia/brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails: [] }) }); const j = await r.json(); if (!r.ok) alert(j.error); else load(); } finally { setBusy(false); }
  }
  const today = items[0];
  return (
    <div className="card-hard p-5 bg-white border-[#F5C518]">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <h3 className="font-stencil text-2xl">🌅 Brief diario 8AM</h3>
        <button onClick={generar} disabled={busy} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Generando…" : "📋 Generar hoy"}</button>
      </div>
      <p className="text-xs text-black/60 mb-3">Resumen ejecutivo cada mañana: urgentes, reuniones, propuestas, highlights.</p>
      {today ? (
        <div className="card-hard p-3 bg-[color:var(--mustard)]/30 mb-3">
          <div className="text-[10px] font-mono uppercase mb-1">📅 {today.brief_date}</div>
          <p className="text-sm font-bold mb-2">{today.resumen}</p>
          <div className="grid grid-cols-4 gap-2 mb-2">
            <Stat label="Total" value={today.emails_total} />
            <Stat label="Urgentes" value={today.emails_urgentes} />
            <Stat label="Reuniones" value={today.reuniones_hoy} />
            <Stat label="Propuestas" value={today.propuestas_pendientes} />
          </div>
          {today.highlights?.length > 0 && (
            <ul className="text-xs text-black/80 space-y-1">
              {today.highlights.map((h, i) => (<li key={i}>• {h}</li>))}
            </ul>
          )}
        </div>
      ) : <p className="text-sm text-black/50 text-center py-3">Sin briefs aún. Genera el de hoy ☝️</p>}
      {items.length > 1 && (
        <div className="text-[10px] text-black/60 mt-3">
          Anteriores: {items.slice(1, 7).map((b) => <span key={b.id} className="border border-black/40 px-2 py-0.5 mr-1">{b.brief_date}</span>)}
        </div>
      )}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (<div className="border-2 border-black p-2 text-center bg-white"><div className="text-lg font-bold">{value}</div><div className="text-[10px] uppercase font-mono text-black/60">{label}</div></div>);
}
