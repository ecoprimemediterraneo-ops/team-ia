"use client";
import { useEffect, useState } from "react";

type InboxItem = {
  kind: "dm" | "comment" | "mention" | "lead";
  id: string;
  who: string;
  preview: string;
  intent: string | null;
  confidence: number | null;
  status: string;
  created_at: string;
  conversation_id: string | null;
};

type Counts = {
  total: number;
  dm: number;
  comment: number;
  mention: number;
  lead: number;
  escalated: number;
};

const KIND_ICON: Record<string, string> = {
  dm: "💬",
  comment: "💭",
  mention: "📣",
  lead: "🎯",
};

const KIND_LABEL: Record<string, string> = {
  dm: "DM",
  comment: "Comentario",
  mention: "Mención",
  lead: "Lead",
};

const KIND_COLOR: Record<string, string> = {
  dm: "#FF7A59",
  comment: "#A88BE8",
  mention: "#F5C518",
  lead: "#14B8A6",
};

const FILTERS: Array<{ v: "all" | "dm" | "comment" | "mention" | "lead"; l: string }> = [
  { v: "all", l: "Todo" },
  { v: "dm", l: "💬 DMs" },
  { v: "comment", l: "💭 Comentarios" },
  { v: "mention", l: "📣 Menciones" },
  { v: "lead", l: "🎯 Leads" },
];

export default function MartaInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [filter, setFilter] = useState<"all" | "dm" | "comment" | "mention" | "lead">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const r = await fetch(`/api/marta/inbox?filter=${filter}`);
      const j = await r.json();
      setItems(j.items || []);
      setCounts(j.counts || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();
    const i = setInterval(load, 30_000);
    return () => clearInterval(i);
  }, [filter]);

  const filtered = search
    ? items.filter((i) =>
        i.who.toLowerCase().includes(search.toLowerCase()) ||
        i.preview.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div className="card-hard p-5 bg-white">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-stencil text-2xl">📥 Bandeja unificada</h3>
        {counts && (
          <span className="text-xs font-mono text-black/50">
            {counts.total} items {counts.escalated > 0 && <span className="text-[color:var(--red)] font-bold">· {counts.escalated} escalados</span>}
          </span>
        )}
      </div>
      <p className="text-xs text-black/60 mb-3">
        Todo lo que llega a tu Instagram en un solo sitio: DMs, comentarios, menciones en stories y leads cualificados.
      </p>

      {/* Counts row */}
      {counts && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          <CountChip label="Total" value={counts.total} color="#000" active={filter === "all"} onClick={() => setFilter("all")} />
          <CountChip label="DMs" value={counts.dm} color="#FF7A59" active={filter === "dm"} onClick={() => setFilter("dm")} />
          <CountChip label="Comentarios" value={counts.comment} color="#A88BE8" active={filter === "comment"} onClick={() => setFilter("comment")} />
          <CountChip label="Menciones" value={counts.mention} color="#F5C518" active={filter === "mention"} onClick={() => setFilter("mention")} />
          <CountChip label="Leads" value={counts.lead} color="#14B8A6" active={filter === "lead"} onClick={() => setFilter("lead")} />
        </div>
      )}

      {/* Filter row + search */}
      <div className="flex gap-2 flex-wrap mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={`text-xs font-bold uppercase tracking-widest border-2 border-black px-3 py-1 ${filter === f.v ? "bg-black text-[color:var(--mustard)]" : "bg-white hover:bg-[color:var(--cream)]"}`}
          >
            {f.l}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por usuario o texto…"
          className="flex-1 min-w-[200px] border-2 border-black px-3 py-1 text-xs shadow-[2px_2px_0_#000]"
        />
      </div>

      {loading ? (
        <p className="text-sm text-black/50">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-black/50 text-center py-8">
          {search ? "Sin resultados para esa búsqueda." : "Aún no hay actividad. Cuando lleguen DMs, comentarios o menciones aparecerán aquí."}
        </p>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.map((item) => (
            <div
              key={`${item.kind}-${item.id}`}
              className={`border-2 border-black p-3 ${item.status === "escalated" ? "bg-[color:var(--red)]/10" : "bg-white"}`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">{KIND_ICON[item.kind]}</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border-2 border-black text-white" style={{ backgroundColor: KIND_COLOR[item.kind] }}>
                    {KIND_LABEL[item.kind]}
                  </span>
                  <span className="font-bold text-sm">@{item.who}</span>
                  {item.intent && (
                    <span className="text-[10px] font-mono text-black/50">· {item.intent}</span>
                  )}
                  {item.confidence !== null && (
                    <span className="text-[10px] font-mono text-black/40">· conf {item.confidence.toFixed(2)}</span>
                  )}
                  {item.status === "escalated" && (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border-2 border-[color:var(--red)] bg-[color:var(--red)] text-white">
                      ⚠ ESCALADO
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-black/40">{new Date(item.created_at).toLocaleString("es-ES")}</span>
              </div>
              <p className="text-sm text-black/80 pl-7">{item.preview}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CountChip({ label, value, color, active, onClick }: { label: string; value: number; color: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`card-hard p-3 text-left transition-all ${active ? "ring-4 ring-black" : ""}`}
      style={{ borderColor: color }}
    >
      <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">{label}</div>
      <div className="font-stencil text-3xl" style={{ color }}>{value}</div>
    </button>
  );
}
