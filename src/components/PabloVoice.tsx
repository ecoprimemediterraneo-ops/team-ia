"use client";
import { useEffect, useState } from "react";

type Voz = { id: string; nombre: string };

export default function PabloVoice() {
  const [voces, setVoces] = useState<Voz[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [audio, setAudio] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch("/api/pablo/voice").then((r) => r.json()).then((j) => { setVoces(j.voces || []); setEnabled(j.enabled !== false); if (j.voces?.[0]?.id) setVoiceId(j.voces[0].id); }); }, []);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!script.trim() || busy) return;
    setBusy(true); setAudio(null);
    try {
      const r = await fetch("/api/pablo/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script, voice_id: voiceId }) });
      const j = await r.json();
      if (!r.ok) alert(j.error);
      else setAudio(`data:audio/mpeg;base64,${j.audioBase64}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="card-hard p-5 bg-white border-[#25D366]">
      <h3 className="font-stencil text-2xl mb-2">🎙️ Audios WhatsApp</h3>
      <p className="text-xs text-black/60 mb-3">Genera mensajes de audio con voz natural para enviar por WhatsApp.</p>
      {!enabled && <div className="card-hard p-2 bg-[color:var(--red)]/10 text-xs mb-3">⚠️ ElevenLabs no configurado.</div>}
      <form onSubmit={go} className="space-y-2">
        <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={3} maxLength={1000} placeholder="Texto a convertir en audio…" className="w-full border-2 border-black p-2 text-sm" />
        <div className="flex items-end gap-2 flex-wrap">
          <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="border-2 border-black px-2 py-1 text-sm bg-white">{voces.map((v) => (<option key={v.id} value={v.id}>{v.nombre}</option>))}</select>
          <button type="submit" disabled={busy || !script.trim() || !enabled} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Generando…" : "🎤 Generar"}</button>
        </div>
      </form>
      {audio && (
        <div className="mt-3 card-hard p-3 bg-[color:var(--cream)]">
          <audio controls src={audio} className="w-full" />
          <a href={audio} download="pablo-audio.mp3" className="text-[10px] font-bold uppercase border-2 border-black px-2 py-1 inline-block mt-2">⬇️ Descargar MP3</a>
        </div>
      )}
    </div>
  );
}
