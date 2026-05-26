"use client";
import { useEffect, useState } from "react";

type Pending = {
  id: string;
  wa_phone_number: string;
  wa_profile_name: string | null;
  incoming_text: string;
  proposed_response: string;
  intent: string | null;
  confidence: number | null;
  created_at: string;
};

type Lead = {
  id: string;
  wa_phone_number: string | null;
  wa_profile_name: string | null;
  lead_type: string;
  notes: string;
  created_at: string;
};

type Data = {
  pending: Pending[];
  leads: Lead[];
  counts: { pending: number; approved: number; rejected: number };
  modo: "ruedines" | "auto";
  aprobaciones: number;
  rechazos: number;
  porcentaje_aprobacion: number;
  sugerencia_auto: boolean;
};

type Profile = {
  nombre_negocio: string;
  sector: string;
  horario: string;
  servicios_destacados: string;
  tono_marca: string;
  reglas_custom: string;
  modo_activacion: "ruedines" | "auto";
};

type SbMsg = { role: "user" | "assistant"; content: string; meta?: { intent: string; confidence: number; wouldEscalate: boolean } };

const TONOS = [
  { v: "cercano y profesional", l: "Cercano y profesional (recomendado)" },
  { v: "muy cercano y cálido", l: "Muy cercano y cálido" },
  { v: "formal y serio", l: "Formal (despachos, abogados)" },
  { v: "divertido y desenfadado", l: "Divertido y desenfadado" },
  { v: "técnico y directo", l: "Técnico y directo" },
];

const SECTORES = [
  "Clínica dental", "Clínica estética", "Fisioterapia", "Podología", "Peluquería / barbería",
  "Despacho de abogados", "Asesoría", "Gimnasio / coaching", "Restaurante", "Otro",
];

export default function PabloDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});

  const [sbOpen, setSbOpen] = useState(false);
  const [sbMsgs, setSbMsgs] = useState<SbMsg[]>([]);
  const [sbInput, setSbInput] = useState("");
  const [sbBusy, setSbBusy] = useState(false);

  async function load() {
    try {
      const [p, pr] = await Promise.all([
        fetch("/api/pablo/pending").then((r) => r.json()),
        fetch("/api/pablo/profile").then((r) => r.json()),
      ]);
      if (p.error || pr.error) {
        setAvailable(false);
        return;
      }
      setData(p);
      setProfile(pr.profile);
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const i = setInterval(load, 30_000);
    return () => clearInterval(i);
  }, []);

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      const res = await fetch("/api/pablo/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) setSavedAt(new Date().toLocaleTimeString("es-ES"));
    } finally {
      setSaving(false);
    }
  }

  async function approve(id: string) {
    setBusyId(id);
    try {
      const customText = editing[id]?.trim();
      const res = await fetch("/api/pablo/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, customText: customText || undefined }),
      });
      const j = await res.json();
      if (!res.ok) alert(j.error || "Error");
      else if (!j.sent) console.log("[pablo] aprobado pero no enviado:", j.sentReason);
    } finally {
      setBusyId(null);
      setEditing((e) => { const c = { ...e }; delete c[id]; return c; });
      load();
    }
  }

  async function reject(id: string) {
    if (!confirm("¿Rechazar esta respuesta?")) return;
    setBusyId(id);
    try {
      await fetch("/api/pablo/reject", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } finally {
      setBusyId(null);
      load();
    }
  }

  async function switchToAuto() {
    if (!confirm("¿Pasar Pablo a modo AUTO? Responderá solo sin tu aprobación.")) return;
    await fetch("/api/pablo/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modo_activacion: "auto" }),
    });
    load();
  }

  async function sbSend() {
    if (!sbInput.trim() || sbBusy || !profile) return;
    const userMsg: SbMsg = { role: "user", content: sbInput.trim() };
    const next = [...sbMsgs, userMsg];
    setSbMsgs(next);
    setSbInput("");
    setSbBusy(true);
    try {
      const res = await fetch("/api/pablo/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          profileOverride: {
            nombre_negocio: profile.nombre_negocio,
            sector: profile.sector,
            horario: profile.horario,
            servicios_destacados: profile.servicios_destacados,
            tono_marca: profile.tono_marca,
            reglas_custom: profile.reglas_custom,
          },
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Error");
      setSbMsgs([...next, { role: "assistant", content: j.respuesta, meta: { intent: j.intent, confidence: j.confidence, wouldEscalate: j.wouldEscalate } }]);
    } catch (e) {
      setSbMsgs([...next, { role: "assistant", content: `[Error: ${e instanceof Error ? e.message : "fallo"}]` }]);
    } finally {
      setSbBusy(false);
    }
  }

  if (!available) {
    return (
      <div className="mt-8 card-hard p-6 bg-[color:var(--mustard)]/30">
        <h3 className="font-stencil text-xl mb-2">⚙️ Pablo pendiente configurar</h3>
        <p className="text-sm text-black/70">
          Falta correr la migración SQL en Supabase. Ver{" "}
          <code className="bg-white px-1">scripts/migrations/007_pablo_whatsapp.sql</code>.
        </p>
      </div>
    );
  }

  if (loading || !data || !profile) {
    return <div className="mt-8 text-sm text-black/50">Cargando Pablo…</div>;
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Stats */}
      <div>
        <h2 className="font-stencil text-3xl">💬 WhatsApp Business</h2>
        <p className="text-xs font-mono text-black/60 mt-1">
          Modo: <span className="px-2 py-0.5 ml-1 font-bold uppercase tracking-widest border-2 border-black" style={{ background: data.modo === "ruedines" ? "var(--mustard)" : "#14B8A6", color: data.modo === "ruedines" ? "#000" : "#fff" }}>{data.modo === "ruedines" ? "🛡 Ruedines" : "⚡ Auto"}</span>
          {data.aprobaciones + data.rechazos > 0 && (
            <span className="ml-3">Histórico: {data.aprobaciones}/{data.aprobaciones + data.rechazos} aprob. ({data.porcentaje_aprobacion}%)</span>
          )}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Stat label="Pendientes aprobar" value={data.counts.pending} color="#F5C518" highlight />
          <Stat label="Leads detectados" value={data.leads.length} color="#14B8A6" />
          <Stat label="Aprobadas total" value={data.counts.approved} color="#3B82F6" />
          <Stat label="Rechazadas / editadas" value={data.counts.rejected} color="#EF4444" />
        </div>
      </div>

      {/* Sugerencia auto */}
      {data.sugerencia_auto && (
        <div className="card-hard p-4 bg-[color:var(--mustard)]/30 border-[#14B8A6]">
          <div className="font-stencil text-lg mb-1">🎉 Pablo está listo para Auto</div>
          <p className="text-sm mb-3">
            Has aprobado el <b>{data.porcentaje_aprobacion}%</b> de las {data.aprobaciones + data.rechazos} respuestas. Puede responder solo.
          </p>
          <button onClick={switchToAuto} className="btn-mustard text-sm">Pasar Pablo a Auto →</button>
        </div>
      )}

      {/* Editor + Sandbox */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card-hard p-5 bg-white space-y-3">
          <h3 className="font-stencil text-2xl mb-1">⚙️ Personaliza Pablo</h3>
          <Field label="Nombre del negocio *" value={profile.nombre_negocio} onChange={(v) => setProfile({ ...profile, nombre_negocio: v })} placeholder="Clínica Dental Sonrisa" />
          <label className="block">
            <span className="block text-xs font-mono uppercase tracking-widest mb-1">Sector *</span>
            <select value={profile.sector} onChange={(e) => setProfile({ ...profile, sector: e.target.value })} className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white shadow-[3px_3px_0_#000]">
              <option value="">Elige…</option>
              {SECTORES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <Field label="Horario" value={profile.horario} onChange={(v) => setProfile({ ...profile, horario: v })} placeholder="L-V 9-19, S 10-14" />
          <Textarea label="Servicios destacados" value={profile.servicios_destacados} onChange={(v) => setProfile({ ...profile, servicios_destacados: v })} rows={3} placeholder="Implantes, ortodoncia, blanqueamiento" />
          <label className="block">
            <span className="block text-xs font-mono uppercase tracking-widest mb-1">Tono</span>
            <select value={profile.tono_marca} onChange={(e) => setProfile({ ...profile, tono_marca: e.target.value })} className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white shadow-[3px_3px_0_#000]">
              {TONOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </label>
          <Textarea label="Reglas custom" value={profile.reglas_custom} onChange={(v) => setProfile({ ...profile, reglas_custom: v })} rows={3} placeholder="Ej: nunca menciones precios concretos · derivar urgencias a 900 XXX" />
          <div className="flex items-center gap-3 flex-wrap pt-2">
            <button onClick={save} disabled={saving || !profile.nombre_negocio || !profile.sector} className="btn-mustard text-sm disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
            <button onClick={() => setSbOpen((o) => !o)} className="border-[3px] border-black px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-black hover:text-white">
              {sbOpen ? "Cerrar prueba" : "🧪 Probar Pablo"}
            </button>
            {savedAt && <span className="text-[10px] font-mono text-[#14B8A6]">✓ Guardado {savedAt}</span>}
          </div>
        </div>

        <div className={`card-hard p-5 bg-[color:var(--cream)] ${sbOpen ? "" : "opacity-60"}`}>
          <h3 className="font-stencil text-xl mb-1">🧪 Probar Pablo</h3>
          <p className="text-xs text-black/60 mb-3">Escribe como cliente. Pablo responde con tu config actual sin guardar nada.</p>
          {!sbOpen ? (
            <div className="text-center py-8 text-sm text-black/40">Toca &quot;Probar Pablo&quot; para empezar</div>
          ) : (
            <>
              <div className="bg-white border-2 border-black h-[320px] overflow-y-auto p-3 space-y-3 mb-3">
                {sbMsgs.length === 0 ? (
                  <div className="text-xs text-black/40 italic">Ej: &quot;hola, ¿cuánto cuesta una limpieza?&quot;</div>
                ) : sbMsgs.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] px-3 py-2 text-sm border-2 border-black ${m.role === "user" ? "bg-[#25D366] text-black" : "bg-white"}`}>
                      {m.content}
                      {m.meta && (
                        <div className="text-[10px] font-mono mt-2 pt-2 border-t border-black/20 text-black/60">
                          <div>intent: <b>{m.meta.intent}</b> · confianza: <b style={{ color: m.meta.confidence >= 0.7 ? "#14B8A6" : "#EF4444" }}>{m.meta.confidence.toFixed(2)}</b></div>
                          {m.meta.wouldEscalate && <div className="text-[color:var(--red)] font-bold mt-1">⚠ Se escalaría a humano</div>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {sbBusy && <div className="text-sm text-black/40">Pablo está pensando…</div>}
              </div>
              <div className="flex gap-2">
                <input value={sbInput} onChange={(e) => setSbInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !sbBusy) sbSend(); }} placeholder="Escribe como cliente…" className="flex-1 border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000]" disabled={sbBusy} />
                <button onClick={sbSend} disabled={sbBusy || !sbInput.trim()} className="btn-mustard text-sm disabled:opacity-50">Enviar</button>
              </div>
              {sbMsgs.length > 0 && <button onClick={() => setSbMsgs([])} className="text-[11px] font-mono text-black/50 mt-2 underline">Limpiar</button>}
            </>
          )}
        </div>
      </div>

      {/* Leads */}
      {data.leads.length > 0 && (
        <div className="card-hard p-5 bg-white border-[#14B8A6]">
          <h3 className="font-stencil text-2xl mb-3">🎯 Leads detectados ({data.leads.length})</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {data.leads.slice(0, 10).map((l) => (
              <div key={l.id} className="border-2 border-black p-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border-2 border-black" style={{ backgroundColor: l.lead_type === "cita" ? "#14B8A6" : l.lead_type === "presupuesto" ? "#F5C518" : "#60A5FA", color: l.lead_type === "presupuesto" ? "#000" : "#fff" }}>{l.lead_type}</span>
                  <span className="font-bold text-sm">{l.wa_profile_name || l.wa_phone_number}</span>
                  <span className="text-[10px] font-mono text-black/40 ml-auto">{new Date(l.created_at).toLocaleString("es-ES")}</span>
                </div>
                <p className="text-sm">{l.notes}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cola pending */}
      <div className="card-hard p-5 bg-white border-[color:var(--mustard)]">
        <h3 className="font-stencil text-2xl mb-3">🛡️ Cola aprobación · {data.pending.length} pendiente{data.pending.length !== 1 ? "s" : ""}</h3>

        {data.pending.length === 0 ? (
          <p className="text-sm text-black/50">
            {data.modo === "ruedines"
              ? "No hay mensajes pendientes. Cuando llegue un WhatsApp nuevo aparecerá aquí."
              : "Pablo responde solo. Cambia el modo arriba si quieres aprobar cada respuesta."}
          </p>
        ) : (
          <div className="space-y-3">
            {data.pending.map((p) => (
              <div key={p.id} className="border-2 border-black bg-white p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{p.wa_profile_name || p.wa_phone_number}</span>
                    {p.intent && <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border-2 border-black bg-[#25D366] text-black">{p.intent}</span>}
                    {p.confidence !== null && <span className="text-[10px] font-mono text-black/50">conf {p.confidence.toFixed(2)}</span>}
                  </div>
                  <span className="text-[10px] font-mono text-black/40">{new Date(p.created_at).toLocaleString("es-ES")}</span>
                </div>

                <div className="mb-2">
                  <div className="text-[10px] font-mono text-black/40 uppercase mb-1">Cliente escribió</div>
                  <div className="border-l-4 border-black pl-3 text-sm">{p.incoming_text}</div>
                </div>

                <div className="mb-2">
                  <div className="text-[10px] font-mono text-black/40 uppercase mb-1">Pablo propone (editable)</div>
                  <textarea value={editing[p.id] ?? p.proposed_response} onChange={(e) => setEditing({ ...editing, [p.id]: e.target.value })} rows={3} className="w-full border-2 border-black p-2 text-sm font-mono shadow-[2px_2px_0_#000]" />
                  <div className="text-[10px] font-mono text-black/40 mt-1">{(editing[p.id] ?? p.proposed_response).length}/350 caracteres</div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => approve(p.id)} disabled={busyId === p.id} className="btn-mustard text-xs disabled:opacity-50">{busyId === p.id ? "…" : editing[p.id] && editing[p.id] !== p.proposed_response ? "✓ Aprobar (editado)" : "✓ Aprobar y enviar"}</button>
                  <button onClick={() => reject(p.id)} disabled={busyId === p.id} className="border-[3px] border-[color:var(--red)] text-[color:var(--red)] px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-[color:var(--red)] hover:text-white disabled:opacity-50">✗ Rechazar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Estado activación */}
      <div className="card-hard p-4 bg-[color:var(--cream)] text-xs">
        <div className="font-bold mb-1">🔒 Estado de activación</div>
        <p className="text-black/70">
          El motor Pablo está <strong>100% programado y desplegado</strong>. Para enviar/recibir WhatsApp real falta:
          alta WhatsApp Business Cloud API + número Business + aprobación Meta. Mientras tanto, Pablo guarda los mensajes
          en BD y te notifica leads/quejas por email, pero no envía respuestas a WhatsApp.
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
