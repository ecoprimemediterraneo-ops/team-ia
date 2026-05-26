"use client";
import { useEffect, useState } from "react";

type Reporte = {
  id: string;
  periodo: string;
  resumen_ejecutivo: string;
  metricas: Record<string, number | string>;
  insights: string[];
  recomendaciones: string[];
  created_at: string;
};

export default function MartaReportes() {
  const [items, setItems] = useState<Reporte[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/marta/reportes");
    const j = await r.json();
    setItems(j.items || []);
  }
  useEffect(() => { load(); }, []);

  async function generar() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/marta/reportes", { method: "POST" });
      const j = await r.json();
      if (!r.ok) alert(j.error || "Error");
      else load();
    } finally { setBusy(false); }
  }

  function imprimir(rep: Reporte) {
    const w = window.open("", "_blank");
    if (!w) return;
    const m = rep.metricas || {};
    w.document.write(`<!DOCTYPE html><html><head><title>Reporte ${rep.periodo}</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#111}
h1{font-size:32px;margin:0 0 8px;border-bottom:3px solid #FF7A59;padding-bottom:8px}
h2{font-size:18px;margin-top:32px;text-transform:uppercase;letter-spacing:2px;color:#FF7A59}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}
.cell{border:2px solid #111;padding:12px;text-align:center}
.cell b{display:block;font-size:24px}
.cell span{font-size:11px;text-transform:uppercase;color:#666}
ul{padding-left:20px}li{margin:6px 0}
@media print{button{display:none}}
</style></head><body>
<h1>📊 Reporte Instagram · ${rep.periodo}</h1>
<p style="color:#666">${new Date(rep.created_at).toLocaleDateString("es-ES", { dateStyle: "long" })}</p>
<h2>Resumen ejecutivo</h2>
<p>${rep.resumen_ejecutivo}</p>
<h2>Métricas</h2>
<div class="grid">
<div class="cell"><b>${m.total_posts || 0}</b><span>Publicaciones</span></div>
<div class="cell"><b>${Number(m.total_reach || 0).toLocaleString("es-ES")}</b><span>Alcance</span></div>
<div class="cell"><b>${m.avg_engagement || 0}%</b><span>Engagement medio</span></div>
<div class="cell"><b>${m.total_likes || 0}</b><span>Likes</span></div>
<div class="cell"><b>${m.total_comments || 0}</b><span>Comentarios</span></div>
<div class="cell" style="grid-column:span 1"><b style="font-size:13px">${m.top_post || "n/a"}</b><span>Top post</span></div>
</div>
<h2>Insights</h2>
<ul>${(rep.insights || []).map((i) => `<li>${i}</li>`).join("")}</ul>
<h2>Recomendaciones</h2>
<ul>${(rep.recomendaciones || []).map((r) => `<li>${r}</li>`).join("")}</ul>
<button onclick="window.print()" style="margin-top:30px;padding:12px 24px;background:#FFC107;border:3px solid #111;font-weight:bold;cursor:pointer">🖨️ Imprimir / Guardar PDF</button>
</body></html>`);
    w.document.close();
  }

  return (
    <div className="card-hard p-5 bg-white border-[#FF7A59]">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <h3 className="font-stencil text-2xl">📄 Reportes mensuales</h3>
        <button onClick={generar} disabled={busy} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Generando…" : "📊 Generar reporte del mes"}</button>
      </div>
      <p className="text-xs text-black/60 mb-3">Resumen ejecutivo + insights + recomendaciones. Imprime o guarda como PDF.</p>

      {items.length === 0 ? (
        <p className="text-sm text-black/50 text-center py-4">Sin reportes aún.</p>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className="border-2 border-black bg-white p-3">
              <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                <span className="font-bold">📅 {r.periodo}</span>
                <button onClick={() => imprimir(r)} className="text-[10px] font-bold uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-[color:var(--mustard)]">🖨️ Ver / imprimir PDF</button>
              </div>
              <p className="text-sm">{r.resumen_ejecutivo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
