"use client";
import { useEffect, useState } from "react";

type Piezas = {
  tiktok: { hook: string; script: string; hashtags: string };
  shorts: { titulo_seo: string; descripcion: string };
  post_ig: { caption: string; hashtags: string };
  carrusel: { titulo: string; slides: Array<{ numero: number; texto: string }> };
  blog: { titulo: string; meta_descripcion: string; cuerpo: string };
};

type Item = {
  id: string;
  source_tipo: string;
  source_descripcion: string;
  piezas: Piezas;
  created_at: string;
};

export default function MartaRepurposeStudio() {
  const [items, setItems] = useState<Item[]>([]);
  const [tipo, setTipo] = useState<"reel" | "post" | "carrusel" | "video_largo">("reel");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/marta/repurpose");
      const j = await r.json();
      setItems(j.items || []);
    } catch { /* */ }
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    if (!desc.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/marta/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_tipo: tipo, source_descripcion: desc.trim() }),
      });
      const j = await r.json();
      if (!r.ok) alert(j.error || "Error");
      else { setDesc(""); setExpanded(j.repurpose.id); load(); }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Borrar este repurpose?")) return;
    await fetch("/api/marta/repurpose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    load();
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text).catch(() => {});
    alert("✓ Copiado");
  }

  return (
    <div className="card-hard p-5 bg-white border-[#3B82F6]">
      <h3 className="font-stencil text-2xl mb-2">♻️ Repurposing</h3>
      <p className="text-xs text-black/60 mb-4">
        1 contenido → 5 piezas adaptadas: TikTok, YouTube Shorts, Post IG, Carrusel y Blog post.
      </p>

      <div className="card-hard p-4 bg-[color:var(--cream)] mb-4 space-y-3">
        <div className="flex gap-3 flex-wrap items-center">
          <label className="flex items-center gap-2 text-xs font-mono">
            Tipo fuente:
            <select value={tipo} onChange={(e) => setTipo(e.target.value as "reel" | "post" | "carrusel" | "video_largo")} className="border-2 border-black px-2 py-1 text-sm bg-white">
              <option value="reel">🎬 Reel original</option>
              <option value="post">📝 Post original</option>
              <option value="carrusel">🎠 Carrusel original</option>
              <option value="video_largo">📹 Video largo (YouTube/podcast)</option>
            </select>
          </label>
        </div>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe el contenido fuente con detalle. Ej: 'Reel de 60s donde Diana explica 3 mitos sobre el implante dental: 1) duele mucho, 2) es para mayores, 3) cuesta 5000€'" rows={4} className="w-full border-[3px] border-black p-2 text-sm shadow-[3px_3px_0_#000]" />
        <button onClick={generate} disabled={busy || !desc.trim()} className="btn-mustard text-xs disabled:opacity-50">
          {busy ? "Generando 5 piezas…" : "♻️ Generar 5 piezas adaptadas"}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-black/50">Sin repurposes todavía. Describe un contenido fuente arriba.</p>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const isOpen = expanded === it.id;
            const p = it.piezas;
            return (
              <div key={it.id} className="border-2 border-black bg-white">
                <button onClick={() => setExpanded(isOpen ? null : it.id)} className="w-full text-left p-3 flex items-center justify-between gap-2 flex-wrap hover:bg-[color:var(--cream)]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl">♻️</span>
                    <span className="text-[10px] font-mono uppercase border border-black/40 px-2 py-0.5">{it.source_tipo}</span>
                    <span className="font-bold text-sm truncate max-w-[400px]">{it.source_descripcion.slice(0, 80)}{it.source_descripcion.length > 80 && "…"}</span>
                  </div>
                  <span className="text-[10px] font-mono text-black/40">{new Date(it.created_at).toLocaleDateString("es-ES")} {isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="border-t-2 border-black p-4 space-y-4">
                    {/* TikTok */}
                    <Pieza title="🎵 TIKTOK" onCopy={() => copyText(`HOOK: ${p.tiktok.hook}\n\nSCRIPT:\n${p.tiktok.script}\n\n${p.tiktok.hashtags}`)}>
                      <p className="text-sm font-bold mb-1">Hook: {p.tiktok.hook}</p>
                      <pre className="whitespace-pre-wrap text-xs bg-black text-[color:var(--mustard)] p-2 font-mono">{p.tiktok.script}</pre>
                      <p className="text-[11px] font-mono text-[#FF7A59] mt-1">{p.tiktok.hashtags}</p>
                    </Pieza>

                    {/* Shorts */}
                    <Pieza title="📺 YOUTUBE SHORTS" onCopy={() => copyText(`${p.shorts.titulo_seo}\n\n${p.shorts.descripcion}`)}>
                      <p className="text-sm font-bold mb-1">{p.shorts.titulo_seo}</p>
                      <p className="text-xs">{p.shorts.descripcion}</p>
                    </Pieza>

                    {/* Post IG */}
                    <Pieza title="📷 POST INSTAGRAM" onCopy={() => copyText(`${p.post_ig.caption}\n\n${p.post_ig.hashtags}`)}>
                      <pre className="whitespace-pre-wrap text-sm font-sans">{p.post_ig.caption}</pre>
                      <p className="text-[11px] font-mono text-[#FF7A59] mt-1">{p.post_ig.hashtags}</p>
                    </Pieza>

                    {/* Carrusel */}
                    <Pieza title="🎠 CARRUSEL" onCopy={() => copyText(`PORTADA: ${p.carrusel.titulo}\n\n${p.carrusel.slides.map((s) => `Slide ${s.numero}: ${s.texto}`).join("\n")}`)}>
                      <p className="text-sm font-bold mb-1">Portada: {p.carrusel.titulo}</p>
                      <ul className="text-xs space-y-1 list-disc pl-5">
                        {p.carrusel.slides.map((s) => <li key={s.numero}><b>Slide {s.numero}:</b> {s.texto}</li>)}
                      </ul>
                    </Pieza>

                    {/* Blog */}
                    <Pieza title="📝 BLOG POST" onCopy={() => copyText(`${p.blog.titulo}\n\n${p.blog.meta_descripcion}\n\n${p.blog.cuerpo}`)}>
                      <p className="text-sm font-bold mb-1">{p.blog.titulo}</p>
                      <p className="text-[11px] italic text-black/60 mb-2">Meta: {p.blog.meta_descripcion}</p>
                      <pre className="whitespace-pre-wrap text-xs font-sans bg-[color:var(--cream)] p-2">{p.blog.cuerpo}</pre>
                    </Pieza>

                    <button onClick={() => remove(it.id)} className="text-[10px] font-bold uppercase tracking-widest border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 hover:bg-[color:var(--red)] hover:text-white">Borrar repurpose</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Pieza({ title, onCopy, children }: { title: string; onCopy: () => void; children: React.ReactNode }) {
  return (
    <div className="border-2 border-black/30 p-3 bg-white">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[10px] font-mono uppercase tracking-widest text-black/60 font-bold">{title}</div>
        <button onClick={onCopy} className="text-[10px] font-bold uppercase tracking-widest border-2 border-black px-2 py-1 hover:bg-black hover:text-[color:var(--mustard)]">📋 Copiar</button>
      </div>
      {children}
    </div>
  );
}
