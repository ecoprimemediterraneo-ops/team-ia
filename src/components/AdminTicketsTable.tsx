"use client";
import { useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ticket = Record<string, any>;

const PRIORITY_COLORS: Record<string, string> = {
  urgente: "#EF4444", alta: "#FB923C", normal: "#94A3B8", baja: "#94A3B8",
};
const STATUS_COLORS: Record<string, string> = {
  abierto: "#FBBF24", en_proceso: "#A88BE8", resuelto: "#14B8A6", cerrado: "#94A3B8",
};

export default function AdminTicketsTable({ initialItems }: { initialItems: Ticket[] }) {
  const [items, setItems] = useState<Ticket[]>(initialItems);
  const [filter, setFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    await fetch("/api/tomas/tickets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  }

  const filtered = filter ? items.filter((t) => t.status === filter) : items;
  const counts = items.reduce<Record<string, number>>((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-4">
        {["", "abierto", "en_proceso", "resuelto", "cerrado"].map((s) => (
          <button key={s || "all"} onClick={() => setFilter(s)} className={`text-[10px] font-bold uppercase border-2 border-black px-2 py-1 ${filter === s ? "bg-black text-[color:var(--mustard)]" : "bg-white"}`}>
            {s || "TODOS"} {s && counts[s] ? `(${counts[s]})` : ""}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-black/50 text-center py-8">Sin tickets {filter ? `en estado ${filter}` : ""}.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <div key={t.id} className="border-2 border-black bg-white p-3" style={{ borderLeftWidth: 6, borderLeftColor: PRIORITY_COLORS[t.prioridad] || "#000" }}>
              <div className="flex justify-between items-start gap-2 flex-wrap mb-1">
                <div className="flex-1">
                  <div className="flex gap-2 items-center flex-wrap text-xs mb-1">
                    <span className="font-bold uppercase" style={{ color: PRIORITY_COLORS[t.prioridad] }}>{t.prioridad}</span>
                    <span className="bg-black text-white px-1.5 py-0.5 text-[10px] uppercase" style={{ background: STATUS_COLORS[t.status] }}>{t.status}</span>
                    <span className="text-[10px] text-black/50">{new Date(t.created_at).toLocaleString("es-ES")}</span>
                  </div>
                  <div className="font-bold text-sm">{t.asunto}</div>
                  <div className="text-[10px] text-black/60">{t.owner_email}</div>
                </div>
                <select value={t.status} onChange={(e) => setStatus(t.id, e.target.value)} className="text-[10px] border-2 border-black px-1 py-0.5 bg-white">
                  <option value="abierto">abierto</option><option value="en_proceso">en proceso</option><option value="resuelto">resuelto</option><option value="cerrado">cerrado</option>
                </select>
              </div>
              <button onClick={() => setExpanded(expanded === t.id ? null : t.id)} className="text-[10px] text-black/60 underline">{expanded === t.id ? "Ocultar detalles" : "Ver detalles"}</button>
              {expanded === t.id && (
                <div className="mt-2 space-y-2">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-black/50">Problema cliente:</div>
                    <p className="text-xs whitespace-pre-wrap bg-[color:var(--cream)] p-2 border border-black/30">{t.problema_cliente}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase text-black/50">Diagnóstico Tomás:</div>
                    <p className="text-xs whitespace-pre-wrap bg-[#FFF4D6] p-2 border-l-2 border-[#F5C518]">{t.diagnostico_tomas}</p>
                  </div>
                  {t.contexto_cliente && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-[10px] font-mono uppercase text-black/50">Contexto cliente</summary>
                      <pre className="bg-black text-white p-2 mt-1 overflow-x-auto text-[10px]">{JSON.stringify(t.contexto_cliente, null, 2)}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
