import { redirect } from "next/navigation";
import { getSession, isFounder } from "@/lib/auth";
import { listSources, listChanges } from "@/lib/sergio-db";
import SergioFuentesPanel from "@/components/admin/SergioFuentesPanel";


export default async function SergioFuentesPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isFounder(s.email)) redirect("/admin");

  const sources = await listSources().catch(() => []);
  const changes = await listChanges({ acknowledged: false, limit: 20 }).catch(() => []);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header estilo terminal Sergio */}
        <div className="border border-[#00ff41]/30 p-4 mb-6 font-mono">
          <div className="text-[#00ff41] text-xs mb-1">▶ SERGIO · UNIDAD DE RECONOCIMIENTO · EXPEDIENTE M-RECON</div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-3xl font-bold tracking-widest text-white">GESTIÓN DE FUENTES</h1>
            <div className="flex gap-2">
              <a href="/admin/sergio" className="text-xs font-mono border border-white/30 px-3 py-2 hover:border-[#00ff41] hover:text-[#00ff41]">← PANEL PRINCIPAL</a>
              <a href="/admin/sergio/cambios" className="text-xs font-mono border border-[#00ff41]/50 px-3 py-2 text-[#00ff41] hover:bg-[#00ff41]/10">
                {changes.length > 0 && <span className="bg-red-500 text-white px-1 mr-1 text-[10px]">{changes.length}</span>}
                VER CAMBIOS
              </a>
            </div>
          </div>
          <div className="text-white/40 text-xs mt-2">
            {sources.length} fuentes configuradas · {sources.filter((s) => s.active).length} activas
          </div>
        </div>

        <SergioFuentesPanel sources={sources} pendingChanges={changes.length} />
      </div>
    </div>
  );
}
