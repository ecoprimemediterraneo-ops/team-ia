"use client";
import { useEffect, useState } from "react";

type Data = {
  muestra: number;
  mensaje?: string;
  por_dia: Array<{ dia: string; posts: number; engagement_medio: number; reach_medio: number }>;
  por_franja: Array<{ franja: string; key: string; posts: number; engagement_medio: number }>;
  recomendacion: string | null;
};

export default function MartaHoraOptima() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const r = await fetch("/api/marta/hora-optima");
      const j = await r.json();
      setData(j);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  if (loading) return <div className="mt-4 text-sm text-black/50">Calculando hora óptima…</div>;
  if (!data) return null;

  return (
    <div className="card-hard p-5 bg-white border-[#A88BE8]">
      <h3 className="font-stencil text-2xl mb-2">⏰ Hora óptima de publicación</h3>
      <p className="text-xs text-black/60 mb-3">
        Marta analiza el histórico de tus posts y te dice cuándo tu audiencia está más activa.
      </p>

      {data.muestra < 3 ? (
        <div className="text-sm text-black/60 italic">{data.mensaje}</div>
      ) : (
        <>
          {data.recomendacion && (
            <div className="card-hard p-3 bg-[color:var(--mustard)]/30 mb-4">
              <p className="text-sm font-bold">💡 {data.recomendacion}</p>
              <p className="text-[10px] font-mono text-black/50 mt-1">Basado en {data.muestra} posts analizados</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-black/60 font-bold mb-2">📅 POR DÍA SEMANA</div>
              <div className="space-y-1">
                {data.por_dia.map((d, i) => (
                  <Bar key={d.dia} label={d.dia} value={d.engagement_medio} samples={d.posts} max={data.por_dia[0]?.engagement_medio || 1} winner={i === 0} />
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-black/60 font-bold mb-2">🕐 POR FRANJA HORARIA</div>
              <div className="space-y-1">
                {data.por_franja.map((f, i) => (
                  <Bar key={f.key} label={f.franja} value={f.engagement_medio} samples={f.posts} max={data.por_franja[0]?.engagement_medio || 1} winner={i === 0} />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Bar({ label, value, samples, max, winner }: { label: string; value: number; samples: number; max: number; winner?: boolean }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-32 font-bold truncate">{label}</div>
      <div className="flex-1 bg-black/10 h-6 relative">
        <div className={`h-full ${winner ? "bg-[#A88BE8]" : "bg-black/40"} flex items-center px-2`} style={{ width: `${pct}%` }}>
          <span className="font-bold text-white text-[10px]">{value}%</span>
        </div>
      </div>
      <div className="w-12 text-right text-[10px] font-mono text-black/50">{samples} post{samples !== 1 ? "s" : ""}</div>
    </div>
  );
}
