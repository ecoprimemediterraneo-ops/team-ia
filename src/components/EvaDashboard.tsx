"use client";
import { useEffect, useState } from "react";

type Metrics = {
  campaigns_30d: number;
  campaigns_total: number;
  enviados_30d: number;
  open_rate_pct: number;
  click_rate_pct: number;
  ultima_campana: string | null;
};

type Campaign = {
  id: string;
  tipo: string;
  asunto: string;
  enviados_count: number;
  abiertos_count: number;
  clicks_count: number;
  bajas_count: number;
  sent_at: string;
};

type Data = {
  campaigns: Campaign[];
  metrics: Metrics;
};

type Profile = {
  nombre_marca: string;
  sector: string;
  remitente_nombre: string;
  remitente_email: string;
  firma: string;
  tono_marca: string;
  reglas_custom: string;
  audiencia_target: string;
  cta_principal: string;
};

type SbResult = { asunto: string; cuerpo: string } | null;

const TIPOS = [
  { v: "newsletter", l: "📰 Newsletter periódica" },
  { v: "welcome", l: "👋 Bienvenida nuevo suscriptor" },
  { v: "promo", l: "🎯 Promoción / oferta" },
  { v: "reactivacion", l: "💤 Reactivar inactivos" },
  { v: "cumpleanos", l: "🎂 Cumpleaños cliente" },
  { v: "otro", l: "✏️ Otro / genérico" },
];

const TONOS = [
  { v: "cercano y profesional", l: "Cercano y profesional (recomendado)" },
  { v: "muy cálido y emocional", l: "Cálido y emocional" },
  { v: "directo y comercial", l: "Directo y comercial" },
  { v: "educativo y experto", l: "Educativo (estilo newsletter)" },
];

export default function EvaDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [sbOpen, setSbOpen] = useState(false);
  const [sbTipo, setSbTipo] = useState("newsletter");
  const [sbBriefing, setSbBriefing] = useState("");
  const [sbResult, setSbResult] = useState<SbResult>(null);
  const [sbBusy, setSbBusy] = useState(false);

  async function load() {
    try {
      const [c, pr] = await Promise.all([
        fetch("/api/eva/campaigns").then((r) => r.json()),
        fetch("/api/eva/profile").then((r) => r.json()),
      ]);
      if (c.error || pr.error) {
        setAvailable(false);
        return;
      }
      setData(c);
      setProfile(pr.profile);
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const i = setInterval(load, 60_000);
    return () => clearInterval(i);
  }, []);

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      const res = await fetch("/api/eva/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) setSavedAt(new Date().toLocaleTimeString("es-ES"));
    } finally {
      setSaving(false);
    }
  }

  async function sbSend() {
    if (!sbBriefing || sbBusy || !profile) return;
    setSbBusy(true);
    setSbResult(null);
    try {
      const res = await fetch("/api/eva/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: sbTipo,
          briefing: sbBriefing,
          profileOverride: {
            nombre_marca: profile.nombre_marca,
            sector: profile.sector,
            remitente_nombre: profile.remitente_nombre,
            firma: profile.firma,
            tono_marca: profile.tono_marca,
            reglas_custom: profile.reglas_custom,
            audiencia_target: profile.audiencia_target,
            cta_principal: profile.cta_principal,
          },
        }),
      });
      const j = await res.json();
      if (res.ok) setSbResult(j);
      else alert(j.error || "Error");
    } finally {
      setSbBusy(false);
    }
  }

  if (!available) {
    return (
      <div className="mt-8 card-hard p-6 bg-[color:var(--mustard)]/30">
        <h3 className="font-stencil text-xl mb-2">⚙️ Eva pendiente configurar</h3>
        <p className="text-sm text-black/70">
          Falta correr la migración SQL en Supabase. Ver{" "}
          <code className="bg-white px-1">scripts/migrations/009_eva.sql</code>.
        </p>
      </div>
    );
  }

  if (loading || !data || !profile) return <div className="mt-8 text-sm text-black/50">Cargando Eva…</div>;

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h2 className="font-stencil text-3xl">✉️ Email Marketing con Eva</h2>
        <p className="text-xs font-mono text-black/60 mt-1">
          Envíos reales por Resend desde {profile.remitente_email || "tu dominio configurado"}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Stat label="Campañas 30d" value={data.metrics.campaigns_30d} color="#60A5FA" highlight />
          <Stat label="Open rate" value={`${data.metrics.open_rate_pct}%`} color="#14B8A6" />
          <Stat label="Click rate" value={`${data.metrics.click_rate_pct}%`} color="#F5C518" />
          <Stat label="Enviados 30d" value={data.metrics.enviados_30d} color="#3B82F6" />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Editor */}
        <div className="card-hard p-5 bg-white space-y-3">
          <h3 className="font-stencil text-2xl mb-1">⚙️ Personaliza Eva</h3>
          <p className="text-xs text-black/60 mb-2">Eva escribirá los emails con la voz de tu marca.</p>
          <Field label="Nombre de la marca *" value={profile.nombre_marca} onChange={(v) => setProfile({ ...profile, nombre_marca: v })} placeholder="Clínica Sonrisa" />
          <Field label="Sector" value={profile.sector} onChange={(v) => setProfile({ ...profile, sector: v })} placeholder="Clínica dental" />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Remitente nombre" value={profile.remitente_nombre} onChange={(v) => setProfile({ ...profile, remitente_nombre: v })} placeholder="María de Sonrisa" />
            <Field label="Remitente email" value={profile.remitente_email} onChange={(v) => setProfile({ ...profile, remitente_email: v })} placeholder="hola@clinicasonrisa.com" />
          </div>
          <Textarea label="Firma del email" value={profile.firma} onChange={(v) => setProfile({ ...profile, firma: v })} rows={3} placeholder={`Un abrazo,\nMaría y el equipo de Sonrisa\n📞 600 000 000`} />
          <label className="block">
            <span className="block text-xs font-mono uppercase tracking-widest mb-1">Tono</span>
            <select value={profile.tono_marca} onChange={(e) => setProfile({ ...profile, tono_marca: e.target.value })} className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white shadow-[3px_3px_0_#000]">
              {TONOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </label>
          <Textarea label="Audiencia objetivo" value={profile.audiencia_target} onChange={(v) => setProfile({ ...profile, audiencia_target: v })} rows={2} placeholder="Ej: clientes que vienen una vez al año a limpieza" />
          <Field label="CTA principal" value={profile.cta_principal} onChange={(v) => setProfile({ ...profile, cta_principal: v })} placeholder="Reservar cita en 1 click" />
          <Textarea label="Reglas custom" value={profile.reglas_custom} onChange={(v) => setProfile({ ...profile, reglas_custom: v })} rows={3} placeholder="Ej: nunca menciones precios concretos · siempre cierra con consejo dental práctico" />

          <div className="flex items-center gap-3 flex-wrap pt-2">
            <button onClick={save} disabled={saving || !profile.nombre_marca} className="btn-mustard text-sm disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
            <button onClick={() => setSbOpen((o) => !o)} className="border-[3px] border-black px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-black hover:text-white">
              {sbOpen ? "Cerrar prueba" : "🧪 Probar Eva"}
            </button>
            {savedAt && <span className="text-[10px] font-mono text-[#14B8A6]">✓ Guardado {savedAt}</span>}
          </div>
        </div>

        {/* Sandbox */}
        <div className={`card-hard p-5 bg-[color:var(--cream)] ${sbOpen ? "" : "opacity-60"}`}>
          <h3 className="font-stencil text-xl mb-1">🧪 Probar Eva</h3>
          <p className="text-xs text-black/60 mb-3">Pide a Eva una campaña de prueba con tu config (sin enviar a nadie).</p>
          {!sbOpen ? (
            <div className="text-center py-8 text-sm text-black/40">Toca &quot;Probar Eva&quot; para empezar</div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="block text-xs font-mono uppercase tracking-widest mb-1">Tipo de email</span>
                <select value={sbTipo} onChange={(e) => setSbTipo(e.target.value)} className="w-full border-2 border-black px-3 py-2 text-sm bg-white">
                  {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </label>
              <textarea value={sbBriefing} onChange={(e) => setSbBriefing(e.target.value)} placeholder="Brief: qué quieres comunicar. Ej: 'recordar a clientes que no han venido este año que tenemos huecos esta semana'" rows={4} className="w-full border-2 border-black p-2 text-sm font-mono" />
              <button onClick={sbSend} disabled={sbBusy || !sbBriefing} className="btn-mustard text-xs disabled:opacity-50">
                {sbBusy ? "Eva está escribiendo…" : "Generar campaña"}
              </button>

              {sbResult && (
                <div className="card-hard p-3 bg-white mt-3">
                  <div className="text-[10px] font-mono uppercase text-black/40 mb-1">Asunto</div>
                  <div className="font-bold mb-3">{sbResult.asunto}</div>
                  <div className="text-[10px] font-mono uppercase text-black/40 mb-1">Cuerpo</div>
                  <pre className="text-sm whitespace-pre-wrap font-sans">{sbResult.cuerpo}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Histórico campañas */}
      <div className="card-hard p-5 bg-white">
        <h3 className="font-stencil text-2xl mb-3">📊 Histórico de campañas ({data.campaigns.length})</h3>
        {data.campaigns.length === 0 ? (
          <p className="text-sm text-black/50">
            Aún no has enviado campañas. Cuando uses Eva para enviar (desde las herramientas) aparecerán aquí con sus métricas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b-2 border-black">
                <tr>
                  <th className="text-left p-2">Fecha</th>
                  <th className="text-left p-2">Tipo</th>
                  <th className="text-left p-2">Asunto</th>
                  <th className="text-right p-2">Enviados</th>
                  <th className="text-right p-2">Open %</th>
                  <th className="text-right p-2">Click %</th>
                  <th className="text-right p-2">Bajas</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c) => {
                  const openPct = c.enviados_count > 0 ? Math.round((c.abiertos_count / c.enviados_count) * 100) : 0;
                  const clickPct = c.enviados_count > 0 ? Math.round((c.clicks_count / c.enviados_count) * 100) : 0;
                  return (
                    <tr key={c.id} className="border-b border-black/10">
                      <td className="p-2 font-mono">{new Date(c.sent_at).toLocaleDateString("es-ES")}</td>
                      <td className="p-2"><span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-black/40">{c.tipo}</span></td>
                      <td className="p-2 max-w-xs truncate">{c.asunto}</td>
                      <td className="p-2 text-right font-mono">{c.enviados_count}</td>
                      <td className="p-2 text-right font-mono" style={{ color: openPct >= 25 ? "#14B8A6" : openPct >= 15 ? "#F5C518" : "#EF4444" }}>{openPct}%</td>
                      <td className="p-2 text-right font-mono" style={{ color: clickPct >= 5 ? "#14B8A6" : clickPct >= 2 ? "#F5C518" : "#EF4444" }}>{clickPct}%</td>
                      <td className="p-2 text-right font-mono text-black/60">{c.bajas_count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color, highlight }: { label: string; value: number | string; color: string; highlight?: boolean }) {
  return (
    <div className={`card-hard p-4 ${highlight ? "bg-[color:var(--mustard)]/30" : "bg-white"}`} style={{ borderColor: color }}>
      <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">{label}</div>
      <div className="font-stencil text-4xl mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-widest mb-1">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000]" />
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-widest mb-1">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="w-full border-[3px] border-black p-3 font-mono text-sm shadow-[3px_3px_0_#000]" />
    </label>
  );
}
