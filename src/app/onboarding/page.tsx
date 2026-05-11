import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import OnboardingWizard from "@/components/OnboardingWizard";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await getUser(session.email);
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10 bg-[color:var(--cream)]">
      <div className="max-w-xl w-full">
        <div className="flex items-center gap-3 mb-6 text-xs font-mono">
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">BRIEFING INICIAL</span>
          <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">5 PREGUNTAS · 2 MIN</span>
        </div>
        <h1 className="font-stencil text-4xl md:text-5xl mb-2 leading-[1]">Cuéntale a tu unidad cómo es tu negocio</h1>
        <p className="text-black/70 mb-8">Cuanto mejor te entiendan, mejor trabajan.</p>
        <OnboardingWizard initial={user.business} />
      </div>
    </main>
  );
}
