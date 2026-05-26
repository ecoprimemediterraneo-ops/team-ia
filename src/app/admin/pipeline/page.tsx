import { redirect } from "next/navigation";
import { getSession, isFounder } from "@/lib/auth";
import { listLeads, pipelineStats } from "@/lib/pipeline";
import PipelineKanban from "@/components/admin/PipelineKanban";


export default async function PipelinePage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isFounder(s.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="card-hard p-8 max-w-md text-center">
          <h1 className="font-stencil text-3xl mb-2">🔒 Acceso restringido</h1>
          <p className="text-sm text-black/60">Esta zona es solo para el founder.</p>
        </div>
      </div>
    );
  }

  const leads = await listLeads(s.email);
  const stats = await pipelineStats();

  return (
    <div className="min-h-screen bg-[color:var(--cream)] p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-stencil text-4xl md:text-5xl mb-1 leading-none">Pipeline SDR</h1>
            <p className="text-sm text-black/60">Tu CRM de ventas. {leads.length} leads totales · {stats.byStage.client || 0} clientes</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href="/admin" className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white">← VOLVER ADMIN</a>
            <a href="/admin/pipeline/import" className="btn-mustard text-xs">📤 IMPORTAR CSV</a>
            <a href="/admin/pipeline/new" className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-[color:var(--mustard)]">+ AÑADIR LEAD</a>
          </div>
        </div>

        <PipelineKanban initialLeads={leads} />
      </div>
    </div>
  );
}
