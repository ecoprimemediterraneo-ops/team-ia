"use client";
import { useEffect, useState } from "react";

type Slot = {
  id: string;
  day: number; // 0-6 (lunes=0)
  hour: number; // 0-23
  platform: "instagram" | "linkedin" | "tiktok" | "facebook";
  topic: string;
  status: "idea" | "borrador" | "listo" | "publicado";
};

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const PLATFORMS = {
  instagram: { color: "#FF7A59", emoji: "📸" },
  linkedin: { color: "#0A66C2", emoji: "💼" },
  tiktok: { color: "#000000", emoji: "🎵" },
  facebook: { color: "#1877F2", emoji: "👥" },
};
const STATUS_COLOR = {
  idea: "bg-gray-200",
  borrador: "bg-yellow-200",
  listo: "bg-green-200",
  publicado: "bg-black text-white",
};

const KEY = "aiteam-marta-calendar";

export default function MartaEditorialCalendar() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [draft, setDraft] = useState<Omit<Slot, "id">>({
    day: 0,
    hour: 10,
    platform: "instagram",
    topic: "",
    status: "idea",
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSlots(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function persist(next: Slot[]) {
    setSlots(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  function add() {
    if (!draft.topic.trim()) return;
    persist([
      { ...draft, id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` },
      ...slots,
    ]);
    setDraft({ ...draft, topic: "" });
    setShowForm(false);
  }

  function remove(id: string) {
    persist(slots.filter((s) => s.id !== id));
  }

  function changeStatus(id: string, status: Slot["status"]) {
    persist(slots.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  async function generateWithAI() {
    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch("/api/marta/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeks: 4 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      persist([...data.slots, ...slots]);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="card-hard p-5 mt-6">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-stencil text-2xl">📅 Calendario editorial</h3>
          <p className="text-sm text-black/60 mt-1">Planifica tus posts por semana. Arrastra ideas → borradores → listos → publicados.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={generateWithAI} disabled={generating} className="btn-mustard text-xs">
            {generating ? "GENERANDO…" : "🤖 AUTO-GENERAR 4 SEMANAS"}
          </button>
          <button onClick={() => setShowForm(!showForm)} className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white">
            {showForm ? "CERRAR" : "+ AÑADIR"}
          </button>
        </div>
      </div>

      {genError && <div className="mb-3 bg-red-100 border-2 border-black p-2 text-xs">⚠ {genError}</div>}

      {showForm && (
        <div className="mb-4 p-3 border-2 border-black bg-[color:var(--cream)] grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select value={draft.day} onChange={(e) => setDraft({ ...draft, day: Number(e.target.value) })} className="border-2 border-black px-2 py-1.5 text-sm bg-white">
            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <select value={draft.hour} onChange={(e) => setDraft({ ...draft, hour: Number(e.target.value) })} className="border-2 border-black px-2 py-1.5 text-sm bg-white">
            {Array.from({ length: 24 }).map((_, h) => <option key={h} value={h}>{h.toString().padStart(2, "0")}:00</option>)}
          </select>
          <select value={draft.platform} onChange={(e) => setDraft({ ...draft, platform: e.target.value as Slot["platform"] })} className="border-2 border-black px-2 py-1.5 text-sm bg-white">
            <option value="instagram">📸 Instagram</option>
            <option value="linkedin">💼 LinkedIn</option>
            <option value="tiktok">🎵 TikTok</option>
            <option value="facebook">👥 Facebook</option>
          </select>
          <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Slot["status"] })} className="border-2 border-black px-2 py-1.5 text-sm bg-white">
            <option value="idea">💡 Idea</option>
            <option value="borrador">📝 Borrador</option>
            <option value="listo">✓ Listo</option>
            <option value="publicado">📤 Publicado</option>
          </select>
          <input value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} placeholder="Tema del post" className="col-span-2 sm:col-span-3 border-2 border-black px-2 py-1.5 text-sm" />
          <button onClick={add} className="btn-mustard text-xs">✓ AÑADIR</button>
        </div>
      )}

      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((d, i) => {
          const daySlots = slots.filter((s) => s.day === i).sort((a, b) => a.hour - b.hour);
          return (
            <div key={i} className="border-2 border-black p-2 bg-white min-h-[120px]">
              <div className="font-stencil text-sm border-b border-black/20 pb-1 mb-2">{d}</div>
              <ul className="space-y-1">
                {daySlots.map((s) => {
                  const p = PLATFORMS[s.platform];
                  return (
                    <li key={s.id} className={`text-[10px] p-1 border ${STATUS_COLOR[s.status]} relative group`}>
                      <div className="flex items-center justify-between">
                        <span style={{ color: p.color }}>{p.emoji}</span>
                        <span className="font-mono">{s.hour.toString().padStart(2, "0")}h</span>
                      </div>
                      <div className="leading-tight">{s.topic}</div>
                      <div className="absolute right-0 top-0 hidden group-hover:flex flex-col gap-0.5 bg-white border-2 border-black p-1 z-10">
                        <select value={s.status} onChange={(e) => changeStatus(s.id, e.target.value as Slot["status"])} className="text-[9px] border border-black/30">
                          <option value="idea">Idea</option>
                          <option value="borrador">Borrador</option>
                          <option value="listo">Listo</option>
                          <option value="publicado">Publicado</option>
                        </select>
                        <button onClick={() => remove(s.id)} className="text-[9px] hover:text-[color:var(--red)]">× quitar</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="mt-3 p-2 border border-[color:var(--mustard)] bg-[color:var(--mustard)]/15 text-[11px] text-black/70">
        ⚠️ Datos guardados solo en este navegador. Próximamente se sincronizarán automáticamente con tu cuenta.
      </div>
      <p className="text-[10px] text-black/40 mt-2 italic">Pasa el ratón sobre un post para cambiar estado o quitar.</p>
    </div>
  );
}
