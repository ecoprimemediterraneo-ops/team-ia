import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import PerfilEditor from "@/components/PerfilEditor";

export default async function PerfilPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  const user = await getUser(s.email);
  if (!user.business) redirect("/onboarding");

  return (
    <section>
      <div className="flex items-center gap-3 mb-3 text-xs font-mono">
        <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">PERFIL DEL NEGOCIO</span>
        <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">EDITABLE</span>
      </div>
      <h1 className="font-stencil text-4xl md:text-5xl mb-2 leading-none">Perfil del negocio</h1>
      <p className="text-sm text-black/60 mb-6">
        Esta información la usan TODOS tus agentes. Cuanto más concreta, mejor responderán.
      </p>

      <PerfilEditor initial={user.business!} />
    </section>
  );
}
