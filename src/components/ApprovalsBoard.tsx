"use client";
import { useState } from "react";

type Item = { id: string; agent: string; agent_emoji: string; agent_color: string; tipo: string; contenido_preview: string; contenido_full: string; created_at: string; link?: string };

export default function ApprovalsBoard({ initialItems }: { initialItems: Item[] }) {
  const [items] = useState(initialItems);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const agentes = Array.from(new Set(items.map((i) => i.agent)));
  const filtered = filter ? items.filter((i) => i.agent === filter) : items;
  const counts = items.reduce<Record<string, number>>((acc, i) => { acc[i.agent] = (acc[i.agent] || 0) + 1; return acc; }, {});

  async function copy(t: string) { await navigator.clipboard.writeText(t).catch(() => {}); alert("✓ Copiado"); }

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-4">
        <button onClick={() => setFilter("")} className={`text-[10px] font-bold uppercase border-2 border-black px-2 py-1 ${!filter ? "bg-black text-[color:var(--mustard)]" : "bg-white"}`}>
          TODOS ({items.length})
        </button>
        {agentes.map((a) => (
          <button key={a} onClick={() => setFilter(a)} className={`text-[10px] font-bold uppercase border-2 border-black px-2 py-1 ${filter === a ? "bg-black text-[color:var(--mustard)]" : "bg-white"}`}>
            {a} ({counts[a]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card-hard p-8 bg-[#14B8A6]/10 border-[#14B8A6] text-center">
          <div className="text-4xl mb-2">🎉</div>
          <div className="font-stencil text-2xl mb-1">¡Todo aprobado!</div>
          <p className="text-sm text-black/60">No tienes nada pendiente. Buen trabajo.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((i) => (
            <div key={i.id} className="card-hard bg-white p-3" style={{ borderLeftWidth: 6, borderLeftColor: i.agent_color }}>
              <div className="flex justify-between items-start gap-2 flex-wrap mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{i.agent_emoji}</span>
                  <span className="font-bold text-sm uppercase">{i.agent}</span>
                  <span className="text-[10px] font-mono uppercase border border-black/40 px-2 py-0.5">{i.tipo}</span>
                </div>
                <div className="text-[10px] text-black/40">{new Date(i.created_at).toLocaleString("es-ES")}</div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{i.contenido_preview}</p>
              {expanded === i.id && i.contenido_full !== i.contenido_preview && (
                <p className="text-sm whitespace-pre-wrap mt-2 bg-[color:var(--cream)] p-2 border border-black/30">{i.contenido_full}</p>
              )}
              <div className="flex gap-1 flex-wrap mt-2">
                <button onClick={() => setExpanded(expanded === i.id ? null : i.id)} className="text-[10px] font-bold border border-black px-2 py-0.5">
                  {expanded === i.id ? "Ocultar" : "Ver completo"}
                </button>
                <button onClick={() => copy(i.contenido_full)} className="text-[10px] font-bold border border-black px-2 py-0.5">📋 Copiar</button>
                {i.link && <a href={i.link} className="text-[10px] font-bold border-2 border-[#14B8A6] text-[#14B8A6] px-2 py-0.5 hover:bg-[#14B8A6] hover:text-white">✓ Aprobar en {i.agent} →</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
