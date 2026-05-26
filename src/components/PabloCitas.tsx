"use client";
import { useEffect, useState } from "react";

type Cita = { id: string; phone: string; nombre: string | null; servicio: string | null; scheduled_at: string; duracion_min: number; status: string; recordatorio_24h_sent: boolean; recordatorio_2h_sent: boolean; followup_sent: boolean };

export default function PabloCitas() {
  const [items, setItems] = useState<Cita[]>([]);
  const [form, setForm] = useState({ phone: "", nombre: "", servicio: "", scheduled_at: "", duracion_min: 60 });
  const [show, setShow] = useState(false);
  const [preview, setPreview] = useState<{ id: string; r24: string; r2: string; fu: string } | null>(null);

  async function load() { const r = await fetch("/api/pablo/citas"); const j = await r.json(); setItems(j.items || []); }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.phone || !form.scheduled_at) return;
    await fetch("/api/pablo/citas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, scheduled_at: new Date(form.scheduled_at).toISOString() }) });
    setForm({ phone: "", nombre: "", servicio: "", scheduled_at: "", duracion_min: 60 });
    setShow(false); load();
  }
  async function setStatus(id: string, status: string) {
    await fetch("/api/pablo/citas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", id, status }) });
    load();
  }
  async function previewRec(id: string) {
    const r = await fetch("/api/pablo/citas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview_recordatorio", id }) });
    const j = await r.json();
    if (!r.ok) { alert(j.error); return; }
    setPreview({ id, r24: j.recordatorio_24h, r2: j.recordatorio_2h, fu: j.followup });
  }
  async function copy(t: string) { await navigator.clipboard.writeText(t).catch(() => {}); alert("✓ Copiado"); }

  return (
    <div className="card-hard p-5 bg-white border-[#25D366]">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <h3 className="font-stencil text-2xl">📅 Citas + recordatorios</h3>
        <button onClick={() => setShow((s) => !s)} className="text-[10px] font-bold uppercase border-2 border-black px-2 py-1">{show ? "Cerrar" : "+ Cita"}</button>
      </div>
      <p className="text-xs text-black/60 mb-3">Recordatorio 24h antes · confirmación 2h antes · pedir reseña después. Reduce no-shows 30-50%.</p>

      {show && (
        <form onSubmit={add} className="card-hard p-3 bg-[color:var(--cream)] space-y-2 mb-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Teléfono*" required className="border-2 border-black px-2 py-1 text-sm" />
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre" className="border-2 border-black px-2 py-1 text-sm" />
            <input value={form.servicio} onChange={(e) => setForm({ ...form, servicio: e.target.value })} placeholder="Servicio" className="border-2 border-black px-2 py-1 text-sm" />
            <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} required className="border-2 border-black px-2 py-1 text-sm" />
            <input type="number" value={form.duracion_min} onChange={(e) => setForm({ ...form, duracion_min: Number(e.target.value) })} placeholder="Duración (min)" className="border-2 border-black px-2 py-1 text-sm" />
          </div>
          <button type="submit" className="btn-mustard text-xs">Crear cita</button>
        </form>
      )}

      {items.length === 0 ? <p className="text-sm text-black/50 text-center py-3">Sin citas programadas.</p> : (
        <div className="space-y-2">{items.map((c) => (
          <div key={c.id} className="border-2 border-black bg-white p-2">
            <div className="flex justify-between items-center gap-2 flex-wrap mb-1">
              <div className="text-sm">
                <b>{c.nombre || c.phone}</b>
                {c.servicio && <span className="text-black/60"> · {c.servicio}</span>}
                <div className="text-[10px] text-black/60">{new Date(c.scheduled_at).toLocaleString("es-ES")} · {c.duracion_min} min</div>
              </div>
              <select value={c.status} onChange={(e) => setStatus(c.id, e.target.value)} className="text-[10px] border-2 border-black px-1 py-0.5 bg-white">
                <option value="programada">programada</option><option value="confirmada">confirmada</option><option value="completada">completada</option><option value="no_show">no show</option><option value="cancelada">cancelada</option>
              </select>
            </div>
            <button onClick={() => previewRec(c.id)} className="text-[10px] font-bold border border-black px-2 py-0.5 hover:bg-black hover:text-[color:var(--mustard)]">📋 Ver recordatorios</button>
            {preview?.id === c.id && (
              <div className="mt-2 space-y-1 text-[10px]">
                {[{ t: "📨 24h antes", v: preview.r24 }, { t: "⏰ 2h antes", v: preview.r2 }, { t: "🙏 Followup", v: preview.fu }].map((b, i) => (
                  <div key={i} className="bg-[color:var(--cream)] p-2 border border-black/40">
                    <div className="font-bold flex justify-between items-center">{b.t}<button onClick={() => copy(b.v)} className="font-bold border border-black px-1.5">📋</button></div>
                    <p className="mt-1 text-black/80">{b.v}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}</div>
      )}
    </div>
  );
}
