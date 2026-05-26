"use client";
import { useEffect, useState } from "react";

type Slide = { numero: number; titulo: string; contenido: string; descripcion_visual: string };
type Portada = { titulo: string; subtitulo: string; descripcion_visual: string };

type Carrusel = {
  id: string;
  tema: string;
  num_slides: number;
  portada: Portada;
  slides: Slide[];
  caption: string;
  cta_final: string | null;
  hashtags: string | null;
  status: string;
  created_at: string;
};

export default function MartaCarruselesStudio() {
  const [carruseles, setCarruseles] = useState<Carrusel[]>([]);
  const [tema, setTema] = useState("");
  const [numSlides, setNumSlides] = useState(7);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/marta/carruseles");
      const j = await r.json();
      setCarruseles(j.carruseles || []);
    } catch { /* */ }
  }

  useEffect(() => { load(); }, []);

  async function generate() {
    if (!tema.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/marta/carruseles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tema: tema.trim(), num_slides: numSlides }),
      });
      const j = await r.json();
      if (!r.ok) alert(j.error || "Error");
      else {
        setTema("");
        setExpanded(j.carrusel.id);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Borrar este carrusel?")) return;
    await fetch("/api/marta/carruseles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    load();
  }

  async function copyAll(c: Carrusel) {
    const text = `🎠 CARRUSEL: ${c.tema}

═══ SLIDE 1 (PORTADA) ═══
TÍTULO: ${c.portada.titulo}
SUBTÍTULO: ${c.portada.subtitulo}
VISUAL: ${c.portada.descripcion_visual}

${c.slides.map((s) => `═══ SLIDE ${s.numero} ═══
TÍTULO: ${s.titulo}
${s.contenido}
VISUAL: ${s.descripcion_visual}`).join("\n\n")}

═══ CAPTION ═══
${c.caption}

${c.cta_final ? `═══ CTA ═══\n${c.cta_final}\n\n` : ""}${c.hashtags ? `═══ HASHTAGS ═══\n${c.hashtags}` : ""}`;
    await navigator.clipboard.writeText(text).catch(() => {});
    alert("✓ Carrusel copiado al portapapeles");
  }

  return (
    <div className="card-hard p-5 bg-white border-[#A88BE8]">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-stencil text-2xl">🎠 Estudio de Carruseles</h3>
        <span className="text-xs font-mono text-black/50">{carruseles.length} carruseles generados</span>
      </div>
      <p className="text-xs text-black/60 mb-4">
        Marta te genera carruseles 5-10 slides con portada que engancha + descripción visual de cada slide. Llévalo a Canva o tu diseñador.
      </p>

      <div className="card-hard p-4 bg-[color:var(--cream)] mb-4 space-y-3">
        <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="¿Sobre qué tema? Ej: 7 mitos sobre el implante dental" className="w-full border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000]" />
        <div className="flex gap-3 flex-wrap items-center">
          <label className="flex items-center gap-2 text-xs font-mono">
            Slides:
            <select value={numSlides} onChange={(e) => setNumSlides(parseInt(e.target.value))} className="border-2 border-black px-2 py-1 text-sm bg-white">
              {[5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button onClick={generate} disabled={busy || !tema.trim()} className="btn-mustard text-xs disabled:opacity-50">
            {busy ? "Generando carrusel…" : "Generar Carrusel con IA"}
          </button>
        </div>
      </div>

      {carruseles.length === 0 ? (
        <p className="text-sm text-black/50">Aún no hay carruseles. Prueba con un tema arriba.</p>
      ) : (
        <div className="space-y-3">
          {carruseles.map((c) => {
            const isOpen = expanded === c.id;
            return (
              <div key={c.id} className="border-2 border-black bg-white">
                <button onClick={() => setExpanded(isOpen ? null : c.id)} className="w-full text-left p-3 flex items-center justify-between gap-2 flex-wrap hover:bg-[color:var(--cream)]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl">🎠</span>
                    <span className="font-bold text-sm">{c.tema}</span>
                    <span className="text-[10px] font-mono text-black/40">{c.num_slides} slides</span>
                  </div>
                  <span className="text-[10px] font-mono text-black/40">{new Date(c.created_at).toLocaleDateString("es-ES")} {isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="border-t-2 border-black p-4 space-y-3">
                    {/* Portada destacada */}
                    <div className="border-2 border-[color:var(--mustard)] bg-[color:var(--mustard)]/10 p-3">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[color:var(--red)] mb-1">SLIDE 1 · PORTADA (la más importante)</div>
                      <div className="font-stencil text-xl mb-1">{c.portada.titulo}</div>
                      <div className="text-sm text-black/80 mb-2">{c.portada.subtitulo}</div>
                      <div className="text-[11px] italic text-black/60 border-t border-black/10 pt-2">🎨 Visual: {c.portada.descripcion_visual}</div>
                    </div>

                    {/* Slides */}
                    {c.slides.map((s) => (
                      <div key={s.numero} className="border-2 border-black/30 p-3">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-black/50 mb-1">SLIDE {s.numero}</div>
                        <div className="font-bold text-sm mb-1">{s.titulo}</div>
                        <div className="text-sm mb-2">{s.contenido}</div>
                        <div className="text-[11px] italic text-black/50 border-t border-black/10 pt-1">🎨 Visual: {s.descripcion_visual}</div>
                      </div>
                    ))}

                    {/* Caption */}
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-black/50 mb-1">📝 CAPTION DEL POST</div>
                      <pre className="text-sm whitespace-pre-wrap font-sans bg-[color:var(--cream)] p-2">{c.caption}</pre>
                    </div>

                    {c.hashtags && (
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-black/50 mb-1">#️⃣ HASHTAGS</div>
                        <p className="text-xs font-mono text-[#A88BE8]">{c.hashtags}</p>
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap pt-3 border-t border-black/10">
                      <button onClick={() => copyAll(c)} className="btn-mustard text-xs">📋 Copiar todo</button>
                      <button onClick={() => remove(c.id)} className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-3 py-2 text-xs font-bold uppercase hover:bg-[color:var(--red)] hover:text-white">Borrar</button>
                    </div>
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
