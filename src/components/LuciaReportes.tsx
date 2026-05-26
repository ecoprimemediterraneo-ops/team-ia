"use client";
import { useEffect, useState } from "react";

type Rep = { id: string; periodo: string; resumen_ejecutivo: string; metricas: Record<string, number>; insights: string[]; recomendaciones: string[]; created_at: string };

export default function LuciaReportes() {
  const [items, setItems] = useState<Rep[]>([]); const [busy, setBusy] = useState(false);
  async function load() { const r = await fetch("/api/lucia/reportes"); const j = await r.json(); setItems(j.items || []); }
  useEffect(() => { load(); }, []);
  async function generar() { if (busy) return; setBusy(true); try { const r = await fetch("/api/lucia/reportes", { method: "POST" }); const j = await r.json(); if (!r.ok) alert(j.error); else load(); } finally { setBusy(false); } }
  function imprimir(rep: Rep) {
    const w = window.open("", "_blank"); if (!w) return;
    const m = rep.metricas || {};
    w.document.write(`<!DOCTYPE html><html><head><title>Lucía ${rep.periodo}</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px}h1{font-size:32px;border-bottom:3px solid #F5C518;padding-bottom:8px}h2{font-size:18px;margin-top:32px;color:#F5C518;text-transform:uppercase;letter-spacing:2px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}.cell{border:2px solid #111;padding:12px;text-align:center}.cell b{display:block;font-size:24px}.cell span{font-size:11px;text-transform:uppercase;color:#666}ul{padding-left:20px}li{margin:6px 0}@media print{button{display:none}}</style></head><body><h1>📬 Lucía · ${rep.periodo}</h1><p>${rep.resumen_ejecutivo}</p><div class="grid"><div class="cell"><b>${m.emails_procesados || 0}</b><span>Emails</span></div><div class="cell"><b>${m.urgentes_atendidos || 0}</b><span>Urgentes</span></div><div class="cell"><b>~${m.minutos_ahorrados_estim || 0}m</b><span>Ahorrados</span></div><div class="cell"><b>${m.compromisos_cumplidos || 0}</b><span>Compromisos OK</span></div><div class="cell"><b>${m.compromisos_pendientes || 0}</b><span>Pendientes</span></div><div class="cell"><b>${m.reuniones_brief_generados || 0}</b><span>Reuniones</span></div></div><h2>Insights</h2><ul>${(rep.insights || []).map((i) => `<li>${i}</li>`).join("")}</ul><h2>Recomendaciones</h2><ul>${(rep.recomendaciones || []).map((r) => `<li>${r}</li>`).join("")}</ul><button onclick="window.print()" style="margin-top:30px;padding:12px 24px;background:#FFC107;border:3px solid #111;font-weight:bold;cursor:pointer">🖨️ Imprimir / PDF</button></body></html>`);
    w.document.close();
  }
  return (
    <div className="card-hard p-5 bg-white border-[#F5C518]">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <h3 className="font-stencil text-2xl">📄 Reportes mensuales</h3>
        <button onClick={generar} disabled={busy} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Generando…" : "📊 Generar mes actual"}</button>
      </div>
      {items.length === 0 ? <p className="text-sm text-black/50 text-center py-3">Sin reportes aún.</p> : (
        <div className="space-y-2">{items.map((r) => (
          <div key={r.id} className="border-2 border-black bg-white p-2 flex justify-between items-center gap-2 flex-wrap">
            <div><b>{r.periodo}</b> · {r.resumen_ejecutivo.slice(0, 90)}…</div>
            <button onClick={() => imprimir(r)} className="text-[10px] font-bold uppercase border-2 border-black px-2 py-1">🖨️ Ver/PDF</button>
          </div>
        ))}</div>
      )}
    </div>
  );
}
