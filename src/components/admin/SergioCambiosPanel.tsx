"use client";
import { useState } from "react";
import type { Change } from "@/lib/sergio-db";

const RELEVANCE_COLOR: Record<string, string> = {
  critical: "text-red-400 border-red-500/50",
  high: "text-orange-400 border-orange-500/50",
  medium: "text-yellow-400 border-yellow-500/50",
  low: "text-white/40 border-white/20",
};

const RELEVANCE_LABEL: Record<string, string> = {
  critical: "🔴 CRÍTICO", high: "🟠 ALTO", medium: "🟡 MEDIO", low: "⚪ BAJO",
};

export default function SergioCambiosPanel({ changes }: { changes: Change[] }) {
  const [list, setList] = useState<Change[]>(changes);
  const [filter, setFilter] = useState<"all" | "pending" | "critical">("pending");

  async function ack(id: string) {
    setList((prev) => prev.map((c) => c.id === id ? { ...c, acknowledged: true } : c));
    await fetch(`/api/sergio/changes?id=${id}`, { method: "PATCH" });
  }

  const filtered = list.filter((c) => {
    if (filter === "pending") return !c.acknowledged;
    if (filter === "critical") return c.relevance === "critical";
    return true;
  });

  return (
    <div>
      {/* Filtros */}
      <div className="flex gap-2 mb-4 font-mono text-xs">
        {(["pending", "critical", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 border ${filter === f ? "border-[#00ff41] text-[#00ff41]" : "border-white/20 text-white/40 hover:border-white/40"}`}
          >
            {f === "pending" ? "SIN REVISAR" : f === "critical" ? "CRÍTICOS" : "TODOS"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-white/10 p-8 text-center font-mono text-white/30">
          {filter === "pending" ? "SIN CAMBIOS PENDIENTES · RECONOCIMIENTO AL DÍA" : "SIN RESULTADOS"}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`border p-4 font-mono ${c.acknowledged ? "opacity-40 border-white/10" : RELEVANCE_COLOR[c.relevance] ?? "border-white/20"}`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                <div>
                  <span className={`text-xs font-bold ${RELEVANCE_COLOR[c.relevance]?.split(" ")[0]}`}>
                    {RELEVANCE_LABEL[c.relevance] ?? c.relevance}
                  </span>
                  <span className="text-white/40 text-xs ml-3">{c.change_type?.toUpperCase()}</span>
                  <span className="text-white/30 text-xs ml-3">{new Date(c.detected_at).toLocaleString("es-ES")}</span>
                </div>
                {!c.acknowledged && (
                  <button
                    onClick={() => ack(c.id)}
                    className="text-xs border border-[#00ff41]/50 text-[#00ff41] px-2 py-1 hover:bg-[#00ff41]/10"
                  >
                    ✓ ACK
                  </button>
                )}
              </div>
              <p className="text-sm text-white/80 mb-2">{c.summary}</p>
              {c.diff && (
                <div className="grid sm:grid-cols-2 gap-2 text-xs mt-2">
                  {(c.diff as { added?: string[]; removed?: string[] }).added?.slice(0, 3).map((line, i) => (
                    <div key={i} className="text-[#00ff41]/70 truncate">+ {line}</div>
                  ))}
                  {(c.diff as { added?: string[]; removed?: string[] }).removed?.slice(0, 3).map((line, i) => (
                    <div key={i} className="text-red-400/70 truncate">− {line}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
