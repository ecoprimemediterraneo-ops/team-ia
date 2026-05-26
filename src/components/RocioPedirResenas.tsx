"use client";
import { useEffect, useState } from "react";

type Pedir = { id: string; cliente_nombre: string | null; cliente_contacto: string; canal: string; mensaje: string; link_resena: string | null; status: string; enviado_at: string | null; created_at: string };

export default function RocioPedirResenas() {
  const [items, setItems] = useState<Pedir[]>([]);
  const [form, setForm] = useState({ cliente_nombre: "", cliente_contacto: "", canal: "whatsapp", link_resena: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() { const r = await fetch("/api/rocio/pedir"); const j = await r.json(); setItems(j.items || []); }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_contacto.trim() || !form.link_resena.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/rocio/pedir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await r.json();
      if (!r.ok) alert(j.error);
      else { setForm({ cliente_nombre: "", cliente_contacto: "", canal: form.canal, link_resena: form.link_resena }); setShow(false); load(); }
    } finally { setBusy(false); }
  }
  async function enviado(id: string) { await fetch("/api/rocio/pedir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "enviado", id }) }); load(); }
  async function copy(text: string) { await navigator.clipboard.writeText(text).catch(() => {}); alert("✓ Copiado"); }

  return (
    <div className="card-hard p-5 bg-white border-[#FBBF24]">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <h3 className="font-stencil text-2xl">📨 Pedir reseñas</h3>
        <button onClick={() => setShow((s) => !s)} className="text-[10px] font-bold uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-[color:var(--mustard)]">{show ? "Cerrar" : "+ Pedir reseña"}</button>
      </div>
      <p className="text-xs text-black/60 mb-3">Genera el mensaje perfecto para pedir reseñas vía WhatsApp/SMS/email.</p>

      {show && (
        <form onSubmit={add} className="card-hard p-3 bg-[color:var(--cream)] space-y-2 mb-3">
          <div className="grid sm:grid-cols-3 gap-2">
            <input value={form.cliente_nombre} onChange={(e) => setForm({ ...form, cliente_nombre: e.target.value })} placeholder="Nombre cliente" className="border-2 border-black px-2 py-1 text-sm" />
            <input value={form.cliente_contacto} onChange={(e) => setForm({ ...form, cliente_contacto: e.target.value })} placeholder="Email o teléfono*" required className="border-2 border-black px-2 py-1 text-sm" />
            <select value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })} className="border-2 border-black px-2 py-1 text-sm bg-white">
              <option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Email</option>
            </select>
          </div>
          <input type="url" value={form.link_resena} onChange={(e) => setForm({ ...form, link_resena: e.target.value })} placeholder="Link Google reseña* (https://g.page/...)" required className="w-full border-2 border-black px-2 py-1 text-sm" />
          <button type="submit" disabled={busy} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Generando…" : "✍️ Generar mensaje"}</button>
        </form>
      )}

      {items.length === 0 ? <p className="text-sm text-black/50 text-center py-3">Sin pedidos aún.</p> : (
        <div className="space-y-2">{items.map((p) => (
          <div key={p.id} className={`border-2 p-2 ${p.status === "enviado" ? "border-[#14B8A6] bg-[#14B8A6]/5" : "border-black bg-white"}`}>
            <div className="flex justify-between items-center mb-1 flex-wrap gap-2">
              <div className="flex gap-2 items-center text-xs">
                <b>{p.cliente_nombre || p.cliente_contacto}</b>
                <span className="text-[10px] font-mono uppercase border border-black/40 px-1.5">{p.canal}</span>
                {p.status === "enviado" && <span className="text-[10px] font-bold bg-[#14B8A6] text-white px-1.5">✓ enviado</span>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => copy(p.mensaje)} className="text-[10px] font-bold border border-black px-2 py-0.5">📋 Copiar</button>
                {p.status !== "enviado" && <button onClick={() => enviado(p.id)} className="text-[10px] font-bold border border-[#14B8A6] text-[#14B8A6] px-2 py-0.5">✓ Marcar enviado</button>}
              </div>
            </div>
            <p className="text-xs text-black/80 whitespace-pre-wrap">{p.mensaje}</p>
          </div>
        ))}</div>
      )}
    </div>
  );
}
