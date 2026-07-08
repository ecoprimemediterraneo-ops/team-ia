// Alta de salón (founder) con importador Booksy.
import { redirect } from "next/navigation";
import { requireFounder } from "@/lib/admin-auth";
import ImportadorBooksy from "@/components/booking/ImportadorBooksy";

export const dynamic = "force-dynamic";

export default async function NuevoSalonPage() {
  const a = await requireFounder();
  if (!a.ok) redirect("/login");

  return (
    <div className="min-h-screen bg-[color:var(--cream)] px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <a href="/admin/salones" className="text-xs font-mono underline text-black/50">← Salones</a>
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-black/40 mt-2">AI-Team Booking</div>
          <h1 className="font-stencil text-3xl sm:text-4xl leading-none mt-1">Nuevo salón</h1>
          <p className="text-sm text-black/60 mt-2">Importa desde Booksy o empieza en blanco. Revisa todo antes de crear.</p>
        </div>
        <ImportadorBooksy />
      </div>
    </div>
  );
}
