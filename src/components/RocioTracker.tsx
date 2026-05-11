"use client";
import { useEffect, useState } from "react";

type Entry = {
  id: string;
  date: string;
  rating: number;
  count: number;
  notes?: string;
};

const KEY = "aiteam-rocio-tracker";

export default function RocioTracker() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [rating, setRating] = useState("4.5");
  const [count, setCount] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setEntries(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function persist(next: Entry[]) {
    setEntries(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    persist([
      {
        id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        date: new Date().toISOString().slice(0, 10),
        rating: parseFloat(rating),
        count: parseInt(count) || 0,
        notes: notes.trim() || undefined,
      },
      ...entries,
    ]);
    setNotes("");
  }

  function remove(id: string) {
    persist(entries.filter((e) => e.id !== id));
  }

  // Estadísticas evolución
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const evolutionRating = first && last ? last.rating - first.rating : 0;
  const evolutionCount = first && last ? last.count - first.count : 0;

  return (
    <div className="card-hard p-5 mt-6">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-stencil text-2xl">⭐ Tracker reseñas Google</h3>
          <p className="text-sm text-black/60 mt-1">Apunta tu rating y nº total de reseñas cada mes. Ve la evolución.</p>
        </div>
      </div>

      {sorted.length >= 2 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="card-hard p-3 bg-[color:var(--mustard)]">
            <div className="text-xs uppercase tracking-widest text-black/70">Evolución ★</div>
            <div className="font-stencil text-3xl">{evolutionRating > 0 ? "+" : ""}{evolutionRating.toFixed(2)}</div>
            <div className="text-xs">{first.rating} → {last.rating}</div>
          </div>
          <div className="card-hard p-3 bg-[color:var(--mustard)]">
            <div className="text-xs uppercase tracking-widest text-black/70">Nuevas reseñas</div>
            <div className="font-stencil text-3xl">+{evolutionCount}</div>
            <div className="text-xs">{first.count} → {last.count}</div>
          </div>
        </div>
      )}

      <form onSubmit={add} className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 border-2 border-black p-3 bg-[color:var(--cream)]">
        <input type="number" step="0.1" min="1" max="5" value={rating} onChange={(e) => setRating(e.target.value)} placeholder="Rating ★" className="border-2 border-black px-2 py-1.5 text-sm" />
        <input type="number" min="0" value={count} onChange={(e) => setCount(e.target.value)} placeholder="Nº reseñas total" className="border-2 border-black px-2 py-1.5 text-sm" />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (mes, campaña…)" className="border-2 border-black px-2 py-1.5 text-sm col-span-2 sm:col-span-1" />
        <button type="submit" className="btn-mustard text-xs">+ APUNTAR</button>
      </form>

      {entries.length === 0 ? (
        <p className="text-sm text-black/50 italic">Apunta tu situación actual para empezar a trackear evolución.</p>
      ) : (
        <ul className="space-y-1">
          {entries.map((e) => (
            <li key={e.id} className="border-b border-black/10 pb-1.5 flex items-center gap-3 text-sm">
              <span className="font-mono text-xs text-black/50 w-24">{e.date}</span>
              <span className="font-stencil text-xl text-[color:var(--mustard)]">{e.rating}★</span>
              <span className="text-xs text-black/60">{e.count} reseñas</span>
              {e.notes && <span className="text-xs italic text-black/60 flex-1 truncate">· {e.notes}</span>}
              <button onClick={() => remove(e.id)} className="text-xs text-black/40 hover:text-[color:var(--red)] ml-auto">×</button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-black/40 mt-3 italic">Datos guardados en tu navegador. Apunta cada 1-2 semanas para ver tendencia clara.</p>
    </div>
  );
}
