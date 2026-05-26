import { redirect } from "next/navigation";
import { getSession, isFounder } from "@/lib/auth";
import { listChanges, acknowledgeChange } from "@/lib/sergio-db";
import SergioCambiosPanel from "@/components/admin/SergioCambiosPanel";


export default async function SergioCambiosPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isFounder(s.email)) redirect("/admin");

  const changes = await listChanges({ limit: 50 }).catch(() => []);
  const pending = changes.filter((c) => !c.acknowledged).length;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="border border-[#00ff41]/30 p-4 mb-6 font-mono">
          <div className="text-[#00ff41] text-xs mb-1">▶ SERGIO · CAMBIOS DETECTADOS</div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-3xl font-bold tracking-widest text-white">INTELIGENCIA · CAMBIOS</h1>
            <div className="flex gap-2">
              <a href="/admin/sergio/fuentes" className="text-xs font-mono border border-white/30 px-3 py-2 hover:border-[#00ff41] hover:text-[#00ff41]">⚙ FUENTES</a>
              <a href="/admin/sergio" className="text-xs font-mono border border-white/30 px-3 py-2 hover:border-[#00ff41] hover:text-[#00ff41]">← PANEL</a>
            </div>
          </div>
          <div className="text-white/40 text-xs mt-2">
            {pending} cambios sin revisar · {changes.length} total
          </div>
        </div>

        <SergioCambiosPanel changes={changes} />
      </div>
    </div>
  );
}
