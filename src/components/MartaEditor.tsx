"use client";
import { useEffect, useState } from "react";

type Profile = {
  nombre_negocio: string;
  sector: string;
  horario: string;
  servicios_destacados: string;
  tono_marca: string;
  reglas_custom: string;
  modo_activacion: "ruedines" | "auto";
  aprobaciones_count: number;
  rechazos_count: number;
};

type SandboxMsg = { role: "user" | "assistant"; content: string; meta?: SandboxMeta };
type SandboxMeta = {
  intent: string;
  confidence: number;
  reasoning: string;
  wouldEscalate: boolean;
};

const TONOS = [
  { v: "cercano y profesional", l: "Cercano y profesional (recomendado)" },
  { v: "muy cercano, amigable, con emojis", l: "Muy cercano (estilo Instagram)" },
  { v: "formal y serio, sin emojis", l: "Formal (despachos, abogados)" },
  { v: "divertido y desenfadado", l: "Divertido y desenfadado" },
  { v: "técnico y directo", l: "Técnico y directo" },
];

const SECTORES = [
  "Clínica dental",
  "Clínica estética",
  "Fisioterapia",
  "Podología",
  "Peluquería / barbería",
  "Despacho de abogados",
  "Asesoría",
  "Gimnasio / coaching",
  "Restaurante",
  "Otro",
];

export default function MartaEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supabaseConfigured, setSupabaseConfigured] = useState(true);

  // Sandbox
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [sandboxMsgs, setSandboxMsgs] = useState<SandboxMsg[]>([]);
  const [sandboxInput, setSandboxInput] = useState("");
  const [sandboxBusy, setSandboxBusy] = useState(false);

  // Cargar perfil
  useEffect(() => {
    fetch("/api/marta/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) setProfile(d.profile);
        else setSupabaseConfigured(false);
      })
      .catch(() => setSupabaseConfigured(false))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof Profile>(field: K, value: Profile[K]) {
    if (!profile) return;
    setProfile({ ...profile, [field]: value });
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/marta/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_negocio: profile.nombre_negocio,
          sector: profile.sector,
          horario: profile.horario,
          servicios_destacados: profile.servicios_destacados,
          tono_marca: profile.tono_marca,
          reglas_custom: profile.reglas_custom,
          modo_activacion: profile.modo_activacion,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setProfile(data.profile);
      setSavedAt(new Date().toLocaleTimeString("es-ES"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function sandboxSend() {
    if (!sandboxInput.trim() || sandboxBusy || !profile) return;
    const userMsg: SandboxMsg = { role: "user", content: sandboxInput.trim() };
    const next = [...sandboxMsgs, userMsg];
    setSandboxMsgs(next);
    setSandboxInput("");
    setSandboxBusy(true);

    try {
      const res = await fetch("/api/marta/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          // Pasamos perfil actual sin guardar para permitir probar antes de Save
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setSandboxMsgs([
        ...next,
        {
          role: "assistant",
          content: data.respuesta,
          meta: {
            intent: data.intent,
            confidence: data.confidence,
            reasoning: data.reasoning,
            wouldEscalate: data.wouldEscalate,
          },
        },
      ]);
    } catch (e) {
      setSandboxMsgs([
        ...next,
        {
          role: "assistant",
          content: `[Error: ${e instanceof Error ? e.message : "fallo"}]`,
        },
      ]);
    } finally {
      setSandboxBusy(false);
    }
  }

  if (!supabaseConfigured) {
    return (
      <div className="mt-8 card-hard p-6 bg-[color:var(--mustard)]/30">
        <h3 className="font-stencil text-xl mb-2">⚙️ Editor pendiente</h3>
        <p className="text-sm text-black/70">
          Para personalizar a Marta hay que crear la tabla{" "}
          <code className="bg-white px-1">marta_profiles</code> en Supabase. Ver{" "}
          <code className="bg-white px-1">scripts/migrations/003_marta_profile.sql</code>.
        </p>
      </div>
    );
  }

  if (loading || !profile) {
    return <div className="mt-8 text-sm text-black/50">Cargando configuración de Marta…</div>;
  }

  const totalAprobaciones = profile.aprobaciones_count + profile.rechazos_count;
  const pctAprob = totalAprobaciones > 0 ? Math.round((profile.aprobaciones_count / totalAprobaciones) * 100) : 0;

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h2 className="font-stencil text-3xl">⚙️ Personaliza a tu Marta</h2>
        <p className="text-xs font-mono text-black/60 mt-1">
          Configura cómo responde Marta a los DMs de tu negocio. Pruébala en el chat de prueba
          antes de activar.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Editor */}
        <div className="card-hard p-5 bg-white space-y-4">
          <Field
            label="Nombre del negocio *"
            value={profile.nombre_negocio}
            onChange={(v) => update("nombre_negocio", v)}
            placeholder="Ej: Clínica Dental Sonrisa"
          />

          <label className="block">
            <span className="block text-xs font-mono uppercase tracking-widest mb-1">Sector *</span>
            <select
              value={profile.sector}
              onChange={(e) => update("sector", e.target.value)}
              className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white shadow-[3px_3px_0_#000]"
            >
              <option value="">Elige…</option>
              {SECTORES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <Field
            label="Horario"
            value={profile.horario}
            onChange={(v) => update("horario", v)}
            placeholder="L-V 9-19, S 10-14"
          />

          <Textarea
            label="Servicios destacados"
            value={profile.servicios_destacados}
            onChange={(v) => update("servicios_destacados", v)}
            rows={3}
            placeholder="Implantes, ortodoncia invisible, blanqueamiento, primera consulta gratis"
            hint="Estas frases las usa Marta para responder consultas. Sé concreto."
          />

          <label className="block">
            <span className="block text-xs font-mono uppercase tracking-widest mb-1">Tono de marca</span>
            <select
              value={profile.tono_marca}
              onChange={(e) => update("tono_marca", e.target.value)}
              className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white shadow-[3px_3px_0_#000]"
            >
              {TONOS.map((t) => (
                <option key={t.v} value={t.v}>{t.l}</option>
              ))}
            </select>
          </label>

          <Textarea
            label="Reglas custom (opcional)"
            value={profile.reglas_custom}
            onChange={(v) => update("reglas_custom", v)}
            rows={3}
            placeholder="Ej: nunca menciones precios concretos · si preguntan por X derivar a Y · usar siempre 'doctor' antes del apellido"
            hint="Reglas duras que Marta cumple sí o sí."
          />

          <div className="pt-3 border-t-2 border-black/10">
            <label className="block">
              <span className="block text-xs font-mono uppercase tracking-widest mb-2">Modo de operación</span>
              <div className="grid sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => update("modo_activacion", "ruedines")}
                  className={`border-[3px] border-black p-3 text-left text-sm transition-all shadow-[3px_3px_0_#000] ${
                    profile.modo_activacion === "ruedines" ? "bg-[color:var(--mustard)]" : "bg-white"
                  }`}
                >
                  <div className="font-bold">🛡️ Ruedines</div>
                  <div className="text-xs text-black/60 mt-1">
                    Marta genera respuesta, tú apruebas antes de enviar. Recomendado los primeros 30 días.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => update("modo_activacion", "auto")}
                  className={`border-[3px] border-black p-3 text-left text-sm transition-all shadow-[3px_3px_0_#000] ${
                    profile.modo_activacion === "auto" ? "bg-[#14B8A6] text-white" : "bg-white"
                  }`}
                >
                  <div className="font-bold">⚡ Auto</div>
                  <div className="text-xs text-black/60 mt-1">
                    Marta responde sola sin tu intervención. Solo escala queja/baja confianza.
                  </div>
                </button>
              </div>
            </label>
            {totalAprobaciones > 0 && (
              <p className="text-[11px] font-mono text-black/50 mt-2">
                Histórico ruedines: {profile.aprobaciones_count}/{totalAprobaciones} respuestas aprobadas ({pctAprob}%)
              </p>
            )}
          </div>

          {error && (
            <div className="border-2 border-[color:var(--red)] bg-[color:var(--red)]/10 p-2 text-xs font-bold">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap pt-2">
            <button
              onClick={save}
              disabled={saving || !profile.nombre_negocio || !profile.sector}
              className="btn-mustard text-sm disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar configuración"}
            </button>
            <button
              onClick={() => setSandboxOpen((o) => !o)}
              className="border-[3px] border-black px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-black hover:text-white"
            >
              {sandboxOpen ? "Cerrar prueba" : "🧪 Probar Marta"}
            </button>
            {savedAt && (
              <span className="text-[10px] font-mono text-[#14B8A6]">✓ Guardado a las {savedAt}</span>
            )}
          </div>
        </div>

        {/* Sandbox */}
        <div className={`card-hard p-5 bg-[color:var(--cream)] ${sandboxOpen ? "" : "opacity-60"}`}>
          <h3 className="font-stencil text-xl mb-1">🧪 Probar Marta</h3>
          <p className="text-xs text-black/60 mb-3">
            Escribe como si fueras un cliente. Marta responde con tu configuración actual (sin guardar).
          </p>

          {!sandboxOpen ? (
            <div className="text-center py-8 text-sm text-black/40">
              Toca &quot;Probar Marta&quot; para empezar
            </div>
          ) : (
            <>
              <div className="bg-white border-2 border-black h-[320px] overflow-y-auto p-3 space-y-3 mb-3">
                {sandboxMsgs.length === 0 ? (
                  <div className="text-xs text-black/40 italic">
                    Ej: &quot;hola, ¿cuánto cuesta una limpieza?&quot; o &quot;quiero pedir cita martes&quot;
                  </div>
                ) : (
                  sandboxMsgs.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] px-3 py-2 text-sm border-2 border-black ${
                          m.role === "user" ? "bg-[#FF7A59] text-black" : "bg-[color:var(--cream)]"
                        }`}
                      >
                        {m.content}
                        {m.meta && (
                          <div className="text-[10px] font-mono mt-2 pt-2 border-t border-black/20 text-black/60">
                            <div>
                              intent: <b>{m.meta.intent}</b> · confianza:{" "}
                              <b style={{ color: m.meta.confidence >= 0.7 ? "#14B8A6" : "#EF4444" }}>
                                {m.meta.confidence.toFixed(2)}
                              </b>
                            </div>
                            <div className="italic">{m.meta.reasoning}</div>
                            {m.meta.wouldEscalate && (
                              <div className="text-[color:var(--red)] font-bold mt-1">
                                ⚠ Esto se escalaría a humano en producción
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {sandboxBusy && (
                  <div className="flex justify-start">
                    <div className="bg-[color:var(--cream)] border-2 border-black px-3 py-2 text-sm">
                      Marta está pensando…
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  value={sandboxInput}
                  onChange={(e) => setSandboxInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !sandboxBusy) sandboxSend();
                  }}
                  placeholder="Escribe como cliente…"
                  className="flex-1 border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000]"
                  disabled={sandboxBusy}
                />
                <button
                  onClick={sandboxSend}
                  disabled={sandboxBusy || !sandboxInput.trim()}
                  className="btn-mustard text-sm disabled:opacity-50"
                >
                  Enviar
                </button>
              </div>
              {sandboxMsgs.length > 0 && (
                <button
                  onClick={() => setSandboxMsgs([])}
                  className="text-[11px] font-mono text-black/50 mt-2 underline"
                >
                  Limpiar conversación
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-widest mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000]"
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-widest mb-1">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full border-[3px] border-black p-3 font-mono text-sm shadow-[3px_3px_0_#000] focus:outline-none"
      />
      {hint && <span className="text-[10px] text-black/50 mt-1 block">{hint}</span>}
    </label>
  );
}
