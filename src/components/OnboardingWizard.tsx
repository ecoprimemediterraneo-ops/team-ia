"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessProfile } from "@/lib/claude";

const STEPS: {
  key: keyof BusinessProfile;
  title: string;
  hint: string;
  placeholder: string;
  examples?: string[];
  type?: "input" | "textarea";
}[] = [
  {
    key: "nombre",
    title: "¿Cómo se llama tu negocio?",
    hint: "Como aparece en Google. Sin tecnicismos legales.",
    placeholder: "Clínica Dental Sonrisa",
    examples: ["Clínica Dental Sonrisa", "Salón Marina", "Restaurante La Cala"],
  },
  {
    key: "sector",
    title: "¿A qué te dedicas exactamente?",
    hint: "Sé específico. Si pones &quot;dental&quot;, &quot;peluquería&quot; o &quot;restaurante&quot; tus agentes activan skills específicas.",
    placeholder: "Clínica dental en el centro de la ciudad",
    examples: ["Clínica dental en Madrid centro", "Peluquería y estética en Barcelona", "Restaurante mediterráneo en Valencia"],
  },
  {
    key: "ofrece",
    title: "¿Qué servicios o productos ofreces?",
    hint: "Lista TODOS los servicios. Cuanto más concreto, mejor responden tus agentes a preguntas de clientes.",
    placeholder: "Limpiezas dentales, ortodoncia invisible (Invisalign), blanqueamientos, implantes, urgencias 24/7…",
    type: "textarea",
  },
  {
    key: "publico",
    title: "¿Quién es tu cliente ideal?",
    hint: "Edad, perfil, ubicación, poder adquisitivo. Esto ayuda al sistema a publicar contenido relevante.",
    placeholder: "Familias del barrio (30-55 años), expats británicos, jubilados con seguro privado",
    type: "textarea",
  },
  {
    key: "tono",
    title: "¿Cómo quieres que hablen tus agentes?",
    hint: "Da ejemplos del tono que usas TÚ con clientes. Cuanto más específico, más se parecerán a ti.",
    placeholder: "Cercano y familiar pero profesional. Tutear siempre. Sin tecnicismos. Con sentido del humor sutil. Si hay queja, validar antes de defenderse.",
    type: "textarea",
  },
];

export default function OnboardingWizard({ initial }: { initial?: BusinessProfile }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<BusinessProfile>(
    initial ?? { nombre: "", sector: "", ofrece: "", tono: "", publico: "" }
  );
  const [loading, setLoading] = useState(false);

  const current = STEPS[step];
  const value = data[current.key];
  const canNext = value && value.trim().length >= 3;
  const isLast = step === STEPS.length - 1;

  function next() {
    if (!canNext) return;
    if (!isLast) setStep(step + 1);
    else submit();
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  async function submit() {
    setLoading(true);
    await fetch("/api/perfil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    router.push("/dashboard");
  }

  return (
    <div className="card-hard p-6 max-w-xl">
      {/* Progress */}
      <div className="flex items-center gap-1 mb-4">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 ${i <= step ? "bg-[color:var(--red)]" : "bg-black/15"}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mb-4 text-xs font-mono">
        <span className="text-black/60">PASO {step + 1} DE {STEPS.length}</span>
        <span className="bg-black text-[color:var(--mustard)] px-2 py-0.5 font-bold tracking-widest">{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
      </div>

      <h2 className="font-stencil text-3xl mb-2">{current.title}</h2>
      <p className="text-sm text-black/60 mb-4" dangerouslySetInnerHTML={{ __html: current.hint }} />

      {current.type === "textarea" ? (
        <textarea
          required
          value={value}
          onChange={(e) => setData({ ...data, [current.key]: e.target.value })}
          placeholder={current.placeholder}
          rows={4}
          className="w-full border-2 border-black px-3 py-2 focus:outline-none focus:bg-[color:var(--mustard)]/20"
          autoFocus
        />
      ) : (
        <input
          required
          value={value}
          onChange={(e) => setData({ ...data, [current.key]: e.target.value })}
          placeholder={current.placeholder}
          className="w-full border-2 border-black px-3 py-2 focus:outline-none focus:bg-[color:var(--mustard)]/20"
          autoFocus
        />
      )}

      {current.examples && (
        <div className="mt-2 flex flex-wrap gap-1">
          {current.examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setData({ ...data, [current.key]: ex })}
              className="text-[10px] font-mono border border-black/40 px-2 py-0.5 hover:bg-[color:var(--mustard)]"
            >Ej: {ex}</button>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          className="text-xs font-mono uppercase tracking-widest border-2 border-black px-3 py-2 hover:bg-black hover:text-white disabled:opacity-30"
        >← Atrás</button>
        <button
          type="button"
          onClick={next}
          disabled={!canNext || loading}
          className="btn-mustard"
        >
          {loading ? "GUARDANDO…" : isLast ? "🚀 ACTIVAR MI UNIDAD" : "Siguiente →"}
        </button>
      </div>
    </div>
  );
}
