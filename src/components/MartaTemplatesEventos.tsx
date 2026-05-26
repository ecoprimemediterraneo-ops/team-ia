"use client";
import { useEffect, useState } from "react";

type Evento = { key: string; nombre: string; fecha_aprox: string; emoji: string; descripcion: string };
type Tmpl = { id: string; evento_nombre: string; tipo_pieza: string; caption: string; hashtags: string | null; hook: string | null; cta: string | null; notas_visuales: string | null; status: string; created_at: string };

export default function MartaTemplatesEventos() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [items, setItems] = useState<Tmpl[]>([]);
  const [sel, setSel] = useState({ evento_key: "", tipo_pieza: "post" });
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/marta/templates");
    const j = await r.json();
    setEventos(j.eventos || []);
    setItems(j.items || []);
  }
  useEffect(() => { load(); }, []);

  async function generar(e: React.FormEvent) {
    e.preventDefault();
    if (!sel.evento_key || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/marta/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sel) });
      const j = await r.json();
      if (!r.ok) alert(j.error || "Error");
      else load();
    } finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!confirm("¿Borrar template?")) return;
    await fetch("/api/marta/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    load();
  }

  async function copy(t: Tmpl) {
    const text = `${t.hook ? `HOOK: ${t.hook}\n\n` : ""}${t.caption}\n\n${t.hashtags || ""}\n\nCTA: ${t.cta || ""}\n\nVISUAL: ${t.notas_visuales || ""}`;
    await navigator.clipboard.writeText(text).catch(() => {});
    alert("✓ Copiado");
  }

  return (
    <div className="card-hard p-5 bg-white border-[#FF7A59]">
      <h3 className="font-stencil text-2xl mb-2">📅 Templates por eventos</h3>
      <p className="text-xs text-black/60 mb-3">Marta te genera la pieza adaptada a tu negocio para cada fecha señalada del calendario.</p>

      <form onSubmit={generar} className="card-hard p-3 bg-[color:var(--cream)] mb-4 space-y-2">
        <div className="grid sm:grid-cols-2 gap-2">
          <select value={sel.evento_key} onChange={(e) => setSel({ ...sel, evento_key: e.target.value })} required className="border-2 border-black px-2 py-1 text-sm bg-white">
            <option value="">— Elige evento —</option>
            {eventos.map((e) => (<option key={e.key} value={e.key}>{e.emoji} {e.nombre} ({e.fecha_aprox})</option>))}
          </select>
          <select value={sel.tipo_pieza} onChange={(e) => setSel({ ...sel, tipo_pieza: e.target.value })} className="border-2 border-black px-2 py-1 text-sm bg-white">
            <option value="post">Post</option>
            <option value="reel">Reel</option>
            <option value="carrusel">Carrusel</option>
            <option value="story">Story</option>
          </select>
        </div>
        <button type="submit" disabled={busy || !sel.evento_key} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Generando…" : "🎁 Generar template"}</button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-black/50 text-center py-4">Sin templates aún. Genera el primero ☝️</p>
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <div key={t.id} className="border-2 border-black bg-white p-3">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{t.evento_nombre}</span>
                  <span className="text-[10px] font-mono uppercase border border-black/40 px-2 py-0.5">{t.tipo_pieza}</span>
                </div>
                <span className="text-[10px] text-black/40">{new Date(t.created_at).toLocaleDateString("es-ES")}</span>
              </div>
              {t.hook && <p className="text-sm font-bold mb-2">🎣 {t.hook}</p>}
              <p className="text-sm whitespace-pre-wrap mb-2">{t.caption}</p>
              {t.hashtags && <p className="text-xs text-[#FF7A59] mb-2">{t.hashtags}</p>}
              {t.cta && <p className="text-xs"><b>CTA:</b> {t.cta}</p>}
              {t.notas_visuales && <p className="text-xs text-black/60 italic mt-1">🎨 {t.notas_visuales}</p>}
              <div className="flex gap-2 mt-2">
                <button onClick={() => copy(t)} className="text-[10px] font-bold uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-[color:var(--mustard)]">📋 Copiar</button>
                <button onClick={() => del(t.id)} className="text-[10px] font-bold uppercase border-2 border-black/30 text-black/60 px-2 py-1 hover:bg-black/10">Borrar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
