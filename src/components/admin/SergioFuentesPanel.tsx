"use client";
import { useState } from "react";
import type { Source, SourceType, Frequency, SourceCategory } from "@/lib/sergio-db";

const TYPE_LABELS: Record<SourceType, string> = {
  web: "🌐 Web", linkedin: "💼 LinkedIn", crunchbase: "💰 Crunchbase",
  reviews: "⭐ Reseñas", reddit: "💬 Reddit", ads: "📢 Anuncios", seo: "🔍 SEO",
};

const FREQ_LABELS: Record<Frequency, string> = {
  daily: "Diario", weekly: "Semanal", biweekly: "Quincenal",
};

const CAT_LABELS: Record<SourceCategory, string> = {
  direct_competitor: "Competidor directo",
  adjacent: "Adyacente",
  inspiration: "Referente",
};

function relevanceBadge(r: string) {
  const map: Record<string, string> = { critical: "bg-red-500", high: "bg-orange-500", medium: "bg-yellow-500", low: "bg-gray-500" };
  return map[r] ?? "bg-gray-500";
}

export default function SergioFuentesPanel({ sources, pendingChanges }: { sources: Source[]; pendingChanges: number }) {
  const [list, setList] = useState<Source[]>(sources);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState("");
  const [form, setForm] = useState({
    url: "", competitor_name: "", type: "web" as SourceType,
    category: "direct_competitor" as SourceCategory, frequency: "weekly" as Frequency,
  });

  async function addSource() {
    if (!form.url || !form.competitor_name) return;
    setLoading("add");
    const res = await fetch("/api/sergio/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.source) {
      setList((prev) => [data.source, ...prev]);
      setForm({ url: "", competitor_name: "", type: "web", category: "direct_competitor", frequency: "weekly" });
      setShowForm(false);
    }
    setLoading("");
  }

  async function toggleSource(id: string, active: boolean) {
    setList((prev) => prev.map((s) => s.id === id ? { ...s, active } : s));
    await fetch("/api/sergio/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id, active }),
    });
  }

  async function deleteSource(id: string) {
    setList((prev) => prev.filter((s) => s.id !== id));
    await fetch("/api/sergio/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
  }

  async function scrapeNow(sourceId: string) {
    setLoading(sourceId);
    await fetch("/api/cron/sergio-scraper", { headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ""}` } });
    setLoading("");
  }

  return (
    <div className="space-y-4">
      {/* Añadir fuente */}
      <div className="border border-white/20 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-sm text-[#00ff41]">▶ AÑADIR FUENTE DE RECONOCIMIENTO</span>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs font-mono border border-[#00ff41]/50 px-3 py-1.5 text-[#00ff41] hover:bg-[#00ff41]/10"
          >
            {showForm ? "✕ CANCELAR" : "+ NUEVA FUENTE"}
          </button>
        </div>

        {showForm && (
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-xs font-mono text-white/60 block mb-1">COMPETIDOR</label>
              <input
                value={form.competitor_name}
                onChange={(e) => setForm((f) => ({ ...f, competitor_name: e.target.value }))}
                placeholder="Ej: Clínica Dental Rival"
                className="w-full bg-black border border-white/30 text-white px-3 py-2 text-sm font-mono focus:border-[#00ff41] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-white/60 block mb-1">URL</label>
              <input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://competidor.com"
                className="w-full bg-black border border-white/30 text-white px-3 py-2 text-sm font-mono focus:border-[#00ff41] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-white/60 block mb-1">TIPO</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as SourceType }))}
                className="w-full bg-black border border-white/30 text-white px-3 py-2 text-sm font-mono focus:border-[#00ff41] outline-none"
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-mono text-white/60 block mb-1">FRECUENCIA</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as Frequency }))}
                className="w-full bg-black border border-white/30 text-white px-3 py-2 text-sm font-mono focus:border-[#00ff41] outline-none"
              >
                {Object.entries(FREQ_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-mono text-white/60 block mb-1">CATEGORÍA</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as SourceCategory }))}
                className="w-full bg-black border border-white/30 text-white px-3 py-2 text-sm font-mono focus:border-[#00ff41] outline-none"
              >
                {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={addSource}
                disabled={loading === "add"}
                className="w-full bg-[#00ff41] text-black font-mono font-bold text-sm py-2 hover:bg-[#00cc33] disabled:opacity-50"
              >
                {loading === "add" ? "AÑADIENDO…" : "▶ AÑADIR FUENTE"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de fuentes */}
      {list.length === 0 ? (
        <div className="border border-white/20 p-8 text-center font-mono text-white/40">
          SIN FUENTES CONFIGURADAS · AÑADE LA PRIMERA FUENTE DE RECONOCIMIENTO
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((s) => (
            <div key={s.id} className={`border p-4 ${s.active ? "border-[#00ff41]/30" : "border-white/10 opacity-50"}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono font-bold text-white">{s.competitor_name}</span>
                    <span className="text-xs font-mono text-[#00ff41]/70">{TYPE_LABELS[s.type]}</span>
                    <span className="text-xs font-mono text-white/40">{CAT_LABELS[s.category]}</span>
                    <span className="text-xs font-mono text-white/40">{FREQ_LABELS[s.frequency]}</span>
                  </div>
                  <div className="text-xs font-mono text-white/40 truncate">{s.url}</div>
                  {s.last_scraped_at && (
                    <div className="text-xs font-mono text-white/30 mt-1">
                      Último scraping: {new Date(s.last_scraped_at).toLocaleString("es-ES")}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => toggleSource(s.id, !s.active)}
                    className={`text-xs font-mono border px-2 py-1 ${s.active ? "border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10" : "border-[#00ff41]/50 text-[#00ff41] hover:bg-[#00ff41]/10"}`}
                  >
                    {s.active ? "PAUSAR" : "ACTIVAR"}
                  </button>
                  <button
                    onClick={() => deleteSource(s.id)}
                    className="text-xs font-mono border border-red-500/50 text-red-400 px-2 py-1 hover:bg-red-500/10"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="border border-white/10 p-4 mt-4">
        <div className="text-xs font-mono text-white/40 mb-3">▶ ACCIONES</div>
        <div className="flex gap-2 flex-wrap">
          <a href="/admin/sergio/cambios" className="text-xs font-mono border border-white/30 px-3 py-2 text-white hover:border-[#00ff41] hover:text-[#00ff41]">
            📋 Ver cambios detectados {pendingChanges > 0 && `(${pendingChanges} nuevos)`}
          </a>
          <a href="/admin/sergio" className="text-xs font-mono border border-white/30 px-3 py-2 text-white hover:border-[#00ff41] hover:text-[#00ff41]">
            🕵️ Panel Sergio
          </a>
        </div>
      </div>
    </div>
  );
}
