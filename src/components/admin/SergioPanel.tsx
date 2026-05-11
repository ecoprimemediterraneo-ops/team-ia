"use client";
import { useState } from "react";
import type { Competitor } from "@/lib/sergio";

export default function SergioPanel({ sectors, cities }: { sectors: string[]; cities: string[] }) {
  const [sector, setSector] = useState("");
  const [city, setCity] = useState("");
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [pitch, setPitch] = useState<{ text: string; name: string } | null>(null);
  const [pitchLoading, setPitchLoading] = useState("");

  async function search() {
    setLoading(true);
    const params = new URLSearchParams();
    if (sector) params.set("sector", sector);
    if (city) params.set("city", city);
    const res = await fetch(`/api/sergio?${params}`);
    const data = await res.json();
    setCompetitors(data.competitors ?? []);
    setLoading(false);
  }

  async function generatePitch(id: string, name: string) {
    setPitchLoading(id);
    const res = await fetch("/api/sergio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitorId: id }),
    });
    const data = await res.json();
    setPitch({ text: data.pitch, name });
    setPitchLoading("");
  }

  function ratingColor(r: number) {
    if (r >= 4.5) return "text-green-700";
    if (r >= 4.0) return "text-yellow-700";
    return "text-red-700";
  }

  function speedBadge(s?: string) {
    if (!s || s === "sin WA") return <span className="bg-red-200 text-red-800 px-1.5 py-0.5 text-[10px] font-bold">SIN WA</span>;
    if (s === "< 1h") return <span className="bg-green-200 text-green-800 px-1.5 py-0.5 text-[10px] font-bold">{s}</span>;
    if (s === "1-4h") return <span className="bg-yellow-200 text-yellow-800 px-1.5 py-0.5 text-[10px] font-bold">{s}</span>;
    return <span className="bg-red-200 text-red-800 px-1.5 py-0.5 text-[10px] font-bold">{s}</span>;
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="card-hard p-4 flex flex-wrap gap-3 items-end">
        <label className="block">
          <span className="text-xs font-bold">Sector</span>
          <select value={sector} onChange={(e) => setSector(e.target.value)} className="block w-44 border-2 border-black px-2 py-2 text-sm mt-1 bg-white">
            <option value="">(todos)</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-bold">Ciudad</span>
          <select value={city} onChange={(e) => setCity(e.target.value)} className="block w-44 border-2 border-black px-2 py-2 text-sm mt-1 bg-white">
            <option value="">(todas)</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <button onClick={search} disabled={loading} className="btn-mustard text-sm">
          {loading ? "BUSCANDO…" : "🔍 BUSCAR COMPETIDORES"}
        </button>
      </div>

      {/* Resultados */}
      {competitors.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-mono text-black/50">{competitors.length} competidores encontrados</p>
          {competitors.map((c) => (
            <div key={c.id} className="card-hard p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-stencil text-lg">{c.name}</span>
                    <span className="text-xs font-mono border border-black/30 px-1.5 py-0.5">{c.sector}</span>
                    <span className="text-xs font-mono border border-black/30 px-1.5 py-0.5">{c.city}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm flex-wrap">
                    <span className={`font-bold ${ratingColor(c.googleRating)}`}>★ {c.googleRating} ({c.reviewCount} reseñas)</span>
                    <span>WA: {speedBadge(c.whatsappSpeed)}</span>
                    <span className={`text-xs ${c.hasBookingOnline ? "text-green-700" : "text-red-700"}`}>
                      {c.hasBookingOnline ? "✓ Cita online" : "✗ Sin cita online"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => generatePitch(c.id, c.name)}
                  disabled={pitchLoading === c.id}
                  className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-[color:var(--mustard)] whitespace-nowrap"
                >
                  {pitchLoading === c.id ? "GENERANDO…" : "🎯 GENERAR PITCH"}
                </button>
              </div>

              <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="font-bold text-[color:var(--red)] mb-1">⚠ Debilidades</div>
                  <ul className="space-y-0.5">
                    {c.weaknesses.map((w, i) => <li key={i} className="text-black/70">· {w}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="font-bold text-green-700 mb-1">✓ Oportunidades para AI-Team</div>
                  <ul className="space-y-0.5">
                    {c.opportunities.map((o, i) => <li key={i} className="text-black/70">· {o}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pitch modal */}
      {pitch && (
        <div className="card-hard p-5 border-4 border-[color:var(--mustard)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-stencil text-xl">🎯 Pitch para cliente similar a {pitch.name}</h3>
            <button onClick={() => setPitch(null)} className="text-xs font-mono border-2 border-black px-2 py-1">✕ CERRAR</button>
          </div>
          <div className="text-sm whitespace-pre-wrap bg-white border-2 border-black p-4">{pitch.text}</div>
          <button
            onClick={() => navigator.clipboard.writeText(pitch.text)}
            className="mt-3 text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white"
          >
            📋 COPIAR PITCH
          </button>
        </div>
      )}
    </div>
  );
}
