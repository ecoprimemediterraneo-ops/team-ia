import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SergioPanel from "@/components/admin/SergioPanel";
import { MOCK_COMPETITORS } from "@/lib/sergio";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export default async function SergioPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") {
    return <div className="p-8 text-center">🔒 Solo founder</div>;
  }

  const sectors = [...new Set(MOCK_COMPETITORS.map((c) => c.sector))].sort();
  const cities = [...new Set(MOCK_COMPETITORS.map((c) => c.city))].sort();

  return (
    <div className="min-h-screen bg-[color:var(--cream)] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <a href="/admin" className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white">← VOLVER</a>
          <div>
            <h1 className="font-stencil text-3xl">🕵️ Sergio · Inteligencia de mercado</h1>
            <p className="text-sm text-black/60 mt-1">Competidores monitorizados · Debilidades detectadas · Pitches generados con IA</p>
          </div>
        </div>

        <div className="p-4 mb-6 bg-black text-white text-sm font-mono border-2 border-[#00ff41]/40">
          <div className="text-[#00ff41] text-xs mb-2">▶ SERGIO · UNIDAD DE RECONOCIMIENTO · EXPEDIENTE M-RECON</div>
          <div className="flex gap-2 flex-wrap">
            <a href="/admin/sergio/fuentes" className="text-xs border border-[#00ff41]/50 text-[#00ff41] px-3 py-1.5 hover:bg-[#00ff41]/10">⚙ GESTIONAR FUENTES</a>
            <a href="/admin/sergio/cambios" className="text-xs border border-white/30 text-white px-3 py-1.5 hover:border-[#00ff41] hover:text-[#00ff41]">📋 VER CAMBIOS</a>
          </div>
          <div className="text-white/40 text-xs mt-2">Sprint 1 activo: scraping web con Firecrawl · Sprint 2: análisis Claude + alertas</div>
        </div>

        <SergioPanel sectors={sectors} cities={cities} />
      </div>
    </div>
  );
}
