"use client";
import { useEffect, useState } from "react";

type Voz = { id: string; nombre: string };
type Profile = {
  nombre_negocio: string; sector: string; saludo: string; voz_id: string;
  whatsapp_dueno: string | null; email_dueno: string | null;
  horario_negocio: string; max_recording_sec: number; twilio_phone_number: string | null;
  greeting_audio_base64?: boolean;
};

export default function CarmenEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [voces, setVoces] = useState<Voz[]>([]);
  const [audio, setAudio] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/carmen/profile"); const j = await r.json();
    setProfile(j.profile); setVoces(j.voces || []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!profile || busy) return; setBusy(true);
    try {
      const r = await fetch("/api/carmen/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        nombre_negocio: profile.nombre_negocio, sector: profile.sector, saludo: profile.saludo, voz_id: profile.voz_id,
        whatsapp_dueno: profile.whatsapp_dueno || undefined, email_dueno: profile.email_dueno || undefined,
        horario_negocio: profile.horario_negocio, max_recording_sec: profile.max_recording_sec,
      }) });
      const j = await r.json();
      if (!r.ok) alert(j.error || "Error");
      else alert(`✓ Guardado${j.regenerated ? " · saludo regenerado" : ""}`);
    } finally { setBusy(false); }
  }

  async function preview() {
    setAudio(null);
    const r = await fetch("/api/carmen/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview_greeting" }) });
    const j = await r.json();
    if (!r.ok) { alert(j.error); return; }
    setAudio(`data:audio/mpeg;base64,${j.audioBase64}`);
  }

  if (!profile) return <div className="text-sm text-black/50 mt-4">Cargando…</div>;

  return (
    <div className="card-hard p-5 bg-white border-[#A88BE8]">
      <h3 className="font-stencil text-2xl mb-2">🎙️ Editor Carmen</h3>
      <p className="text-xs text-black/60 mb-3">Personaliza el saludo, voz, horario y a quién avisar tras cada llamada perdida.</p>

      <div className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-2">
          <input value={profile.nombre_negocio} onChange={(e) => setProfile({ ...profile, nombre_negocio: e.target.value })} placeholder="Nombre negocio*" className="border-2 border-black px-2 py-1 text-sm" />
          <input value={profile.sector} onChange={(e) => setProfile({ ...profile, sector: e.target.value })} placeholder="Sector (clínica, peluquería…)" className="border-2 border-black px-2 py-1 text-sm" />
        </div>

        <div>
          <label className="text-[10px] font-mono uppercase block mb-1">Saludo que oirá el cliente</label>
          <textarea value={profile.saludo} onChange={(e) => setProfile({ ...profile, saludo: e.target.value })} rows={3} className="w-full border-2 border-black p-2 text-sm" />
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-mono uppercase block mb-1">Voz</label>
            <select value={profile.voz_id} onChange={(e) => setProfile({ ...profile, voz_id: e.target.value })} className="w-full border-2 border-black px-2 py-1 text-sm bg-white">
              {voces.map((v) => (<option key={v.id} value={v.id}>{v.nombre}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase block mb-1">Max grabación cliente (seg)</label>
            <input type="number" min={10} max={120} value={profile.max_recording_sec} onChange={(e) => setProfile({ ...profile, max_recording_sec: Number(e.target.value) })} className="w-full border-2 border-black px-2 py-1 text-sm" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <input value={profile.whatsapp_dueno || ""} onChange={(e) => setProfile({ ...profile, whatsapp_dueno: e.target.value })} placeholder="WhatsApp dueño (+34...)" className="border-2 border-black px-2 py-1 text-sm" />
          <input value={profile.email_dueno || ""} onChange={(e) => setProfile({ ...profile, email_dueno: e.target.value })} placeholder="Email dueño (fallback)" className="border-2 border-black px-2 py-1 text-sm" />
        </div>

        <input value={profile.horario_negocio} onChange={(e) => setProfile({ ...profile, horario_negocio: e.target.value })} placeholder="Horario negocio" className="w-full border-2 border-black px-2 py-1 text-sm" />

        {profile.twilio_phone_number && (
          <div className="card-hard p-2 bg-[color:var(--mustard)]/30 text-xs">
            📞 Número Twilio asignado: <b>{profile.twilio_phone_number}</b>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <button onClick={save} disabled={busy} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Guardando…" : "💾 Guardar"}</button>
          <button onClick={preview} className="text-xs font-bold uppercase border-2 border-black px-3 py-2 hover:bg-black hover:text-[color:var(--mustard)]">🔊 Escuchar saludo</button>
        </div>

        {audio && (
          <div className="card-hard p-3 bg-[color:var(--cream)]">
            <audio controls src={audio} className="w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
