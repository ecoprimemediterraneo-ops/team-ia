"use client";
import { useEffect, useState } from "react";

type Voz = { id: string; nombre: string };
type Item = { id: string; script: string; voice_name: string; caracteres_usados: number; created_at: string };

export default function MartaVoice() {
  const [voces, setVoces] = useState<Voz[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [audio, setAudio] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/marta/voice");
    const j = await r.json();
    setVoces(j.voces || []);
    setItems(j.items || []);
    setEnabled(j.enabled !== false);
    if (j.voces?.[0]?.id && !voiceId) setVoiceId(j.voces[0].id);
  }
  useEffect(() => { load(); }, []);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!script.trim() || busy) return;
    setBusy(true); setAudio(null);
    try {
      const r = await fetch("/api/marta/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script, voice_id: voiceId }) });
      const j = await r.json();
      if (!r.ok) alert(j.error || "Error");
      else { setAudio(`data:audio/mpeg;base64,${j.audioBase64}`); load(); }
    } finally { setBusy(false); }
  }

  return (
    <div className="card-hard p-5 bg-white border-[#FF7A59]">
      <h3 className="font-stencil text-2xl mb-2">🎙️ Voz para stories</h3>
      <p className="text-xs text-black/60 mb-3">Marta narra tu guion con voz humana (ElevenLabs). Descárgalo y úsalo en tu story/reel.</p>
      {!enabled && <div className="card-hard p-2 bg-[color:var(--red)]/10 text-xs mb-3">⚠️ ElevenLabs no configurado en servidor. Avisa al equipo.</div>}

      <form onSubmit={go} className="space-y-2">
        <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={4} maxLength={1500} placeholder="Pega aquí el guion (máx 1500 caracteres)…" className="w-full border-2 border-black p-2 text-sm" />
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="text-[10px] font-mono uppercase block mb-1">Voz</label>
            <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="border-2 border-black px-2 py-1 text-sm bg-white">
              {voces.map((v) => (<option key={v.id} value={v.id}>{v.nombre}</option>))}
            </select>
          </div>
          <div className="text-[10px] text-black/50">{script.length} / 1500 chars</div>
          <button type="submit" disabled={busy || !script.trim() || !enabled} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Generando…" : "🎤 Generar audio"}</button>
        </div>
      </form>

      {audio && (
        <div className="mt-3 card-hard p-3 bg-[color:var(--cream)]">
          <audio controls src={audio} className="w-full" />
          <a href={audio} download="marta-voz.mp3" className="text-[10px] font-bold uppercase border-2 border-black px-2 py-1 inline-block mt-2 hover:bg-black hover:text-[color:var(--mustard)]">⬇️ Descargar MP3</a>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-mono uppercase text-black/60 mb-2">Históricos (últimos {items.length})</div>
          <div className="space-y-1">
            {items.slice(0, 5).map((i) => (
              <div key={i.id} className="text-xs border border-black/20 p-2 flex justify-between gap-2">
                <span className="truncate">{i.script.slice(0, 80)}…</span>
                <span className="font-mono text-black/40 whitespace-nowrap">{i.voice_name} · {i.caracteres_usados}c</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
