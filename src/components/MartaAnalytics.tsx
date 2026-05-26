"use client";
import { useEffect, useState } from "react";

type Post = {
  id: string;
  tipo_post: string;
  titulo: string | null;
  publicado_at: string | null;
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  engagement_rate: number | null;
  performance_tier: string | null;
};

type Summary = {
  total: number;
  top_count: number;
  avg_engagement: number;
  best_tipo: string | null;
  best_day: string | null;
};

type Recomendacion = {
  id: string;
  titulo: string;
  insight: string;
  accion_sugerida: string;
  prioridad: "alta" | "media" | "baja";
  created_at: string;
};

const TIER_COLORS: Record<string, string> = {
  top: "#14B8A6",
  above_avg: "#F5C518",
  avg: "#9CA3AF",
  below_avg: "#EF4444",
};

const PRIO_COLORS: Record<string, string> = {
  alta: "#EF4444",
  media: "#F5C518",
  baja: "#9CA3AF",
};

export default function MartaAnalytics() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recs, setRecs] = useState<Recomendacion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);

  const [form, setForm] = useState({
    ig_media_id: "",
    tipo_post: "post" as "post" | "reel" | "carrusel" | "story",
    titulo: "",
    hashtags: "",
    publicado_at: new Date().toISOString().slice(0, 10),
    impressions: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    shares: 0,
  });

  async function load() {
    try {
      const r = await fetch("/api/marta/analytics");
      const j = await r.json();
      setPosts(j.posts || []);
      setSummary(j.summary || null);
      setRecs(j.recomendaciones || []);
    } catch { /* */ }
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/marta/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json();
        alert(j.error || "Error");
      } else {
        setForm({
          ig_media_id: "",
          tipo_post: "post",
          titulo: "",
          hashtags: "",
          publicado_at: new Date().toISOString().slice(0, 10),
          impressions: 0,
          reach: 0,
          likes: 0,
          comments: 0,
          saves: 0,
          shares: 0,
        });
        setShowForm(false);
        load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function regenerar() {
    setRegenBusy(true);
    try {
      const res = await fetch("/api/marta/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerar_recomendaciones" }),
      });
      const j = await res.json();
      if (res.ok) alert(`✓ ${j.generadas} recomendaciones nuevas`);
      load();
    } finally {
      setRegenBusy(false);
    }
  }

  async function actRec(id: string, action: "aceptar" | "descartar") {
    await fetch("/api/marta/analytics", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recId: id, action }),
    });
    load();
  }

  return (
    <div className="card-hard p-5 bg-white border-[#14B8A6]">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-stencil text-2xl">📊 Analytics y auto-mejora</h3>
        <div className="flex gap-2">
          <button onClick={() => setShowForm((s) => !s)} className="border-2 border-black px-3 py-1 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white">
            {showForm ? "Cerrar" : "+ Registrar post"}
          </button>
          <button onClick={regenerar} disabled={regenBusy || posts.length < 3} className="btn-mustard text-xs disabled:opacity-50">
            {regenBusy ? "Analizando…" : "🧠 Re-generar recomendaciones"}
          </button>
        </div>
      </div>
      <p className="text-xs text-black/60 mb-3">
        Registra métricas de tus posts (manual hoy, automático cuando Meta apruebe Insights). Marta detecta patrones y te dice qué hacer mañana.
      </p>

      {/* Summary */}
      {summary && summary.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <Mini label="Posts" value={summary.total} />
          <Mini label="Top engagement" value={summary.top_count} color="#14B8A6" />
          <Mini label="Engagement medio" value={`${summary.avg_engagement}%`} />
          <Mini label="Mejor día" value={summary.best_day || "—"} small />
        </div>
      )}

      {/* Formulario manual */}
      {showForm && (
        <form onSubmit={submit} className="card-hard p-4 bg-[color:var(--cream)] mb-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-mono uppercase tracking-widest mb-1">Tipo</span>
              <select value={form.tipo_post} onChange={(e) => setForm({ ...form, tipo_post: e.target.value as "post" | "reel" | "carrusel" | "story" })} className="w-full border-2 border-black px-3 py-2 text-sm bg-white">
                <option value="post">Post</option>
                <option value="reel">Reel</option>
                <option value="carrusel">Carrusel</option>
                <option value="story">Story</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-mono uppercase tracking-widest mb-1">Publicado el</span>
              <input type="date" value={form.publicado_at} onChange={(e) => setForm({ ...form, publicado_at: e.target.value })} className="w-full border-2 border-black px-3 py-2 text-sm" />
            </label>
          </div>
          <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título / tema del post" className="w-full border-2 border-black px-3 py-2 text-sm" />
          <input value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} placeholder="Hashtags" className="w-full border-2 border-black px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <NumberField label="Reach" value={form.reach} onChange={(v) => setForm({ ...form, reach: v })} />
            <NumberField label="Likes" value={form.likes} onChange={(v) => setForm({ ...form, likes: v })} />
            <NumberField label="Comments" value={form.comments} onChange={(v) => setForm({ ...form, comments: v })} />
            <NumberField label="Saves" value={form.saves} onChange={(v) => setForm({ ...form, saves: v })} />
            <NumberField label="Shares" value={form.shares} onChange={(v) => setForm({ ...form, shares: v })} />
            <NumberField label="Impresiones" value={form.impressions} onChange={(v) => setForm({ ...form, impressions: v })} />
          </div>
          <button type="submit" disabled={busy} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Guardando…" : "Guardar métricas"}</button>
        </form>
      )}

      {/* Recomendaciones destacadas */}
      {recs.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="text-xs font-mono uppercase tracking-widest text-[#14B8A6] font-bold">💡 RECOMENDACIONES MARTA</div>
          {recs.map((r) => (
            <div key={r.id} className="border-2 border-black bg-[#14B8A6]/10 p-3">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border-2 border-black text-white" style={{ backgroundColor: PRIO_COLORS[r.prioridad] }}>{r.prioridad}</span>
                <span className="font-bold text-sm">{r.titulo}</span>
              </div>
              <p className="text-sm text-black/80 mb-1"><b>Insight:</b> {r.insight}</p>
              <p className="text-sm text-black/80 mb-2"><b>👉 Acción:</b> {r.accion_sugerida}</p>
              <div className="flex gap-2">
                <button onClick={() => actRec(r.id, "aceptar")} className="text-[10px] font-bold uppercase tracking-widest border-2 border-[#14B8A6] text-[#14B8A6] px-2 py-1 hover:bg-[#14B8A6] hover:text-white">✓ Aceptar</button>
                <button onClick={() => actRec(r.id, "descartar")} className="text-[10px] font-bold uppercase tracking-widest border-2 border-black/30 text-black/60 px-2 py-1 hover:bg-black/10">Descartar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabla posts */}
      {posts.length === 0 ? (
        <p className="text-sm text-black/50 text-center py-6">
          Aún no hay posts registrados. Pulsa &quot;Registrar post&quot; arriba para empezar a alimentar el aprendizaje.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b-2 border-black">
              <tr>
                <th className="text-left p-2">Fecha</th>
                <th className="text-left p-2">Tipo</th>
                <th className="text-left p-2">Título</th>
                <th className="text-right p-2">Reach</th>
                <th className="text-right p-2">Likes</th>
                <th className="text-right p-2">Comments</th>
                <th className="text-right p-2">Saves</th>
                <th className="text-right p-2">Engagement</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-b border-black/10">
                  <td className="p-2 font-mono">{p.publicado_at ? new Date(p.publicado_at).toLocaleDateString("es-ES") : "—"}</td>
                  <td className="p-2"><span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-black/40">{p.tipo_post}</span></td>
                  <td className="p-2 max-w-xs truncate">{p.titulo || "—"}</td>
                  <td className="p-2 text-right font-mono">{p.reach}</td>
                  <td className="p-2 text-right font-mono">{p.likes}</td>
                  <td className="p-2 text-right font-mono">{p.comments}</td>
                  <td className="p-2 text-right font-mono">{p.saves}</td>
                  <td className="p-2 text-right font-mono font-bold" style={{ color: TIER_COLORS[p.performance_tier || "avg"] }}>{p.engagement_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, color, small }: { label: string; value: number | string; color?: string; small?: boolean }) {
  return (
    <div className="card-hard p-3 bg-white">
      <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">{label}</div>
      <div className={`font-stencil ${small ? "text-xl" : "text-3xl"} mt-1`} style={{ color: color || "#000" }}>{value}</div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-mono uppercase tracking-widest mb-1">{label}</span>
      <input type="number" min={0} value={value} onChange={(e) => onChange(parseInt(e.target.value) || 0)} className="w-full border-2 border-black px-2 py-1 text-sm" />
    </label>
  );
}
