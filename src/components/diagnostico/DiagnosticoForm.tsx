"use client";

// =============================================================================
// DiagnosticoForm — FASE 1 (solo maquetado).
// El formulario del gancho de captación /diagnostico: datos del negocio, web,
// Instagram, las 8 preguntas y el email OBLIGATORIO (la llave para ver el
// resultado). El botón "Ver mi diagnóstico" NO hace nada real todavía: el
// motor de análisis (Claude), el adelanto en pantalla (semáforo) y el envío
// del informe completo por email son fases siguientes.
// Voz "el sistema", sin nombres de agente. Estilo brutalista del resto de la web.
// =============================================================================

import { useState } from "react";

type Answers = {
  nombre: string;
  sector: string;
  ciudad: string;
  googleNombre: string;
  web: string;
  instagram: string;
  q1_volumen: string;
  q2_tiempo: string;
  q3_fuera_horario: string;
  q4_ticket: string;
  q5_herramientas: string;
  q5_conectadas: string;
  q6_resenas: string;
  q7_origen: string;
  q8_seguimiento: string;
  email: string;
};

const EMPTY: Answers = {
  nombre: "",
  sector: "",
  ciudad: "",
  googleNombre: "",
  web: "",
  instagram: "",
  q1_volumen: "",
  q2_tiempo: "",
  q3_fuera_horario: "",
  q4_ticket: "",
  q5_herramientas: "",
  q5_conectadas: "",
  q6_resenas: "",
  q7_origen: "",
  q8_seguimiento: "",
  email: "",
};

const SECTORES = [
  "Clínica dental",
  "Clínica de estética",
  "Abogados / despacho",
  "Inmobiliaria",
];

// ── Botones de opción (estilo brutalista) ──────────────────────────────────
function Options({
  name,
  value,
  choices,
  onChange,
}: {
  name: keyof Answers;
  value: string;
  choices: string[];
  onChange: (name: keyof Answers, v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {choices.map((c) => {
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(name, c)}
            className={`px-4 py-2 text-sm font-bold border-[3px] border-black transition-all ${
              active
                ? "bg-black text-[color:var(--mustard)] shadow-[3px_3px_0_var(--red)]"
                : "bg-white text-black hover:bg-[color:var(--cream)] shadow-[3px_3px_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#000]"
            }`}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

// ── Envoltura de pregunta numerada ─────────────────────────────────────────
function Pregunta({
  n,
  titulo,
  ayuda,
  children,
}: {
  n: number | string;
  titulo: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-hard p-6 bg-white">
      <div className="flex items-start gap-4">
        <span className="font-stencil text-3xl text-[color:var(--red)] leading-none shrink-0 w-10">
          {typeof n === "number" ? String(n).padStart(2, "0") : n}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg leading-snug">{titulo}</h3>
          {ayuda ? <p className="text-sm text-black/55 mt-1">{ayuda}</p> : null}
          {children}
        </div>
      </div>
    </div>
  );
}

// Resultado que devuelve /api/diagnostico (tipado mínimo para la UI de prueba).
type Check = {
  etiqueta: string;
  estado: "ok" | "flojo" | "falta" | "no_verificable";
  fuente: string;
  detalle?: string;
};
type Frente = {
  frente: string;
  titulo: string;
  semaforo: "rojo" | "ambar" | "verde";
  titular: string;
  problema: string;
  solucion: string;
  checks?: Check[];
};
type ApiResult = {
  ok: boolean;
  id?: string;
  almacenado?: string;
  sector?: string;
  error?: string;
  resultado?: {
    resumenTitular: string;
    frentes: Frente[];
    dinero: {
      totalMesEUR: number;
      totalAnioEUR: number;
      desglose: { concepto: string; eur: number }[];
      explicacion: string;
    };
    honestidad?: { auditado: string[]; conectar: string[] };
    generadoConIA: boolean;
  };
  informeEmail?: {
    intentado: boolean;
    enviado: boolean;
    modo: string;
    to?: string;
    subject?: string;
    error?: string;
  };
};

const SEM_COLOR: Record<string, string> = { rojo: "#C8202A", ambar: "#F5C518", verde: "#16A34A" };
const SEM_LABEL: Record<string, string> = { rojo: "ROJO", ambar: "ÁMBAR", verde: "VERDE" };

export default function DiagnosticoForm() {
  const [a, setA] = useState<Answers>(EMPTY);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  const set = (name: keyof Answers, v: string) => {
    setA((prev) => ({ ...prev, [name]: v }));
    if (error) setError("");
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // El email es la llave: sin email no hay diagnóstico.
    if (!a.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email)) {
      setError("Necesitamos un email válido: es donde te llega tu informe completo.");
      const el = document.getElementById("diag-email");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus();
      return;
    }

    setLoading(true);
    setResult(null);
    setError("");

    const payload = {
      nombre: a.nombre,
      tipo: a.sector,
      ciudad: a.ciudad || undefined,
      googleNombre: a.googleNombre || undefined,
      web: a.web || undefined,
      instagram: a.instagram || undefined,
      email: a.email,
      respuestas: {
        q1_volumen: a.q1_volumen,
        q2_tiempo: a.q2_tiempo,
        q3_fuera_horario: a.q3_fuera_horario,
        q4_ticket: a.q4_ticket,
        q5_herramientas: a.q5_herramientas,
        q5_conectadas: a.q5_conectadas,
        q6_resenas: a.q6_resenas,
        q7_origen: a.q7_origen,
        q8_seguimiento: a.q8_seguimiento,
      },
    };

    try {
      const res = await fetch("/api/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json: ApiResult = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "No se pudo generar el diagnóstico. Inténtalo de nuevo.");
      } else {
        setResult(json);
        setTimeout(() => {
          document.getElementById("diag-resultado")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 60);
      }
    } catch {
      setError("Fallo de red al generar el diagnóstico. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ── Datos del negocio ─────────────────────────────────────────── */}
      <div className="card-hard p-6 bg-[color:var(--cream)] space-y-5">
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">
            TU NEGOCIO
          </span>
          <span className="text-black/50">Para que la auditoría sea sobre lo tuyo, no genérica</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-bold mb-1">Nombre del negocio</label>
            <input
              value={a.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              placeholder="Clínica Dental Sonríe"
              className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white focus:outline-none focus:shadow-[3px_3px_0_var(--red)]"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Tipo de negocio</label>
            <select
              value={a.sector}
              onChange={(e) => set("sector", e.target.value)}
              className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white focus:outline-none focus:shadow-[3px_3px_0_var(--red)]"
            >
              <option value="">Elige…</option>
              {SECTORES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">
              Tu web <span className="text-black/40 font-normal">(si tienes)</span>
            </label>
            <input
              value={a.web}
              onChange={(e) => set("web", e.target.value)}
              placeholder="https://tunegocio.com"
              className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white focus:outline-none focus:shadow-[3px_3px_0_var(--red)]"
            />
            <p className="text-xs text-black/45 mt-1">La analizamos de verdad: velocidad, claridad, si invita a contactar.</p>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">
              Tu Instagram <span className="text-black/40 font-normal">(si tienes)</span>
            </label>
            <input
              value={a.instagram}
              onChange={(e) => set("instagram", e.target.value)}
              placeholder="@tunegocio"
              className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white focus:outline-none focus:shadow-[3px_3px_0_var(--red)]"
            />
            <p className="text-xs text-black/45 mt-1">Miramos tu perfil público: constancia, bio, si convierte visitas en clientes.</p>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">
              Tu ciudad <span className="text-black/40 font-normal">(si quieres)</span>
            </label>
            <input
              value={a.ciudad}
              onChange={(e) => set("ciudad", e.target.value)}
              placeholder="Marbella"
              className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white focus:outline-none focus:shadow-[3px_3px_0_var(--red)]"
            />
            <p className="text-xs text-black/45 mt-1">Nos ayuda a encontrar tu ficha de Google y tus reseñas.</p>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">
              Tu nombre en Google <span className="text-black/40 font-normal">(si difiere)</span>
            </label>
            <input
              value={a.googleNombre}
              onChange={(e) => set("googleNombre", e.target.value)}
              placeholder="Tal y como sales en Google Maps"
              className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white focus:outline-none focus:shadow-[3px_3px_0_var(--red)]"
            />
            <p className="text-xs text-black/45 mt-1">Solo si en Google figuras con otro nombre que el comercial.</p>
          </div>
        </div>
      </div>

      {/* ── Las 8 preguntas ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 text-xs font-mono pt-2">
        <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">8 PREGUNTAS</span>
        <span className="text-black/50">2 minutos. Cuanto más preciso, mejor sale tu diagnóstico.</span>
      </div>

      <Pregunta n={1} titulo="¿Cuántos clientes nuevos te contactan al mes?" ayuda="WhatsApp, llamadas y redes, todo junto.">
        <Options name="q1_volumen" value={a.q1_volumen} onChange={set} choices={["Menos de 20", "20–50", "50–100", "Más de 100"]} />
      </Pregunta>

      <Pregunta n={2} titulo="¿Cuánto tardas de media en contestar?">
        <Options
          name="q2_tiempo"
          value={a.q2_tiempo}
          onChange={set}
          choices={["Al instante", "Menos de 1 hora", "Unas horas", "Al día siguiente o más"]}
        />
      </Pregunta>

      <Pregunta n={3} titulo="¿Atiendes fuera de horario y fines de semana?">
        <Options name="q3_fuera_horario" value={a.q3_fuera_horario} onChange={set} choices={["Sí, siempre", "A veces", "No"]} />
      </Pregunta>

      <Pregunta n={4} titulo="¿Cuánto cobras de media por cliente o servicio?" ayuda="Nos sirve para calcular cuánto dinero se te escapa cada mes.">
        <div className="mt-3 flex items-center gap-2 max-w-[220px]">
          <span className="font-stencil text-2xl">€</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={a.q4_ticket}
            onChange={(e) => set("q4_ticket", e.target.value)}
            placeholder="120"
            className="w-full border-[3px] border-black px-3 py-2 text-lg font-bold bg-white focus:outline-none focus:shadow-[3px_3px_0_var(--red)]"
          />
          <span className="text-sm text-black/50">de media</span>
        </div>
      </Pregunta>

      <Pregunta
        n={5}
        titulo="¿Qué herramientas usas ahora (agenda, WhatsApp, email…)?"
        ayuda="Escríbelas tal cual. Luego dinos si están conectadas entre sí."
      >
        <textarea
          value={a.q5_herramientas}
          onChange={(e) => set("q5_herramientas", e.target.value)}
          rows={2}
          placeholder="Ej: agenda en papel, WhatsApp normal, Gmail, Excel de pacientes…"
          className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white mt-3 focus:outline-none focus:shadow-[3px_3px_0_var(--red)]"
        />
        <p className="text-sm font-bold mt-3">¿Están conectadas entre sí?</p>
        <Options name="q5_conectadas" value={a.q5_conectadas} onChange={set} choices={["Sí", "A medias", "No", "No lo sé"]} />
      </Pregunta>

      <Pregunta n={6} titulo="¿Cuántas reseñas pides al mes activamente?" ayuda="Pedirlas de forma activa, no las que llegan solas.">
        <Options name="q6_resenas" value={a.q6_resenas} onChange={set} choices={["Ninguna", "1–5", "5–15", "Más de 15"]} />
      </Pregunta>

      <Pregunta n={7} titulo="¿De dónde te llega la mayoría de clientes?">
        <Options
          name="q7_origen"
          value={a.q7_origen}
          onChange={set}
          choices={["Boca a boca", "Redes (IG/FB)", "Google", "Mi web", "Publicidad pagada"]}
        />
      </Pregunta>

      <Pregunta n={8} titulo="¿Haces seguimiento de los que preguntan pero no compran?">
        <Options name="q8_seguimiento" value={a.q8_seguimiento} onChange={set} choices={["Sí, siempre", "A veces", "No, nunca"]} />
      </Pregunta>

      {/* ── Email obligatorio: la llave ──────────────────────────────── */}
      <div className="card-hard p-6 bg-black text-[color:var(--cream)]">
        <div className="flex items-center gap-3 text-xs font-mono mb-3">
          <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">ÚLTIMO PASO</span>
        </div>
        <label htmlFor="diag-email" className="block font-stencil text-2xl mb-1">
          ¿A qué email te mandamos el informe completo?
        </label>
        <p className="text-sm text-white/70 mb-4">
          En pantalla verás el adelanto al instante. El informe detallado, con todo lo que puedes mejorar y cómo,
          te llega por email. <span className="text-[color:var(--mustard)] font-bold">Sin email no hay diagnóstico.</span>
        </p>
        <input
          id="diag-email"
          type="email"
          required
          value={a.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="tunombre@tunegocio.com"
          className="w-full border-[3px] border-[color:var(--mustard)] px-3 py-3 text-base font-bold bg-white text-black focus:outline-none focus:shadow-[4px_4px_0_var(--mustard)]"
        />
        {error ? <p className="text-[color:var(--mustard)] text-sm font-bold mt-2">⚠ {error}</p> : null}
      </div>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <div className="text-center">
        <button type="submit" disabled={loading} className="btn-mustard text-lg disabled:opacity-60 disabled:cursor-wait">
          {loading ? "Analizando tu negocio…" : "Ver mi diagnóstico →"}
        </button>
        <p className="text-xs text-black/45 mt-3">
          Gratis en beta · Sin compromiso · Tu informe vale 499€ y hoy no pagas nada
        </p>
        {loading ? (
          <p className="text-sm text-black/60 mt-2">
            Leyendo tu web y tu Instagram y cruzándolo con tus respuestas. Tarda unos segundos…
          </p>
        ) : null}
      </div>

      {/* ── ADELANTO EN PANTALLA (Fase 3): solo el QUÉ. El detalle CÓMO va por email. ── */}
      {result?.resultado ? (
        <div id="diag-resultado" className="space-y-5">
          {/* 1. Cabecera de impacto */}
          <div className="card-hard p-6 md:p-8 bg-black text-[color:var(--cream)]">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono mb-4">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">DIAGNÓSTICO LISTO</span>
              <span className="text-white/55">análisis con IA · sector {result.sector}</span>
            </div>
            <h3 className="font-stencil text-3xl md:text-5xl leading-[0.95]">{result.resultado.resumenTitular}</h3>
          </div>

          {/* 2. Número estrella */}
          <div className="card-hard p-6 md:p-8 bg-[color:var(--red)] text-white text-center">
            <div className="font-mono uppercase tracking-widest text-xs md:text-sm text-white/80">
              Estás perdiendo aproximadamente
            </div>
            <div className="font-stencil text-5xl md:text-7xl text-[color:var(--mustard)] leading-none mt-2">
              ~{result.resultado.dinero.totalMesEUR.toLocaleString("es-ES")} €/mes
            </div>
            <div className="text-sm md:text-base text-white/80 mt-2">
              ≈ {result.resultado.dinero.totalAnioEUR.toLocaleString("es-ES")} €/año que se escapan
            </div>
          </div>

          {/* 3. Los 5 semáforos (sin el detalle problema/solución — eso va al email) */}
          <div>
            <h4 className="font-stencil text-2xl md:text-3xl mb-4">Tu semáforo, frente por frente</h4>
            <div className="grid sm:grid-cols-2 gap-3">
              {result.resultado.frentes.map((f) => {
                const total = f.checks?.length ?? 0;
                const noVerif = f.checks?.filter((c) => c.estado === "no_verificable").length ?? 0;
                const aud = total - noVerif;
                return (
                  <div key={f.frente} className="card-hard bg-white overflow-hidden">
                    <div
                      className="flex items-center justify-between px-4 py-3"
                      style={{ backgroundColor: SEM_COLOR[f.semaforo], color: f.semaforo === "ambar" ? "#000" : "#fff" }}
                    >
                      <span className="font-stencil text-lg md:text-xl">{f.titulo}</span>
                      <span
                        className="font-mono text-[10px] font-bold tracking-widest border px-1.5 py-0.5"
                        style={{ borderColor: f.semaforo === "ambar" ? "rgba(0,0,0,.35)" : "rgba(255,255,255,.6)" }}
                      >
                        {SEM_LABEL[f.semaforo]}
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-black/75 font-medium leading-snug">{f.titular}</p>
                      {total > 0 ? (
                        <p className="text-[11px] font-mono text-black/45 mt-2">
                          ✓ {aud} de {total} puntos auditados
                          {noVerif > 0 ? ` · 🔒 ${noVerif} a fondo en la demo` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3b. Honestidad: auditado ✓ vs conéctalo 🔒 */}
          {result.resultado.honestidad &&
          (result.resultado.honestidad.auditado.length > 0 || result.resultado.honestidad.conectar.length > 0) ? (
            <div className="card-hard bg-white overflow-hidden">
              <div className="bg-black text-[color:var(--mustard)] px-4 py-2 font-mono text-xs font-bold tracking-widest">
                QUÉ HEMOS PODIDO AUDITAR DESDE FUERA
              </div>
              <div className="p-5 grid sm:grid-cols-2 gap-5">
                <div>
                  <div className="text-sm font-bold mb-2" style={{ color: "#16A34A" }}>✓ Auditado desde fuera</div>
                  <ul className="space-y-1">
                    {result.resultado.honestidad.auditado.map((x) => (
                      <li key={x} className="text-xs text-black/70 leading-snug">· {x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-bold mb-2 text-black/70">🔒 Para auditar a fondo, conecta tus cuentas</div>
                  <ul className="space-y-1">
                    {result.resultado.honestidad.conectar.map((x) => (
                      <li key={x} className="text-xs text-black/50 leading-snug">· {x}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="px-5 pb-4 text-[11px] text-black/45 leading-relaxed">
                Lo que no se puede leer desde fuera con certeza no lo inventamos: requiere conectar tus cuentas
                (Instagram, Google, WhatsApp). En la demo el sistema audita el resto en profundidad.
              </p>
            </div>
          ) : null}

          {/* 4. Gancho al email */}
          <div className="card-hard p-6 bg-[color:var(--mustard)] text-black">
            <div className="flex items-start gap-4">
              <span className="text-3xl leading-none">📧</span>
              <div>
                <div className="font-stencil text-xl md:text-2xl">Tu informe completo va de camino</div>
                <p className="text-sm mt-1 leading-relaxed">
                  Esto es solo el adelanto. El <strong>informe detallado</strong> —con el porqué de cada punto y el{" "}
                  <strong>plan exacto para recuperar ese dinero</strong>— te llega al email{" "}
                  <strong>{a.email}</strong> en unos minutos.
                </p>
              </div>
            </div>
          </div>

          {/* 5. CTA potente */}
          <div className="card-hard p-6 md:p-8 bg-black text-[color:var(--cream)] text-center">
            <div className="font-stencil text-2xl md:text-4xl">¿Quieres que lo arreglemos por ti?</div>
            <p className="text-sm text-white/70 mt-2 mb-5">
              Te lo enseñamos funcionando con tu negocio en una demo de 15 minutos, sin compromiso.
            </p>
            <a href="/beta" className="btn-mustard text-lg">Pide tu demo →</a>
          </div>

          {/* Debug (cerrado, pequeño) — JSON + estado del envío del email */}
          <details className="text-xs">
            <summary className="cursor-pointer font-mono text-black/40">▸ debug: JSON + estado del email</summary>
            <div className="mt-2 font-mono text-[11px] text-black/60">
              Email: {result.informeEmail?.modo === "resend" && result.informeEmail?.enviado
                ? `enviado a ${result.informeEmail?.to}`
                : result.informeEmail?.modo === "log_local"
                ? `(local) se habría enviado a ${result.informeEmail?.to}`
                : result.informeEmail?.modo === "error"
                ? `error: ${result.informeEmail?.error}`
                : "—"}
            </div>
            <pre className="mt-2 bg-[color:var(--cream)] border-2 border-black/20 p-3 leading-snug overflow-auto max-h-96 whitespace-pre-wrap break-words">
{JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </form>
  );
}
