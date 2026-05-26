"use client";
import { useEffect, useState } from "react";

type Summary = {
  total: number;
  converted: number;
  conv_rate: number;
  total_value: number;
  by_intent: Record<string, { total: number; converted: number; rate: number }>;
};

export default function PabloAnalytics() {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => { fetch("/api/pablo/analytics").then((r) => r.json()).then(setS); }, []);
  if (!s) return <div className="text-sm text-black/50 mt-4">Cargando analytics…</div>;
  const intents = Object.entries(s.by_intent).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="card-hard p-5 bg-white border-[#25D366]">
      <h3 className="font-stencil text-2xl mb-2">📊 Analytics WhatsApp</h3>
      <p className="text-xs text-black/60 mb-3">Qué tipos de mensaje conviertes mejor.</p>
      <div className="grid sm:grid-cols-4 gap-2 mb-4">
        <Stat label="Mensajes" value={s.total} />
        <Stat label="Conversiones" value={s.converted} />
        <Stat label="Conv %" value={`${s.conv_rate}%`} />
        <Stat label="€ generados" value={`${s.total_value.toFixed(0)}€`} />
      </div>
      {intents.length === 0 ? (
        <p className="text-sm text-black/50 text-center py-3">Sin datos aún. Cuando Pablo atienda mensajes, aparecerán aquí.</p>
      ) : (
        <div className="space-y-1">
          {intents.map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <div className="w-24 font-bold uppercase">{k}</div>
              <div className="flex-1 bg-black/10 h-5 relative">
                <div className="h-full bg-[#25D366] flex items-center px-2" style={{ width: `${Math.max(2, v.rate)}%` }}>
                  <span className="font-bold text-white text-[10px]">{v.rate.toFixed(0)}%</span>
                </div>
              </div>
              <div className="w-20 text-right text-[10px] font-mono text-black/50">{v.converted}/{v.total}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-2 border-black p-2 text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase font-mono text-black/60">{label}</div>
    </div>
  );
}
