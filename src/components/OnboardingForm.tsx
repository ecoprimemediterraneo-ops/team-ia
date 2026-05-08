"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessProfile } from "@/lib/claude";

const fields: { key: keyof BusinessProfile; label: string; placeholder: string }[] = [
  { key: "nombre", label: "1. ¿Cómo se llama tu negocio?", placeholder: "Ej: Clínica Dental Sonrisa" },
  { key: "sector", label: "2. ¿A qué te dedicas?", placeholder: "Ej: Clínica dental en Valencia" },
  { key: "ofrece", label: "3. ¿Qué servicios o productos ofreces?", placeholder: "Ej: Limpiezas, ortodoncia invisible, blanqueamientos…" },
  { key: "publico", label: "4. ¿Quién es tu cliente ideal?", placeholder: "Ej: Adultos 30-55 años, profesionales, vecinos del barrio" },
  { key: "tono", label: "5. ¿Cómo quieres que te hablen tus agentes?", placeholder: "Ej: Cercano y con humor pero profesional. Tutear." },
];

export default function OnboardingForm({ initial }: { initial?: BusinessProfile }) {
  const router = useRouter();
  const [data, setData] = useState<BusinessProfile>(
    initial ?? { nombre: "", sector: "", ofrece: "", tono: "", publico: "" }
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    router.push("/dashboard");
  }

  return (
    <form onSubmit={onSubmit} className="card-hard p-6 flex flex-col gap-5">
      {fields.map((f) => (
        <label key={f.key} className="flex flex-col gap-1.5">
          <span className="font-bold text-sm">{f.label}</span>
          <input
            required
            value={data[f.key]}
            onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
            placeholder={f.placeholder}
            className="border-2 border-black px-3 py-2 focus:outline-none focus:bg-[color:var(--mustard)]/20"
          />
        </label>
      ))}
      <button disabled={loading} className="btn-mustard mt-2">
        {loading ? "GUARDANDO..." : "DAR DE ALTA A LA UNIDAD"}
      </button>
    </form>
  );
}
