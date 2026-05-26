"use client";
import { useEffect, useState } from "react";

type Reel = {
  id: string;
  tema: string;
  duracion_seg: number;
  hook: string;
  script: string;
  planos_broll: string[];
  texto_overlay: Array<{ tiempo: string; texto: string }>;
  musica_sugerida: string | null;
  cta_final: string | null;
  hashtags: string | null;
  status: string;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  borrador: "#6B7280",
  aprobado: "#F5C518",
  grabado: "#A88BE8",
  publicado: "#14B8A6",
};

export default function MartaReelsStudio() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [tema, setTema] = useState("");
  const [duracion, setDuracion] = useState(30);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/marta/reels");
      const j = await r.json();
      setReels(j.reels || []);
    } catch { /* */ }
  }

  useEffect(() => {
    load();
  }, []);

  async function generate() {
    if (!tema.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/marta/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tema: tema.trim(), duracion_seg: duracion }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j.error || "Error");
      } else {
        setTema("");
        setExpanded(j.reel.id);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch("/api/marta/reels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", id, status }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("¿Borrar este reel?")) return;
    await fetch("/api/marta/reels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    load();
  }

  async function copyAll(r: Reel) {
    const text = `🎬 REEL: ${r.tema}
Duración: ${r.duracion_seg}s

═══ HOOK (0-3s) ═══
${r.hook}

═══ SCRIPT ═══
${r.script}

═══ PLANOS B-ROLL ═══
${r.planos_broll.map((p, i) => `${i + 1}. ${p}`).join("\n")}

═══ TEXTO EN PANTALLA ═══
${r.texto_overlay.map((t) => `[${t.tiempo}] ${t.texto}`).join("\n")}

═══ MÚSICA ═══
${r.musica_sugerida || "—"}

═══ CTA FINAL ═══
${r.cta_final || "—"}

═══ HASHTAGS ═══
${r.hashtags || "—"}`;
    await navigator.clipboard.writeText(text).catch(() => {});
    alert("✓ Reel copiado al portapapeles");
  }

  return (
    <div className="card-hard p-5 bg-white border-[#FF7A59]">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-stencil text-2xl">🎬 Estudio de Reels</h3>
        <span className="text-xs font-mono text-black/50">{reels.length} reels generados</span>
      </div>
      <p className="text-xs text-black/60 mb-4">
        Marta te genera el script completo + hook + planos B-roll + texto on-screen + música. Listo para grabar.
      </p>

      {/* Generador */}
      <div className="card-hard p-4 bg-[color:var(--cream)] mb-4 space-y-3">
        <input
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          placeholder="¿Sobre qué tema? Ej: 3 errores que cometes al cepillarte"
          className="w-full border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000]"
        />
        <div className="flex gap-3 flex-wrap items-center">
          <label className="flex items-center gap-2 text-xs font-mono">
            Duración:
            <select value={duracion} onChange={(e) => setDuracion(parseInt(e.target.value))} className="border-2 border-black px-2 py-1 text-sm bg-white">
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={45}>45s</option>
              <option value={60}>60s</option>
              <option value={90}>90s</option>
            </select>
          </label>
          <button onClick={generate} disabled={busy || !tema.trim()} className="btn-mustard text-xs disabled:opacity-50">
            {busy ? "Generando reel…" : "Generar Reel con IA"}
          </button>
        </div>
      </div>

      {/* Lista */}
      {reels.length === 0 ? (
        <p className="text-sm text-black/50">Aún no has generado reels. Prueba con un tema arriba.</p>
      ) : (
        <div className="space-y-3">
          {reels.map((r) => {
            const isOpen = expanded === r.id;
            return (
              <div key={r.id} className="border-2 border-black bg-white">
                <button onClick={() => setExpanded(isOpen ? null : r.id)} className="w-full text-left p-3 flex items-center justify-between gap-2 flex-wrap hover:bg-[color:var(--cream)]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl">🎬</span>
                    <span className="font-bold text-sm">{r.tema}</span>
                    <span className="text-[10px] font-mono text-black/40">{r.duracion_seg}s</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border-2 border-black text-white" style={{ backgroundColor: STATUS_COLORS[r.status] || "#000" }}>{r.status}</span>
                  </div>
                  <span className="text-[10px] font-mono text-black/40">{new Date(r.created_at).toLocaleDateString("es-ES")} {isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="border-t-2 border-black p-4 space-y-3 text-sm">
                    <Section title="🪝 HOOK (0-3s) — lo que decide si miran o pasan">
                      <p className="font-bold italic">{r.hook}</p>
                    </Section>

                    <Section title="📜 SCRIPT con timing">
                      <pre className="whitespace-pre-wrap font-mono text-xs bg-black text-[color:var(--mustard)] p-3">{r.script}</pre>
                    </Section>

                    {r.planos_broll.length > 0 && (
                      <Section title="🎥 PLANOS B-ROLL — qué grabar">
                        <ol className="list-decimal pl-5 space-y-1">
                          {r.planos_broll.map((p, i) => <li key={i}>{p}</li>)}
                        </ol>
                      </Section>
                    )}

                    {r.texto_overlay.length > 0 && (
                      <Section title="✏️ TEXTO EN PANTALLA">
                        <ul className="space-y-1">
                          {r.texto_overlay.map((t, i) => (
                            <li key={i} className="font-mono text-xs"><b>[{t.tiempo}]</b> {t.texto}</li>
                          ))}
                        </ul>
                      </Section>
                    )}

                    {r.musica_sugerida && (
                      <Section title="🎵 MÚSICA">
                        <p className="text-xs italic">{r.musica_sugerida}</p>
                      </Section>
                    )}

                    {r.cta_final && (
                      <Section title="📣 CTA FINAL">
                        <p className="font-bold">{r.cta_final}</p>
                      </Section>
                    )}

                    {r.hashtags && (
                      <Section title="#️⃣ HASHTAGS">
                        <p className="text-xs font-mono text-[#FF7A59]">{r.hashtags}</p>
                      </Section>
                    )}

                    <div className="flex gap-2 flex-wrap pt-3 border-t border-black/10">
                      <button onClick={() => copyAll(r)} className="btn-mustard text-xs">📋 Copiar todo</button>
                      <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} className="border-2 border-black px-3 py-2 text-xs bg-white">
                        <option value="borrador">📝 Borrador</option>
                        <option value="aprobado">✓ Aprobado</option>
                        <option value="grabado">🎥 Grabado</option>
                        <option value="publicado">🚀 Publicado</option>
                      </select>
                      <button onClick={() => remove(r.id)} className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-3 py-2 text-xs font-bold uppercase hover:bg-[color:var(--red)] hover:text-white">Borrar</button>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-black/50 mb-1">{title}</div>
      {children}
    </div>
  );
}
