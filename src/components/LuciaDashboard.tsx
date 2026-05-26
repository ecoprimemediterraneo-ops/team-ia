"use client";
import { useEffect, useState } from "react";

type Metrics = {
  drafts_7d: number;
  drafts_total: number;
  promos_7d: number;
  emails_7d: number;
  minutes_saved_7d: number;
  ultima_actividad: string | null;
};

type Draft = {
  id: string;
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  incoming_snippet: string | null;
  proposed_response: string;
  intent: string | null;
  confidence: number | null;
  status: "draft_created" | "sent" | "edited" | "rejected";
  created_at: string;
};

type Data = {
  drafts: Draft[];
  metrics: Metrics;
  modo: "drafts" | "auto";
  aprobaciones: number;
  rechazos: number;
  porcentaje_aprobacion: number;
};

type Profile = {
  nombre_persona: string;
  cargo: string;
  empresa: string;
  firma: string;
  tono_marca: string;
  reglas_custom: string;
  idiomas: string;
  modo_activacion: "drafts" | "auto";
};

type SbResult = { intent: string; confidence: number; reasoning: string; respuesta: string } | null;

const TONOS = [
  { v: "cercano y profesional", l: "Cercano y profesional (recomendado)" },
  { v: "muy formal y corporativo", l: "Muy formal y corporativo" },
  { v: "directo y conciso", l: "Directo y conciso (estilo tech)" },
  { v: "cálido y empático", l: "Cálido y empático" },
];

const INTENT_LABELS: Record<string, string> = {
  pregunta: "Pregunta",
  reunion: "Reunión",
  queja: "Queja",
  spam: "Spam",
  info: "Info",
  propuesta: "Propuesta",
  factura: "Factura",
  otro: "Otro",
};

const INTENT_COLORS: Record<string, string> = {
  pregunta: "#60A5FA",
  reunion: "#14B8A6",
  queja: "#EF4444",
  spam: "#9CA3AF",
  info: "#A88BE8",
  propuesta: "#F5C518",
  factura: "#FF7A59",
  otro: "#6B7280",
};

export default function LuciaDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Sandbox
  const [sbOpen, setSbOpen] = useState(false);
  const [sbInput, setSbInput] = useState({ from_name: "", from_email: "", subject: "", body: "" });
  const [sbResult, setSbResult] = useState<SbResult>(null);
  const [sbBusy, setSbBusy] = useState(false);

  // Drafts actions
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});

  async function load() {
    try {
      const [d, pr] = await Promise.all([
        fetch("/api/lucia/drafts").then((r) => r.json()),
        fetch("/api/lucia/profile").then((r) => r.json()),
      ]);
      if (d.error || pr.error) {
        setAvailable(false);
        return;
      }
      setData(d);
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
      const res = await fetch("/api/lucia/profile", {
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
    if (!sbInput.subject || !sbInput.body || sbBusy || !profile) return;
    setSbBusy(true);
    setSbResult(null);
    try {
      const res = await fetch("/api/lucia/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sbInput,
          from_email: sbInput.from_email || undefined,
          profileOverride: {
            nombre_persona: profile.nombre_persona,
            cargo: profile.cargo,
            empresa: profile.empresa,
            firma: profile.firma,
            tono_marca: profile.tono_marca,
            reglas_custom: profile.reglas_custom,
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

  async function actDraft(id: string, action: "sent" | "edited" | "rejected") {
    setBusyId(id);
    try {
      const editedText = action === "edited" ? editing[id]?.trim() : undefined;
      await fetch("/api/lucia/draft-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, editedText }),
      });
    } finally {
      setBusyId(null);
      setEditing((e) => { const c = { ...e }; delete c[id]; return c; });
      load();
    }
  }

  if (!available) {
    return (
      <div className="mt-8 card-hard p-6 bg-[color:var(--mustard)]/30">
        <h3 className="font-stencil text-xl mb-2">⚙️ Lucía pendiente configurar</h3>
        <p className="text-sm text-black/70">
          Falta correr la migración SQL en Supabase. Ver{" "}
          <code className="bg-white px-1">scripts/migrations/008_lucia.sql</code>.
        </p>
      </div>
    );
  }

  if (loading || !data || !profile) {
    return <div className="mt-8 text-sm text-black/50">Cargando Lucía…</div>;
  }

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h2 className="font-stencil text-3xl">📬 Tu bandeja Gmail con Lucía</h2>
        <p className="text-xs font-mono text-black/60 mt-1">
          Modo: <span className="px-2 py-0.5 ml-1 font-bold uppercase tracking-widest border-2 border-black" style={{ background: data.modo === "drafts" ? "var(--mustard)" : "#14B8A6", color: data.modo === "drafts" ? "#000" : "#fff" }}>{data.modo === "drafts" ? "📝 Borradores" : "⚡ Auto"}</span>
          {data.aprobaciones + data.rechazos > 0 && (
            <span className="ml-3">{data.aprobaciones}/{data.aprobaciones + data.rechazos} aprobados ({data.porcentaje_aprobacion}%)</span>
          )}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Stat label="Borradores 7d" value={data.metrics.drafts_7d} color="#F5C518" highlight />
          <Stat label="Borradores total" value={data.metrics.drafts_total} color="#3B82F6" />
          <Stat label="Promos archivadas 7d" value={data.metrics.promos_7d} color="#A88BE8" />
          <Stat label="Minutos ahorrados 7d" value={data.metrics.minutes_saved_7d} color="#14B8A6" />
        </div>
      </div>

      {/* Editor + Sandbox */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card-hard p-5 bg-white space-y-3">
          <h3 className="font-stencil text-2xl mb-1">⚙️ Personaliza Lucía</h3>
          <p className="text-xs text-black/60 mb-2">Lucía escribirá los borradores con tu identidad y tu tono.</p>
          <Field label="Tu nombre *" value={profile.nombre_persona} onChange={(v) => setProfile({ ...profile, nombre_persona: v })} placeholder="María García" />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Cargo" value={profile.cargo} onChange={(v) => setProfile({ ...profile, cargo: v })} placeholder="CEO" />
            <Field label="Empresa" value={profile.empresa} onChange={(v) => setProfile({ ...profile, empresa: v })} placeholder="Clínica Sonrisa" />
          </div>
          <Textarea label="Firma del email" value={profile.firma} onChange={(v) => setProfile({ ...profile, firma: v })} rows={3} placeholder={`Saludos,\nMaría García\nCEO en Clínica Sonrisa\n📞 +34 600 000 000`} />
          <label className="block">
            <span className="block text-xs font-mono uppercase tracking-widest mb-1">Tono</span>
            <select value={profile.tono_marca} onChange={(e) => setProfile({ ...profile, tono_marca: e.target.value })} className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white shadow-[3px_3px_0_#000]">
              {TONOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </label>
          <Field label="Idiomas (separados por coma)" value={profile.idiomas} onChange={(v) => setProfile({ ...profile, idiomas: v })} placeholder="español, inglés" />
          <Textarea label="Reglas custom" value={profile.reglas_custom} onChange={(v) => setProfile({ ...profile, reglas_custom: v })} rows={3} placeholder="Ej: si me piden reunión, propón siempre martes/jueves · si es factura, reenvía a contabilidad@..." />

          <div className="flex items-center gap-3 flex-wrap pt-2">
            <button onClick={save} disabled={saving || !profile.nombre_persona} className="btn-mustard text-sm disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
            <button onClick={() => setSbOpen((o) => !o)} className="border-[3px] border-black px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-black hover:text-white">
              {sbOpen ? "Cerrar prueba" : "🧪 Probar Lucía"}
            </button>
            {savedAt && <span className="text-[10px] font-mono text-[#14B8A6]">✓ Guardado {savedAt}</span>}
          </div>
        </div>

        {/* Sandbox */}
        <div className={`card-hard p-5 bg-[color:var(--cream)] ${sbOpen ? "" : "opacity-60"}`}>
          <h3 className="font-stencil text-xl mb-1">🧪 Probar Lucía</h3>
          <p className="text-xs text-black/60 mb-3">Pega un email ficticio y mira cómo respondería Lucía con tu config.</p>
          {!sbOpen ? (
            <div className="text-center py-8 text-sm text-black/40">Toca &quot;Probar Lucía&quot; para empezar</div>
          ) : (
            <div className="space-y-3">
              <input value={sbInput.from_name} onChange={(e) => setSbInput({ ...sbInput, from_name: e.target.value })} placeholder="De: nombre" className="w-full border-2 border-black px-3 py-2 text-sm" />
              <input value={sbInput.subject} onChange={(e) => setSbInput({ ...sbInput, subject: e.target.value })} placeholder="Asunto" className="w-full border-2 border-black px-3 py-2 text-sm" />
              <textarea value={sbInput.body} onChange={(e) => setSbInput({ ...sbInput, body: e.target.value })} placeholder="Cuerpo del email entrante" rows={5} className="w-full border-2 border-black p-2 text-sm font-mono" />
              <button onClick={sbSend} disabled={sbBusy || !sbInput.subject || !sbInput.body} className="btn-mustard text-xs disabled:opacity-50">
                {sbBusy ? "Lucía está pensando…" : "Generar borrador"}
              </button>

              {sbResult && (
                <div className="card-hard p-3 bg-white mt-3">
                  <div className="text-[10px] font-mono uppercase text-black/40 mb-2">
                    intent: <b>{sbResult.intent}</b> · confianza: <b style={{ color: sbResult.confidence >= 0.7 ? "#14B8A6" : "#EF4444" }}>{sbResult.confidence.toFixed(2)}</b>
                    <div className="italic mt-1">{sbResult.reasoning}</div>
                  </div>
                  <pre className="text-sm whitespace-pre-wrap font-sans">{sbResult.respuesta}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Drafts recientes */}
      <div className="card-hard p-5 bg-white">
        <h3 className="font-stencil text-2xl mb-3">📝 Borradores recientes ({data.drafts.length})</h3>
        {data.drafts.length === 0 ? (
          <p className="text-sm text-black/50">
            Aún no hay borradores. Cuando Lucía procese tu bandeja Gmail, los borradores creados aparecerán aquí.
          </p>
        ) : (
          <div className="space-y-3">
            {data.drafts.slice(0, 10).map((d) => (
              <div key={d.id} className="border-2 border-black bg-white p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{d.from_name || d.from_email || "?"}</span>
                    {d.intent && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border-2 border-black text-white" style={{ backgroundColor: INTENT_COLORS[d.intent] || "#000" }}>
                        {INTENT_LABELS[d.intent] || d.intent}
                      </span>
                    )}
                    {d.confidence !== null && <span className="text-[10px] font-mono text-black/50">conf {d.confidence.toFixed(2)}</span>}
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase border-2 ${
                      d.status === "sent" ? "border-[#14B8A6] text-[#14B8A6]" :
                      d.status === "edited" ? "border-[color:var(--mustard)] bg-[color:var(--mustard)]" :
                      d.status === "rejected" ? "border-[color:var(--red)] text-[color:var(--red)]" :
                      "border-black/30 text-black/60"
                    }`}>{d.status}</span>
                  </div>
                  <span className="text-[10px] font-mono text-black/40">{new Date(d.created_at).toLocaleString("es-ES")}</span>
                </div>

                {d.subject && <div className="text-xs font-bold mb-1">📧 {d.subject}</div>}
                {d.incoming_snippet && (
                  <div className="border-l-4 border-black/20 pl-3 text-xs text-black/60 mb-2 italic">{d.incoming_snippet.slice(0, 200)}...</div>
                )}

                <div className="mb-2">
                  <div className="text-[10px] font-mono text-black/40 mb-1">Borrador Lucía</div>
                  <textarea value={editing[d.id] ?? d.proposed_response} onChange={(e) => setEditing({ ...editing, [d.id]: e.target.value })} rows={4} className="w-full border-2 border-black p-2 text-xs font-mono" disabled={d.status !== "draft_created"} />
                </div>

                {d.status === "draft_created" && (
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => actDraft(d.id, "sent")} disabled={busyId === d.id} className="btn-mustard text-xs disabled:opacity-50">✓ Enviado tal cual</button>
                    <button onClick={() => actDraft(d.id, "edited")} disabled={busyId === d.id || !editing[d.id]} className="border-[3px] border-black px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white disabled:opacity-50">✏️ Lo edité</button>
                    <button onClick={() => actDraft(d.id, "rejected")} disabled={busyId === d.id} className="border-[3px] border-[color:var(--red)] text-[color:var(--red)] px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-[color:var(--red)] hover:text-white disabled:opacity-50">✗ No lo usé</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-hard p-4 bg-[color:var(--cream)] text-xs">
        <div className="font-bold mb-1">🔒 Estado de activación</div>
        <p className="text-black/70">
          Lucía YA funciona con tu Gmail vía OAuth (lectura + borradores + limpieza de promos).
          Lo que añadimos hoy: <b>editor de personalidad</b> (cómo escribe), <b>sandbox</b> para probar, <b>cola de revisión</b> y <b>aprendizaje</b>.
          Para que la app Google deje de marcar &quot;no verificada&quot; falta Google OAuth App Verification (1-4 sem trámite externo).
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
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
