"use client";
import { useEffect, useState } from "react";

type Suggestion = {
  id: string;
  rule_text: string;
  evidence: string;
  pattern_type: string;
  source_edits_count: number;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  tono: "Tono",
  vocabulario: "Vocabulario",
  formato: "Formato",
  prohibicion: "Lo que NO hacer",
  otro: "Patrón",
};

const TYPE_COLORS: Record<string, string> = {
  tono: "#A88BE8",
  vocabulario: "#60A5FA",
  formato: "#F5C518",
  prohibicion: "#EF4444",
  otro: "#6B7280",
};

export default function MartaSuggestions() {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/marta/suggestions");
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.suggestions || []);
    } catch {
      /* silencioso */
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: "accept" | "reject" | "dismiss") {
    setBusyId(id);
    try {
      await fetch("/api/marta/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  }

  if (!items || items.length === 0) return null;

  return (
    <div className="mt-8 card-hard p-5 bg-[#14B8A6]/10 border-[#14B8A6]">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="font-stencil text-2xl">
            💡 Marta ha aprendido cosas nuevas
          </h3>
          <p className="text-xs font-mono text-black/60 mt-1">
            {items.length} patrón{items.length !== 1 ? "es" : ""} detectado{items.length !== 1 ? "s" : ""} en tus
            ediciones recientes · Acepta para que Marta los aplique siempre
          </p>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="border-2 border-black px-2 py-1 text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-[color:var(--mustard)]"
        >
          {collapsed ? "Ver" : "Ocultar"}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-3">
          {items.map((s) => (
            <div key={s.id} className="border-2 border-black bg-white p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <span
                  className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border-2 border-black text-white"
                  style={{ backgroundColor: TYPE_COLORS[s.pattern_type] || "#000" }}
                >
                  {TYPE_LABELS[s.pattern_type] || s.pattern_type}
                </span>
                <span className="text-[10px] font-mono text-black/40">
                  Detectado en {s.source_edits_count} ediciones tuyas
                </span>
              </div>

              <p className="text-sm font-bold mb-2">{s.rule_text}</p>

              {s.evidence && (
                <p className="text-[11px] font-mono text-black/60 italic border-l-2 border-black/20 pl-2 mb-3">
                  Ejemplo: {s.evidence}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => act(s.id, "accept")}
                  disabled={busyId === s.id}
                  className="btn-mustard text-xs disabled:opacity-50"
                >
                  ✓ Aceptar y aplicar siempre
                </button>
                <button
                  onClick={() => act(s.id, "dismiss")}
                  disabled={busyId === s.id}
                  className="border-2 border-black px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white disabled:opacity-50"
                >
                  Ahora no
                </button>
                <button
                  onClick={() => act(s.id, "reject")}
                  disabled={busyId === s.id}
                  className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-[color:var(--red)] hover:text-white disabled:opacity-50"
                >
                  ✗ No es regla
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
