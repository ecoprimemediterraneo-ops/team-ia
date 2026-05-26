import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listAllApprovals } from "@/lib/approvals";
import ApprovalsBoard from "@/components/ApprovalsBoard";

export const dynamic = "force-dynamic";

export default async function AprobacionesPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  const items = await listAllApprovals(s.email);
  return (
    <section>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-stencil text-4xl md:text-5xl leading-none">📋 Aprobaciones pendientes</h1>
          <p className="text-sm text-black/60 mt-1">Todo lo que tus agentes te piden aprobar, en una sola pantalla.</p>
        </div>
        <div className="card-hard p-3 bg-[color:var(--mustard)] text-center">
          <div className="font-stencil text-3xl">{items.length}</div>
          <div className="text-[10px] font-mono uppercase">Pendientes</div>
        </div>
      </div>
      <ApprovalsBoard initialItems={items} />
    </section>
  );
}
