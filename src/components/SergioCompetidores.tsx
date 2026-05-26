"use client";
import { useEffect, useState } from "react";

type Source = {
  id: string;
  type: string;
  url: string;
  competitor_name: string;
  category: string;
  frequency: string;
  active: boolean;
  created_at: string;
  last_scraped_at: string | null;
};

type ChangeRow = {
  id: string;
  source_id: string;
  change_type: string;
  relevance: string;
  summary: string;
  detected_at: string;
  acknowledged: boolean;
  sergio_sources?: { competitor_name: string; url: string };
};

export default function SergioCompetidores() {
  const [sources, setSources] = useState<Source[]>([]);
  const [changes, setChanges] = useState<ChangeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    competitor_name: "",
    url: "",
    frequency: "weekly",
    category: "direct_competitor",
  });
  const [showForm, setShowForm] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        fetch("/api/sergio/sources"),
        fetch("/api/sergio/changes"),
      ]);
      const sData = await sRes.json();
      const cData = await cRes.json();
      setSources(sData.sources || []);
      setChanges(cData.changes || []);
    } catch {
      setError("No se pudieron cargar tus competidores");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/sergio/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: "web" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setForm({ competitor_name: "", url: "", frequency: "weekly", category: "direct_competitor" });
      setShowForm(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSource(id: string) {
    await fetch("/api/sergio/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id }),
    });
    reload();
  }

  async function deleteSource(id: string) {
    if (!confirm("¿Borrar este competidor? Se perderá el histórico de cambios.")) return;
    await fetch("/api/sergio/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    reload();
  }

  async function ack(id: string) {
    await fetch(`/api/sergio/changes?id=${id}`, { method: "PATCH" });
    reload();
  }

  const pendingChanges = changes.filter((c) => !c.acknowledged);

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-stencil text-3xl">Mis competidores</h2>
          <p className="text-xs font-mono text-black/60 mt-1">
            {sources.length}/10 fuentes · {sources.filter((s) => s.active).length} activas
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            disabled={sources.length >= 10}
            className="btn-mustard text-xs disabled:opacity-50"
          >
            + Añadir competidor
          </button>
        )}
      </div>

      {/* Form añadir */}
      {showForm && (
        <form onSubmit={addSource} className="card-hard p-5 bg-[color:var(--cream)] space-y-3">
          <h3 className="font-stencil text-xl">Nuevo competidor a vigilar</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-mono uppercase tracking-widest mb-1">Nombre *</span>
              <input
                required
                value={form.competitor_name}
                onChange={(e) => setForm({ ...form, competitor_name: e.target.value })}
                placeholder="Ej: Competidor Marbella SL"
                className="w-full border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-mono uppercase tracking-widest mb-1">URL pública *</span>
              <input
                required
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://clinicarival.com"
                className="w-full border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-mono uppercase tracking-widest mb-1">Frecuencia</span>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white shadow-[3px_3px_0_#000]"
              >
                <option value="daily">Cada día (recomendado para precios)</option>
                <option value="weekly">Cada semana</option>
                <option value="biweekly">Cada 2 semanas</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-mono uppercase tracking-widest mb-1">Tipo</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white shadow-[3px_3px_0_#000]"
              >
                <option value="direct_competitor">Competidor directo</option>
                <option value="adjacent">Adyacente / sector cercano</option>
                <option value="inspiration">Inspiración / referente</option>
              </select>
            </label>
          </div>
          {error && (
            <div className="border-2 border-[color:var(--red)] bg-[color:var(--red)]/10 p-2 text-xs font-bold">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-mustard text-xs disabled:opacity-50">
              {saving ? "Añadiendo…" : "Añadir y empezar a vigilar"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="border-[3px] border-black px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista */}
      {loading ? (
        <div className="card-hard p-6 text-center text-sm text-black/50">Cargando…</div>
      ) : sources.length === 0 ? (
        <div className="card-hard p-6 bg-white text-center">
          <p className="text-sm text-black/70 mb-3">No tienes competidores aún.</p>
          <p className="text-xs font-mono text-black/50">
            Añade hasta 10 webs de competidores y Sergio las vigilará. Te avisará por email
            cuando detecte cambios de precios, ofertas o servicios.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="card-hard p-4 bg-white flex items-center justify-between flex-wrap gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{s.competitor_name}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border ${s.active ? "border-[#3B82F6] text-[#3B82F6]" : "border-black/30 text-black/30"}`}>
                    {s.active ? "Vigilando" : "Pausado"}
                  </span>
                  <span className="text-[10px] font-mono text-black/40">{s.frequency}</span>
                </div>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-black/50 hover:text-black underline truncate block">
                  {s.url}
                </a>
                <div className="text-[10px] font-mono text-black/40 mt-1">
                  Último escaneo: {s.last_scraped_at ? new Date(s.last_scraped_at).toLocaleString("es-ES") : "pendiente (primera vigilancia esta noche)"}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleSource(s.id)} className="border-2 border-black px-3 py-1 text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-white">
                  {s.active ? "Pausar" : "Reanudar"}
                </button>
                <button onClick={() => deleteSource(s.id)} className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest hover:bg-[color:var(--red)] hover:text-white">
                  Borrar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cambios recientes */}
      {pendingChanges.length > 0 && (
        <div className="mt-8">
          <h3 className="font-stencil text-2xl mb-3">
            Cambios detectados <span className="text-base text-black/40">({pendingChanges.length} sin revisar)</span>
          </h3>
          <div className="space-y-2">
            {pendingChanges.slice(0, 10).map((c) => (
              <div key={c.id} className="card-hard p-4 bg-white">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border-2 ${
                      c.relevance === "critical" ? "border-[color:var(--red)] bg-[color:var(--red)] text-white" :
                      c.relevance === "high" ? "border-[color:var(--red)] text-[color:var(--red)]" :
                      c.relevance === "medium" ? "border-[color:var(--mustard)] bg-[color:var(--mustard)]" :
                      "border-black/30 text-black/40"
                    }`}>{c.relevance}</span>
                    <span className="text-[10px] font-mono text-black/50">{c.change_type}</span>
                    <span className="font-bold text-sm">{c.sergio_sources?.competitor_name || "—"}</span>
                  </div>
                  <button onClick={() => ack(c.id)} className="border-2 border-black px-2 py-1 text-[10px] font-bold uppercase hover:bg-black hover:text-white">
                    Marcar visto
                  </button>
                </div>
                <p className="text-sm">{c.summary}</p>
                <div className="text-[10px] font-mono text-black/40 mt-1">
                  {new Date(c.detected_at).toLocaleString("es-ES")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
