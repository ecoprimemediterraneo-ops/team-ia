import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listLeads } from "@/lib/pipeline";
import { kvGet } from "@/lib/supabase";
import type { SequenceEnrollment } from "@/app/api/eva/sequences/route";
import type { LeadActivity } from "@/lib/pipeline-constants";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

function statCard(label: string, value: string | number, sub?: string, accent = false) {
  return (
    <div className={`card-hard p-5 ${accent ? "bg-[color:var(--mustard)]" : "bg-white"}`}>
      <div className="text-xs uppercase font-mono text-black/60 mb-1">{label}</div>
      <div className="font-stencil text-5xl">{value}</div>
      {sub && <div className="text-xs text-black/50 mt-1">{sub}</div>}
    </div>
  );
}

export default async function MetricasPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") redirect("/admin");

  const leads = await listLeads();
  const enrollments: SequenceEnrollment[] = (await kvGet("seq_enrollments")) ?? [];

  // Aggregate activities
  const allActivities: (LeadActivity & { leadId: string })[] = leads.flatMap((l) =>
    l.activities.map((a) => ({ ...a, leadId: l.id }))
  );

  const emailsSent = allActivities.filter((a) => a.type === "email_sent").length;
  const emailsOpened = allActivities.filter((a) => a.type === "email_opened").length;
  const whatsappSent = allActivities.filter((a) => a.type === "whatsapp_sent").length;
  const calls = allActivities.filter((a) => a.type === "call").length;
  const demos = allActivities.filter((a) => a.type === "demo").length;

  const clients = leads.filter((l) => l.stage === "client").length;
  const demoBooked = leads.filter((l) => l.stage === "demo_booked" || l.stage === "demo_done").length;
  const qualified = leads.filter((l) => l.stage === "qualified").length;
  const contacted = leads.filter((l) => ["contacted", "engaged", "qualified", "demo_booked", "demo_done", "trial", "client"].includes(l.stage)).length;

  const convRate = leads.length > 0 ? ((clients / leads.length) * 100).toFixed(1) : "0";
  const openRate = emailsSent > 0 ? ((emailsOpened / emailsSent) * 100).toFixed(1) : "0";

  // Sequences stats
  const activeSeqs = enrollments.filter((e) => !e.done && !e.unsubscribed).length;
  const completedSeqs = enrollments.filter((e) => e.done).length;
  const unsubscribed = enrollments.filter((e) => e.unsubscribed).length;

  // By sector
  const bySector = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.sector] = (acc[l.sector] ?? 0) + 1;
    return acc;
  }, {});

  // By stage
  const byStage = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.stage] = (acc[l.stage] ?? 0) + 1;
    return acc;
  }, {});

  // Recent activity (last 7 days)
  const cutoff7 = Date.now() - 7 * 86400000;
  const recent = allActivities.filter((a) => new Date(a.ts).getTime() > cutoff7);

  return (
    <div className="min-h-screen bg-[color:var(--cream)] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-stencil text-5xl mb-1">Métricas SDR</h1>
            <p className="text-sm text-black/60">Rendimiento de los agentes en ventas y outreach</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href="/admin" className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white">← Admin</a>
            <a href="/admin/pipeline" className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white">🎯 Pipeline</a>
          </div>
        </div>

        {/* Pipeline top metrics */}
        <h2 className="font-stencil text-2xl mb-3 mt-2">📊 Pipeline general</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {statCard("Total leads", leads.length)}
          {statCard("Contactados", contacted)}
          {statCard("Cualificados", qualified)}
          {statCard("Demos", demoBooked)}
          {statCard("Clientes", clients, undefined, true)}
          {statCard("Conversión", `${convRate}%`)}
        </div>

        {/* Agent metrics */}
        <h2 className="font-stencil text-2xl mb-3">🤖 Actividad por agente</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* Eva */}
          <div className="card-hard p-5 border-l-4 border-[#7c3aed]">
            <div className="font-stencil text-2xl mb-1">EVA · Email mkt</div>
            <div className="space-y-2 text-sm mt-3">
              <div className="flex justify-between"><span className="text-black/60">Emails enviados</span><strong>{emailsSent}</strong></div>
              <div className="flex justify-between"><span className="text-black/60">Emails abiertos</span><strong>{emailsOpened} ({openRate}%)</strong></div>
              <div className="flex justify-between"><span className="text-black/60">Secuencias activas</span><strong>{activeSeqs}</strong></div>
              <div className="flex justify-between"><span className="text-black/60">Secuencias completadas</span><strong>{completedSeqs}</strong></div>
              <div className="flex justify-between"><span className="text-black/60">Bajas</span><strong>{unsubscribed}</strong></div>
            </div>
          </div>

          {/* Pablo */}
          <div className="card-hard p-5 border-l-4 border-[#16a34a]">
            <div className="font-stencil text-2xl mb-1">PABLO · WhatsApp</div>
            <div className="space-y-2 text-sm mt-3">
              <div className="flex justify-between"><span className="text-black/60">WA enviados</span><strong>{whatsappSent}</strong></div>
              <div className="flex justify-between"><span className="text-black/60">Leads BANT cualificados</span><strong>{qualified}</strong></div>
              <div className="flex justify-between"><span className="text-black/60">Demos generadas</span><strong>{demoBooked}</strong></div>
            </div>
            <div className="mt-3 text-xs text-black/40 font-mono">Integración real: pendiente WhatsApp Business</div>
          </div>

          {/* Carmen */}
          <div className="card-hard p-5 border-l-4 border-[#dc2626]">
            <div className="font-stencil text-2xl mb-1">CARMEN · Llamadas</div>
            <div className="space-y-2 text-sm mt-3">
              <div className="flex justify-between"><span className="text-black/60">Llamadas realizadas</span><strong>{calls}</strong></div>
              <div className="flex justify-between"><span className="text-black/60">Demos generadas</span><strong>{demos}</strong></div>
            </div>
            <div className="mt-3 text-xs text-black/40 font-mono">Integración real: pendiente Vapi</div>
          </div>

          {/* Marta */}
          <div className="card-hard p-5 border-l-4 border-[#ea580c]">
            <div className="font-stencil text-2xl mb-1">MARTA · Redes</div>
            <div className="space-y-2 text-sm mt-3">
              <div className="flex justify-between"><span className="text-black/60">Posts publicados</span><strong>—</strong></div>
              <div className="flex justify-between"><span className="text-black/60">DMs cold enviados</span><strong>—</strong></div>
            </div>
            <div className="mt-3 text-xs text-black/40 font-mono">Integración real: pendiente Ayrshare</div>
          </div>

          {/* Rocío */}
          <div className="card-hard p-5 border-l-4 border-[#0891b2]">
            <div className="font-stencil text-2xl mb-1">ROCÍO · Reseñas</div>
            <div className="space-y-2 text-sm mt-3">
              <div className="flex justify-between"><span className="text-black/60">Clientes activos</span><strong>{clients}</strong></div>
              <div className="flex justify-between"><span className="text-black/60">Casos de estudio generados</span><strong>3</strong></div>
            </div>
          </div>

          {/* Lucía */}
          <div className="card-hard p-5 border-l-4 border-[#d97706]">
            <div className="font-stencil text-2xl mb-1">LUCÍA · Onboarding</div>
            <div className="space-y-2 text-sm mt-3">
              <div className="flex justify-between"><span className="text-black/60">Clientes en trial</span><strong>{leads.filter((l) => l.stage === "trial").length}</strong></div>
              <div className="flex justify-between"><span className="text-black/60">Clientes activos</span><strong>{clients}</strong></div>
            </div>
          </div>
        </div>

        {/* Leads por sector */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="card-hard p-5">
            <h3 className="font-stencil text-xl mb-3">📂 Leads por sector</h3>
            {Object.entries(bySector).length === 0 ? (
              <p className="text-sm text-black/50 italic">Sin leads aún</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(bySector).sort((a, b) => b[1] - a[1]).map(([sector, count]) => (
                  <div key={sector} className="flex items-center gap-2">
                    <div className="flex-1 bg-black/10 rounded-full h-2 overflow-hidden">
                      <div className="bg-[color:var(--olive)] h-2" style={{ width: `${Math.min(100, (count / leads.length) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-mono w-32 truncate">{sector}</span>
                    <span className="text-sm font-bold w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card-hard p-5">
            <h3 className="font-stencil text-xl mb-3">🔄 Leads por etapa</h3>
            {Object.entries(byStage).length === 0 ? (
              <p className="text-sm text-black/50 italic">Sin leads aún</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(byStage).sort((a, b) => b[1] - a[1]).map(([stage, count]) => (
                  <div key={stage} className="flex items-center gap-2">
                    <div className="flex-1 bg-black/10 rounded-full h-2 overflow-hidden">
                      <div className="bg-[color:var(--mustard)] h-2" style={{ width: `${Math.min(100, (count / leads.length) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-mono w-36 truncate">{stage}</span>
                    <span className="text-sm font-bold w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actividad reciente 7 días */}
        <div className="card-hard p-5">
          <h3 className="font-stencil text-xl mb-3">⚡ Actividad últimos 7 días ({recent.length} eventos)</h3>
          {recent.length === 0 ? (
            <p className="text-sm text-black/50 italic">Sin actividad reciente</p>
          ) : (
            <ul className="space-y-1 text-xs font-mono max-h-64 overflow-y-auto">
              {[...recent].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 50).map((a, i) => (
                <li key={i} className="flex gap-3 border-b border-black/5 pb-1">
                  <span className="text-black/40 shrink-0">{new Date(a.ts).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="text-black/60">{a.type}</span>
                  <span className="truncate text-black/40">{a.leadId}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
