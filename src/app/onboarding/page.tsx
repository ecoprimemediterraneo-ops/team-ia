import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser, saveBusiness } from "@/lib/store";

async function saveAction(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/login");
  const business = {
    nombre: String(formData.get("nombre") || "").trim(),
    sector: String(formData.get("sector") || "").trim(),
    ofrece: String(formData.get("ofrece") || "").trim(),
    publico: String(formData.get("publico") || "").trim(),
    tono: String(formData.get("tono") || "").trim(),
  };
  if (Object.values(business).some((v) => !v)) return;
  await saveBusiness(session.email, business);
  redirect("/dashboard");
}

const fields = [
  { key: "nombre", label: "1. ¿Cómo se llama tu negocio?", placeholder: "Ej: Clínica Dental Sonrisa" },
  { key: "sector", label: "2. ¿A qué te dedicas?", placeholder: "Ej: Clínica dental en Valencia" },
  { key: "ofrece", label: "3. ¿Qué servicios o productos ofreces?", placeholder: "Ej: Limpiezas, ortodoncia invisible…" },
  { key: "publico", label: "4. ¿Quién es tu cliente ideal?", placeholder: "Ej: Adultos 30-55, profesionales del barrio" },
  { key: "tono", label: "5. ¿Cómo quieres que te hablen tus agentes?", placeholder: "Ej: Cercano y con humor pero profesional. Tutear." },
];

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await getUser(session.email);
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10 bg-[color:var(--cream)]">
      <div className="max-w-xl w-full">
        <div className="flex items-center gap-3 mb-6 text-xs font-mono">
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">BRIEFING INICIAL</span>
        </div>
        <h1 className="font-stencil text-4xl md:text-5xl mb-2 leading-[1]">Cuéntale a tu unidad cómo es tu negocio</h1>
        <p className="text-black/70 mb-8">Cuanto mejor te entiendan, mejor trabajan. 5 preguntas, 2 minutos.</p>
        <form action={saveAction} className="card-hard p-6 flex flex-col gap-5">
          {fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1.5">
              <span className="font-bold text-sm">{f.label}</span>
              <input
                required
                name={f.key}
                defaultValue={user.business?.[f.key as keyof typeof user.business] ?? ""}
                placeholder={f.placeholder}
                className="border-2 border-black px-3 py-2 focus:outline-none focus:bg-[color:var(--mustard)]/20"
              />
            </label>
          ))}
          <button type="submit" className="btn-mustard mt-2">DAR DE ALTA A LA UNIDAD</button>
        </form>
      </div>
    </main>
  );
}
