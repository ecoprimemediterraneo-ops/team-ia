"use client";

// Alta de un negocio nuevo.
//
// El PRIMER paso es el sector. Antes no se preguntaba nunca, así que un cliente
// nuevo entraba al panel genérico: sin perfil, con los siete agentes, con KPIs
// que no le decían nada y con las IAs hablando como un bot cualquiera.
//
// A partir de ese primer paso, todo lo demás se adapta: los ejemplos de cada
// campo, los marcadores de posición y los servicios de arranque salen del perfil
// del sector elegido (`sectores.ts`). Nada de "Clínica Dental Sonrisa" a un
// gestoría.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessProfile } from "@/lib/claude";
import { SECTORES_LISTA, getPerfilSector, type SectorNegocio } from "@/lib/sectores";

type Servicio = { nombre: string; durationMin: number; precioEUR?: number };
type Vocab = ReturnType<typeof getPerfilSector>["vocabulario"];

const CAMPOS: {
  key: keyof BusinessProfile;
  title: (v: Vocab) => string;
  hint: string;
  type?: "input" | "textarea";
}[] = [
  {
    key: "nombre",
    title: () => "¿Cómo se llama tu negocio?",
    hint: "Como aparece en Google. Sin la razón social.",
  },
  {
    key: "sector",
    title: () => "¿A qué te dedicas exactamente?",
    hint: "Con la ciudad, si quieres. Tus agentes lo usan para hablar de ti con propiedad.",
  },
  {
    key: "ofrece",
    title: (v) => `¿Qué ${v.servicioPlural} ofreces?`,
    hint: "Cuanto más concreto, mejor contestan tus agentes cuando les pregunten.",
    type: "textarea",
  },
  {
    key: "publico",
    title: (v) => `¿Quién es tu ${v.cliente} habitual?`,
    hint: "Edad, perfil, zona. Ayuda a que el contenido y las respuestas encajen.",
    type: "textarea",
  },
  {
    key: "tono",
    title: () => "¿Cómo quieres que hablen tus agentes?",
    hint: "Da ejemplos de cómo hablas TÚ con tus clientes.",
    type: "textarea",
  },
];

export default function OnboardingWizard({ initial }: { initial?: BusinessProfile }) {
  const router = useRouter();
  // Paso 0 = sector. Del 1 al 5 = los campos. El último = servicios de arranque.
  const [step, setStep] = useState(0);
  const [sector, setSector] = useState<SectorNegocio | null>(null);
  const [data, setData] = useState<BusinessProfile>(
    initial ?? { nombre: "", sector: "", ofrece: "", tono: "", publico: "" },
  );
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const perfil = getPerfilSector(sector);
  const v = perfil.vocabulario;
  const TOTAL = 1 + CAMPOS.length + 1;

  // Al elegir sector se precargan los servicios de arranque de ESE sector.
  function elegirSector(id: SectorNegocio) {
    setSector(id);
    setServicios(getPerfilSector(id).alta.servicios.map((x) => ({ ...x })));
    setStep(1);
  }

  const campo = step >= 1 && step <= CAMPOS.length ? CAMPOS[step - 1] : null;
  const valor = campo ? data[campo.key] : "";
  const puedeSeguir = campo ? !!valor && valor.trim().length >= 3 : true;

  function siguiente() {
    if (campo && !puedeSeguir) return;
    if (step < TOTAL - 1) setStep(step + 1);
    else guardar();
  }

  async function guardar() {
    if (!sector) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector, perfil: data, servicios }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "No se pudo guardar");
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------- PASO 0
  if (step === 0) {
    return (
      <div className="card-hard p-6 max-w-xl">
        <Progreso paso={0} total={TOTAL} />
        <h2 className="font-stencil text-3xl mb-2">¿Qué tipo de negocio tienes?</h2>
        <p className="text-sm text-black/60 mb-4">
          Es lo que más cambia. De esto dependen los agentes que verás, los números de tu panel y
          cómo hablan tus agentes con tus clientes.
        </p>
        <div className="space-y-2">
          {SECTORES_LISTA.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => elegirSector(p.id)}
              className="w-full text-left border-2 border-black p-3 hover:bg-[color:var(--mustard)]/30"
            >
              <div className="font-bold">{p.label}</div>
              <div className="text-sm text-black/60">{p.alta.paraQuien}</div>
            </button>
          ))}
        </div>
        <p className="text-xs text-black/50 mt-4">
          ¿No encaja ninguno del todo? Elige el más parecido: se puede cambiar después desde Perfil.
        </p>
      </div>
    );
  }

  // ------------------------------------------------------------ PASO FINAL
  if (step === TOTAL - 1) {
    return (
      <div className="card-hard p-6 max-w-xl">
        <Progreso paso={step} total={TOTAL} />
        <h2 className="font-stencil text-3xl mb-2">Tus {v.servicioPlural} para empezar</h2>
        <p className="text-sm text-black/60 mb-4">
          Los dejamos preparados según tu sector. Cambia lo que quieras, quita lo que no hagas y
          añade lo que falte. Después se edita cuando quieras.
        </p>
        <div className="space-y-2">
          {servicios.map((sv, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={sv.nombre}
                onChange={(e) => setServicios(servicios.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                className="flex-1 border-2 border-black px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                min={5}
                step={5}
                value={sv.durationMin}
                onChange={(e) => setServicios(servicios.map((x, j) => (j === i ? { ...x, durationMin: +e.target.value } : x)))}
                className="w-20 border-2 border-black px-2 py-1.5 text-sm"
                title="Minutos"
              />
              <span className="text-xs text-black/50">min</span>
              <button
                type="button"
                onClick={() => setServicios(servicios.filter((_, j) => j !== i))}
                className="border-2 border-black px-2 py-1 text-xs"
                aria-label="Quitar"
              >✕</button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setServicios([...servicios, { nombre: "", durationMin: perfil.alta.servicios[0]?.durationMin ?? 30 }])}
          className="text-xs font-mono border-2 border-black px-3 py-2 mt-3 hover:bg-black hover:text-white"
        >＋ Añadir {v.servicio}</button>

        {error && <p className="text-sm text-[color:var(--red)] mt-3">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          <Atras onClick={() => setStep(step - 1)} />
          <button type="button" onClick={guardar} disabled={loading} className="btn-mustard">
            {loading ? "GUARDANDO…" : "🚀 ACTIVAR MI EQUIPO"}
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------- PASOS DE CAMPO
  const ejemplos =
    campo!.key === "nombre" ? perfil.alta.ejemplos.nombre
    : campo!.key === "sector" ? perfil.alta.ejemplos.actividad
    : [];
  const marcador =
    campo!.key === "nombre" ? perfil.alta.ejemplos.nombre[0]
    : campo!.key === "sector" ? perfil.alta.ejemplos.actividad[0]
    : campo!.key === "ofrece" ? perfil.alta.ejemplos.ofrece
    : campo!.key === "publico" ? perfil.alta.ejemplos.publico
    : perfil.alta.ejemplos.tono;

  return (
    <div className="card-hard p-6 max-w-xl">
      <Progreso paso={step} total={TOTAL} />
      <div className="text-[11px] font-mono uppercase tracking-widest text-black/50 mb-1">{perfil.label}</div>
      <h2 className="font-stencil text-3xl mb-2">{campo!.title(v)}</h2>
      <p className="text-sm text-black/60 mb-4">{campo!.hint}</p>

      {campo!.type === "textarea" ? (
        <textarea
          value={valor}
          onChange={(e) => setData({ ...data, [campo!.key]: e.target.value })}
          placeholder={marcador}
          rows={4}
          className="w-full border-2 border-black px-3 py-2 focus:outline-none focus:bg-[color:var(--mustard)]/20"
          autoFocus
        />
      ) : (
        <input
          value={valor}
          onChange={(e) => setData({ ...data, [campo!.key]: e.target.value })}
          placeholder={marcador}
          className="w-full border-2 border-black px-3 py-2 focus:outline-none focus:bg-[color:var(--mustard)]/20"
          autoFocus
        />
      )}

      {ejemplos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {ejemplos.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setData({ ...data, [campo!.key]: ex })}
              className="text-[10px] font-mono border border-black/40 px-2 py-0.5 hover:bg-[color:var(--mustard)]"
            >Ej: {ex}</button>
          ))}
        </div>
      )}
      {campo!.type === "textarea" && (
        <button
          type="button"
          onClick={() => setData({ ...data, [campo!.key]: marcador })}
          className="text-[10px] font-mono border border-black/40 px-2 py-0.5 mt-2 hover:bg-[color:var(--mustard)]"
        >Usar el ejemplo</button>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Atras onClick={() => setStep(step - 1)} />
        <button type="button" onClick={siguiente} disabled={!puedeSeguir} className="btn-mustard">
          Siguiente →
        </button>
      </div>
    </div>
  );
}

function Progreso({ paso, total }: { paso: number; total: number }) {
  return (
    <>
      <div className="flex items-center gap-1 mb-4">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={`h-1.5 flex-1 ${i <= paso ? "bg-[color:var(--red)]" : "bg-black/15"}`} />
        ))}
      </div>
      <div className="flex items-center justify-between mb-4 text-xs font-mono">
        <span className="text-black/60">PASO {paso + 1} DE {total}</span>
        <span className="bg-black text-[color:var(--mustard)] px-2 py-0.5 font-bold tracking-widest">
          {Math.round(((paso + 1) / total) * 100)}%
        </span>
      </div>
    </>
  );
}

function Atras({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-mono uppercase tracking-widest border-2 border-black px-3 py-2 hover:bg-black hover:text-white"
    >← Atrás</button>
  );
}
