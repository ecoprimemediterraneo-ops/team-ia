import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import AgentChat from "@/components/AgentChat";
import LuciaTools from "@/components/LuciaTools";
import LuciaCalendar from "@/components/LuciaCalendar";
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
        <span className="border-2 border-black px-2 py-1 font-bold tracking-widest" style={{ background: a.color }}>
          {a.role.toUpperCase()}
        </span>
        <span className="bg-green-700 text-white px-2 py-1 font-bold tracking-widest">LIVE</span>
      </div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-stencil text-4xl md:text-5xl leading-none">{a.name}</h1>
          <p className="text-sm text-black/60 mt-1">{a.short}</p>
        </div>
        {user.gmailTokens ? (
          <p className="text-xs font-mono text-green-700 max-w-xs text-right">
            ✓ Gmail conectado a {s.email}
          </p>
        ) : (
          <p className="text-xs font-mono text-black/50 max-w-xs text-right">
            Lucía aún no tiene acceso a tu Gmail.
          </p>
        )}
      </div>

      {!user.gmailTokens && (
        <div className="card-hard p-5 mb-5 bg-[color:var(--mustard)]/30 border-[3px] border-black">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <span className="text-4xl shrink-0">📬</span>
            <div className="flex-1">
              <p className="font-stencil text-2xl mb-1">Conecta tu Gmail</p>
              <p className="text-sm text-black/70">
                Desbloquea todo lo que Lucía puede hacer: resumen diario de bandeja, borradores automáticos, archivar promos y leer tu calendario.
              </p>
              <p className="text-[11px] text-black/50 mt-2 font-mono">
                Usamos OAuth oficial de Google · Nadie de AI-Team lee tus correos.
              </p>
            </div>
            <a
              href="/api/lucia/auth"
              className="btn-mustard text-sm px-5 py-3 whitespace-nowrap shrink-0"
            >
              🔗 Conectar mi Gmail →
            </a>
          </div>
        </div>
      )}

      {user.gmailTokens && (
        <div className="card-hard p-3 mb-5 bg-green-50 border-2 border-green-700 flex items-center gap-3 text-sm">
          <span className="text-xl">✅</span>
          <p className="flex-1">
            <strong>Gmail conectado</strong> a <span className="font-mono">{s.email}</span>.
            Lucía ya puede leer tu bandeja y crear borradores.
          </p>
          <a
            href="/api/lucia/auth"
            className="text-xs font-bold underline whitespace-nowrap"
          >
            Reconectar
          </a>
        </div>
      )}

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
    </section>
  );
}
