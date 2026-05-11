import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listLeads, pipelineStats } from "@/lib/pipeline";
import CampaignLauncher from "@/components/admin/CampaignLauncher";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export default async function CampaignPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") {
    return <div className="p-8 text-center">🔒 Solo founder</div>;
  }

  const leads = await listLeads(s.email);
  const stats = await pipelineStats();
  const sectors = Array.from(new Set(leads.map((l) => l.sector))).sort();
  const cities = Array.from(new Set(leads.map((l) => l.city).filter(Boolean))).sort() as string[];

  return (
    <div className="min-h-screen bg-[color:var(--cream)] p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <a href="/admin/pipeline" className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white">← VOLVER</a>
          <h1 className="font-stencil text-3xl">Lanzar campaña outreach</h1>
        </div>

        <div className="card-hard p-4 mb-4 bg-[color:var(--mustard)]/20">
          <p className="text-sm">
            <b>Cómo funciona:</b> seleccionas template + filtras leads + previews + lanzas.
            Eva irá enviando los emails según los delays del template (cron cada 15 min).
            Cada email lleva variables del lead (nombre, ciudad, rating, etc).
          </p>
          <p className="text-xs text-black/60 mt-2">
            Total leads: {stats.total} · Con email: {leads.filter((l) => l.email).length} · Por sector: {Object.entries(stats.bySector).map(([k, v]) => `${k} (${v})`).join(", ")}
          </p>
        </div>

        <CampaignLauncher sectors={sectors} cities={cities} />
      </div>
    </div>
  );
}
