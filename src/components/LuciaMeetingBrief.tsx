"use client";
import { useEffect, useState } from "react";

type Brief = { id: string; meeting_with: string; meeting_at: string | null; brief_text: string; topics: string[]; created_at: string };

export default function LuciaMeetingBrief() {
  const [items, setItems] = useState<Brief[]>([]);
  const [form, setForm] = useState({ meeting_with: "", meeting_at: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() { const r = await fetch("/api/lucia/meeting-brief"); const j = await r.json(); setItems(j.items || []); }
  useEffect(() => { load(); }, []);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!form.meeting_with.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/lucia/meeting-brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meeting_with: form.meeting_with, meeting_at: form.meeting_at || undefined, related_emails: [] }) });
      const j = await r.json();
      if (!r.ok) alert(j.error);
      else { setForm({ meeting_with: "", meeting_at: "" }); setShow(false); load(); }
    } finally { setBusy(false); }
  }
  return (
    <div className="card-hard p-5 bg-white border-[#F5C518]">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <h3 className="font-stencil text-2xl">📋 Briefs de reunión</h3>
        <button onClick={() => setShow((s) => !s)} className="text-[10px] font-bold uppercase border-2 border-black px-2 py-1">{show ? "Cerrar" : "+ Generar brief"}</button>
      </div>
      <p className="text-xs text-black/60 mb-3">Antes de cada reunión Lucía te prepara contexto + temas + preguntas.</p>
      {show && (
        <form onSubmit={go} className="card-hard p-3 bg-[color:var(--cream)] space-y-2 mb-3">
          <input value={form.meeting_with} onChange={(e) => setForm({ ...form, meeting_with: e.target.value })} placeholder="Con quién (nombre o email)*" required className="w-full border-2 border-black px-2 py-1 text-sm" />
          <input type="datetime-local" value={form.meeting_at} onChange={(e) => setForm({ ...form, meeting_at: e.target.value })} className="w-full border-2 border-black px-2 py-1 text-sm" />
          <button type="submit" disabled={busy} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Generando…" : "🧠 Generar brief"}</button>
        </form>
      )}
      {items.length === 0 ? <p className="text-sm text-black/50 text-center py-3">Sin briefs aún.</p> : (
        <div className="space-y-2">{items.map((b) => (
          <details key={b.id} className="border-2 border-black bg-white p-2">
            <summary className="cursor-pointer flex justify-between gap-2 flex-wrap">
              <div className="text-sm"><b>🤝 {b.meeting_with}</b>{b.meeting_at && <span className="text-[10px] text-black/60 ml-2">{new Date(b.meeting_at).toLocaleString("es-ES")}</span>}</div>
              {b.topics?.length > 0 && <div className="text-[10px] text-black/60">{b.topics.length} temas</div>}
            </summary>
            <div className="mt-2 text-xs text-black/80 whitespace-pre-wrap">{b.brief_text}</div>
            {b.topics?.length > 0 && (<div className="mt-2 flex gap-1 flex-wrap">{b.topics.map((t, i) => (<span key={i} className="text-[10px] border border-black/40 px-1.5 py-0.5">{t}</span>))}</div>)}
          </details>
        ))}</div>
      )}
    </div>
  );
}
