"use client";
import { useEffect, useState } from "react";

type Lead = { id: string; phone: string; nombre: string | null; etapa: string; tags: string[]; notas: string | null; valor_estim: number | null; ultima_actividad_at: string };

const ETAPAS = ["nuevo", "conversacion", "cita_programada", "cliente", "recurrente", "perdido"];
const COLORS: Record<string, string> = { nuevo: "#94A3B8", conversacion: "#FBBF24", cita_programada: "#A88BE8", cliente: "#14B8A6", recurrente: "#06B6D4", perdido: "#EF4444" };

export default function PabloPipeline() {
  const [items, setItems] = useState<Lead[]>([]);
  const [form, setForm] = useState({ phone: "", nombre: "", fuente: "" });
  const [show, setShow] = useState(false);

  async function load() { const r = await fetch("/api/pablo/leads"); const j = await r.json(); setItems(j.items || []); }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.phone.trim()) return;
    await fetch("/api/pablo/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ phone: "", nombre: "", fuente: "" });
    setShow(false); load();
  }
  async function moveEtapa(id: string, etapa: string) {
    await fetch("/api/pablo/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", id, etapa }) });
    load();
  }
  async function del(id: string) { if (!confirm("¿Borrar lead?")) return; await fetch("/api/pablo/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) }); load(); }

  return (
    <div className="card-hard p-5 bg-white border-[#25D366]">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <h3 className="font-stencil text-2xl">🎯 Pipeline CRM</h3>
        <button onClick={() => setShow((s) => !s)} className="text-[10px] font-bold uppercase border-2 border-black px-2 py-1">{show ? "Cerrar" : "+ Lead"}</button>
      </div>
      <p className="text-xs text-black/60 mb-3">Gestiona tus leads WhatsApp en kanban visual: nuevo → conversación → cita → cliente → recurrente.</p>

      {show && (
        <form onSubmit={add} className="card-hard p-3 bg-[color:var(--cream)] space-y-2 mb-3">
          <div className="grid sm:grid-cols-3 gap-2">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Teléfono*" required className="border-2 border-black px-2 py-1 text-sm" />
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre" className="border-2 border-black px-2 py-1 text-sm" />
            <input value={form.fuente} onChange={(e) => setForm({ ...form, fuente: e.target.value })} placeholder="Fuente (qr, web…)" className="border-2 border-black px-2 py-1 text-sm" />
          </div>
          <button type="submit" className="btn-mustard text-xs">Crear</button>
        </form>
      )}

      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-2">
        {ETAPAS.map((etapa) => {
          const cuenta = items.filter((l) => l.etapa === etapa);
          return (
            <div key={etapa} className="border-2 border-black bg-[color:var(--cream)] p-2">
              <div className="text-[10px] font-bold uppercase mb-2 flex justify-between items-center" style={{ color: COLORS[etapa] }}>
                <span>{etapa.replace("_", " ")}</span><span className="bg-black text-white px-1.5 rounded">{cuenta.length}</span>
              </div>
              <div className="space-y-1 min-h-[60px]">
                {cuenta.map((l) => (
                  <div key={l.id} className="bg-white border-2 border-black p-2 text-[10px]">
                    <div className="font-bold truncate">{l.nombre || l.phone}</div>
                    <div className="text-black/50 truncate">{l.phone}</div>
                    {l.tags?.length > 0 && <div className="flex gap-0.5 flex-wrap mt-1">{l.tags.slice(0, 2).map((t, i) => (<span key={i} className="border border-black/40 px-1">{t}</span>))}</div>}
                    <select value={l.etapa} onChange={(e) => moveEtapa(l.id, e.target.value)} className="w-full mt-1 border border-black/40 text-[9px] py-0.5 bg-white">
                      {ETAPAS.map((e) => (<option key={e} value={e}>{e}</option>))}
                    </select>
                    <button onClick={() => del(l.id)} className="text-[9px] text-[color:var(--red)] mt-1">✕ Borrar</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
