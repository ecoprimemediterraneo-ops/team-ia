import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import NewLeadForm from "@/components/admin/NewLeadForm";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export default async function NewLeadPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") {
    return <div className="p-8 text-center">🔒 Solo founder</div>;
  }

  return (
    <div className="min-h-screen bg-[color:var(--cream)] p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <a href="/admin/pipeline" className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white">← VOLVER</a>
          <h1 className="font-stencil text-3xl">Nuevo lead</h1>
        </div>
        <NewLeadForm />
      </div>
    </div>
  );
}
