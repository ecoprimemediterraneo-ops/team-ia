"use client";
import { useState } from "react";

type ReportType = "cambios" | "precios" | "features" | "equipo" | "contenido";

const REPORT_TYPES: { value: ReportType; label: string; emoji: string }[] = [
  { value: "cambios", label: "Cambios detectados", emoji: "🔍" },
  { value: "precios", label: "Análisis de precios", emoji: "💶" },
  { value: "features", label: "Nuevas features", emoji: "🚀" },
  { value: "equipo", label: "Movimientos de equipo", emoji: "👥" },
  { value: "contenido", label: "Cambios de contenido", emoji: "📝" },
];

export default function SergioTools() {
  const [competitor, setCompetitor] = useState("");
  const [reportType, setReportType] = useState<ReportType>("cambios");
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  async function generate() {
    if (!competitor.trim()) {
      setFlash({ ok: false, msg: "Escribe la URL o nombre de un competidor" });
      return;
    }
    setLoading(true);
    setReport("");
    setCopied(false);
    try {
      const res = await fetch("/api/sergio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitor: competitor.trim(), reportType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generando informe");
      setReport(data.report);
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-0">
      {flash && (
        <div className={`mb-4 px-3 py-2 border-2 border-black text-sm font-bold ${flash.ok ? "bg-green-200" : "bg-red-200"}`}>
          {flash.ok ? "✓" : "⚠"} {flash.msg}
          <button onClick={() => setFlash(null)} className="ml-2 text-xs">×</button>
        </div>
      )}

      <div className="card-hard p-4">
        <div className="mb-4">
          <h3 className="font-stencil text-xl">Analiza a tu competencia en 10 segundos</h3>
          <p className="text-sm text-black/60 mt-1">
            Dile a Sergio qué competidor analizar y qué tipo de informe quieres. Él escanea su web y te devuelve inteligencia accionable.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-black/60 mb-1">URL o nombre del competidor</label>
            <input
              type="text"
              value={competitor}
              onChange={(e) => setCompetitor(e.target.value)}
              placeholder="Ej: competidor.com o Clínica López"
              className="w-full border-2 border-black px-2 py-1.5 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/10"
            />

            <label className="block text-[10px] font-mono uppercase tracking-wider text-black/60 mb-1 mt-3">Tipo de análisis</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {REPORT_TYPES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReportType(r.value)}
                  className={`border-2 border-black px-1.5 py-1.5 text-[10px] font-bold tracking-normal text-center leading-tight break-words min-w-0 ${reportType === r.value ? "bg-black text-white" : "bg-white hover:bg-[color:var(--mustard)]/30"}`}
                >
                  <span className="block">{r.emoji}</span>
                  <span className="block">{r.label.toUpperCase()}</span>
                </button>
              ))}
            </div>

            <button onClick={generate} disabled={loading} className="btn-mustard text-sm mt-4 w-full">
              {loading ? "ANALIZANDO…" : "🕵️ GENERAR INFORME"}
            </button>

            <div className="mt-4 p-3 border-2 border-black/20 bg-black/5 text-xs font-mono text-black/60">
              <div className="font-bold mb-1 text-black">⚙ MONITORIZACIÓN AUTOMÁTICA</div>
              Para que Sergio vigile a tus competidores 24/7 y te mande alertas, ve al panel de administración.
              <a href="/admin/sergio" className="block mt-2 font-bold text-black underline">→ Gestionar fuentes monitorizadas</a>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">Informe de Sergio</label>
            <textarea
              value={report}
              onChange={(e) => setReport(e.target.value)}
              rows={5}
              placeholder="Aquí aparecerá el análisis de inteligencia competitiva…"
              className="w-full border-2 border-black p-3 text-sm bg-[color:var(--cream)] focus:outline-none focus:bg-white whitespace-pre-wrap"
            />
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button onClick={copy} disabled={!report} className="btn-mustard text-sm">
                {copied ? "✓ COPIADO" : "📋 COPIAR"}
              </button>
              <button onClick={generate} disabled={loading || !competitor.trim()} className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white disabled:opacity-40">
                🔄 REGENERAR
              </button>
            </div>
            <p className="text-xs text-black/50 mt-3 font-mono">
              ★ Monitorización automática 24/7 con alertas por email activada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
