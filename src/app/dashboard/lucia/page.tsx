import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import AgentChat from "@/components/AgentChat";
import LuciaTools from "@/components/LuciaTools";
import LuciaCalendar from "@/components/LuciaCalendar";
import LuciaDashboard from "@/components/LuciaDashboard";
import LuciaBrief from "@/components/LuciaBrief";
import LuciaCompromisos from "@/components/LuciaCompromisos";
import LuciaMeetingBrief from "@/components/LuciaMeetingBrief";
import LuciaReportes from "@/components/LuciaReportes";
import { agentBySlug } from "@/lib/agents";

export default async function LuciaPage({ searchParams }: { searchParams: Promise<{ gmail?: string; gmail_error?: string }> }) {
  const s = await getSession();
  if (!s) redirect("/login");
  const user = await getUser(s.email);
  if (!user.business) redirect("/onboarding");
  const a = agentBySlug.lucia;
  const sp = await searchParams;

  return (
    <section>
      <div className="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap">
        <span className="px-2 py-1 font-bold tracking-widest border-2 border-black" style={{ background: a.color }}>
          {a.codename}
        </span>
        <span className="border-2 border-black px-2 py-1 font-bold tracking-widest">{a.role.toUpperCase()}</span>
        <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">★ GMAIL OAUTH BETA</span>
      </div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-stencil text-4xl md:text-5xl leading-none">{a.name}</h1>
          <p className="text-sm text-black/60 mt-1">{a.short}</p>
        </div>
        <p className="text-xs font-mono text-black/50 max-w-xs text-right">
          ✓ Lectura de Gmail activa. Borradores y respuestas: pronto.
        </p>
      </div>

      {!user.gmailTokens && (
        <div className="card-hard p-4 mb-4 bg-[color:var(--mustard)]/20 border-2 border-black flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <span className="text-2xl">📬</span>
          <div className="flex-1">
            <p className="font-bold text-sm">Conecta Gmail para desbloquear todo el potencial de Lucía</p>
            <p className="text-xs text-black/60 mt-0.5">Resumen diario de bandeja · Borradores automáticos · Archivar promos · Ver calendario</p>
          </div>
          <a href="/api/lucia/auth" className="btn-mustard text-xs whitespace-nowrap">CONECTAR GMAIL →</a>
        </div>
      )}

      <LuciaDashboard />

      <div className="mt-10 mb-4">
        <h2 className="font-stencil text-3xl">💬 Pregunta a Lucía</h2>
      </div>
      <AgentChat
        agent="lucia"
        initialMessages={user.chats.lucia}
        placeholder="Pídele algo a Lucía…"
        suggestions={[
          "Redacta un correo agradeciendo a un cliente nuevo",
          "Resúmeme la semana en 3 prioridades",
          "Ayúdame a redactar una respuesta a una queja",
        ]}
      />

      <LuciaTools initialFlash={{ ok: sp.gmail, error: sp.gmail_error }} />
      <LuciaCalendar />

      <div className="mt-10 mb-4">
        <h2 className="font-stencil text-3xl">📊 Inteligencia (Tanda 2)</h2>
        <p className="text-xs font-mono text-black/60 mt-1">Brief diario, compromisos, briefs de reunión y reportes ejecutivos.</p>
      </div>
      <LuciaBrief />
      <div className="mt-6" />
      <LuciaCompromisos />
      <div className="mt-6" />
      <LuciaMeetingBrief />
      <div className="mt-6" />
      <LuciaReportes />
    </section>
  );
}
