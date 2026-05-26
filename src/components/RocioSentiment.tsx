"use client";
import { useEffect, useState } from "react";

type Sent = { id: string; review_text: string; rating: number | null; sentiment: string; emocion_principal: string; temas: string[]; prioridad_respuesta: string; flags: string[]; analyzed_at: string };

const COLORS: Record<string, string> = { muy_positivo: "#14B8A6", positivo: "#A88BE8", neutro: "#94A3B8", negativo: "#FB923C", muy_negativo: "#EF4444" };

export default function RocioSentiment() {
  const [items, setItems] = useState<Sent[]>([]);
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  async function load() { const r = await fetch("/api/rocio/sentiment"); const j = await r.json(); setItems(j.items || []); }
  useEffect(() => { load(); }, []);
  async function go(e: React.FormEvent) {
    e.preventDefault(); if (!text.trim() || busy) return; setBusy(true);
    try { const r = await fetch("/api/rocio/sentiment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ review_text: text, rating }) }); const j = await r.json(); if (!r.ok) alert(j.error); else { setText(""); load(); } } finally { setBusy(false); }
  }
  return (
    <div className="card-hard p-5 bg-white border-[#FBBF24]">
      <h3 className="font-stencil text-2xl mb-2">🎭 Análisis de sentimiento</h3>
      <p className="text-xs text-black/60 mb-3">Pega una reseña y Rocío detecta sentimiento, emoción, temas, prioridad y flags (sospecha falsa, competencia…).</p>
      <form onSubmit={go} className="card-hard p-3 bg-[color:var(--cream)] mb-3 space-y-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Pega aquí el texto de la reseña…" className="w-full border-2 border-black p-2 text-sm" />
        <div className="flex gap-2 items-center flex-wrap">
          <label className="text-[10px] font-mono uppercase">Rating:</label>
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="border-2 border-black px-2 py-1 text-sm bg-white">
            {[1, 2, 3, 4, 5].map((n) => (<option key={n} value={n}>{n}★</option>))}
          </select>
          <button type="submit" disabled={busy || !text.trim()} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Analizando…" : "🧠 Analizar"}</button>
        </div>
      </form>
      {items.length === 0 ? <p className="text-sm text-black/50 text-center py-3">Sin análisis aún.</p> : (
        <div className="space-y-2">{items.slice(0, 10).map((s) => (
          <div key={s.id} className="border-2 border-black p-2 bg-white text-xs" style={{ borderLeftWidth: 6, borderLeftColor: COLORS[s.sentiment] || "#000" }}>
            <div className="flex justify-between items-center gap-2 flex-wrap mb-1">
              <div className="flex gap-1 flex-wrap items-center">
                <span className="font-bold">{s.rating ? `${s.rating}★` : "—"}</span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: COLORS[s.sentiment] || "#999", color: "white" }}>{s.sentiment.replace("_", " ")}</span>
                <span className="text-[10px] text-black/60">· {s.emocion_principal}</span>
                {s.prioridad_respuesta && <span className="text-[10px] font-bold">⚡{s.prioridad_respuesta}</span>}
              </div>
            </div>
            <p className="text-black/80 mb-1">{s.review_text.slice(0, 200)}{s.review_text.length > 200 ? "…" : ""}</p>
            {(s.temas?.length > 0 || s.flags?.length > 0) && (
              <div className="flex gap-1 flex-wrap">
                {s.temas?.map((t, i) => (<span key={i} className="text-[10px] border border-black/40 px-1.5 py-0.5">{t}</span>))}
                {s.flags?.map((f, i) => (<span key={i} className="text-[10px] border border-[color:var(--red)] text-[color:var(--red)] px-1.5 py-0.5 font-bold">⚠ {f}</span>))}
              </div>
            )}
          </div>
        ))}</div>
      )}
    </div>
  );
}
