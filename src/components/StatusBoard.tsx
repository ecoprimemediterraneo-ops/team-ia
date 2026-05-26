"use client";
import { useEffect, useState } from "react";

type Service = { name: string; key: string; status: "operational" | "degraded" | "down" | "unknown"; latency_ms?: number; message?: string; last_check: string };

const COLORS = { operational: "#14B8A6", degraded: "#FBBF24", down: "#EF4444", unknown: "#94A3B8" };
const LABELS = { operational: "Operativo", degraded: "Lento", down: "Caído", unknown: "Sin datos" };

export default function StatusBoard() {
  const [data, setData] = useState<{ overall: string; services: Service[]; checked_at: string } | null>(null);

  async function load() {
    const r = await fetch("/api/status", { cache: "no-store" });
    setData(await r.json());
  }
  useEffect(() => {
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, []);

  if (!data) return <div className="text-sm text-black/50">Comprobando servicios…</div>;

  const overallColor = data.overall === "operational" ? "#14B8A6" : data.overall === "degraded" ? "#FBBF24" : "#EF4444";
  const overallLabel = data.overall === "operational" ? "✅ Todos los sistemas operativos" : data.overall === "degraded" ? "⚠️ Algún servicio lento" : "🚨 Hay un servicio caído";

  return (
    <div>
      <div className="card-hard p-5 mb-4 text-white text-center" style={{ background: overallColor }}>
        <div className="font-stencil text-2xl">{overallLabel}</div>
        <div className="text-xs font-mono mt-1 opacity-90">Última comprobación: {new Date(data.checked_at).toLocaleTimeString("es-ES")}</div>
      </div>

      <div className="space-y-2">
        {data.services.map((s) => (
          <div key={s.key} className="card-hard p-4 bg-white flex items-center justify-between gap-3 flex-wrap" style={{ borderLeftWidth: 6, borderLeftColor: COLORS[s.status] }}>
            <div className="flex-1 min-w-[200px]">
              <div className="font-bold text-sm">{s.name}</div>
              {s.message && <div className="text-[10px] text-black/50">{s.message}</div>}
            </div>
            <div className="flex items-center gap-3">
              {s.latency_ms != null && <span className="text-[10px] font-mono text-black/50">{s.latency_ms}ms</span>}
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 text-white" style={{ background: COLORS[s.status] }}>
                {LABELS[s.status]}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-black/40 mt-6 text-center">
        Esta página es pública. Si crees que hay un problema no reportado, escribe a hola@aiteam.marketing
      </p>
    </div>
  );
}
