import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import AgentChat from "@/components/AgentChat";
import LuciaTools from "@/components/LuciaTools";
import LuciaCalendar from "@/components/LuciaCalendar";
import LuciaBooking from "@/components/LuciaBooking";
import { agentBySlug } from "@/lib/agents";

export default async function LuciaPage({ searchParams }: { searchParams: Promise<{ gmail?: string; gmail_error?: string }> }) {
  const s = await getSession();
  if (!s) redirect("/login");
  const user = await getUser(s.email);
  if (!user.business) redirect("/onboarding");
  const a = agentBySlug.lucia;
  const sp = await searchParams;

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
          <span className="border-2 border-black px-2 py-0.5 font-bold tracking-widest" style={{ background: a.color }}>
            {a.role.toUpperCase()}
          </span>
          <span className="bg-green-700 text-white px-2 py-0.5 font-bold tracking-widest">LIVE</span>
          <span className="ml-auto text-[11px] font-mono hidden md:inline truncate max-w-[55%]">
            {user.gmailTokens
              ? <span className="text-green-700">✓ Gmail conectado · {s.email}</span>
              : <span className="text-black/55">Lucía aún no tiene acceso a tu Gmail</span>}
          </span>
        </div>
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div className="min-w-0">
            <h1 className="font-stencil text-3xl md:text-4xl leading-none">{a.name}</h1>
            <p className="text-sm text-black/60 mt-0.5">{a.short}</p>
          </div>
          <p className="text-[11px] font-mono md:hidden">
            {user.gmailTokens
              ? <span className="text-green-700">✓ Gmail conectado</span>
              : <span className="text-black/55">Lucía aún no tiene acceso a tu Gmail</span>}
          </p>
        </div>
      </header>

      {!user.gmailTokens && (
        <div className="card-hard p-4 bg-[color:var(--mustard)]/30 border-[3px] border-black">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span className="text-3xl shrink-0">📬</span>
            <div className="flex-1 min-w-0">
              <p className="font-stencil text-xl mb-0.5">Conecta tu Gmail</p>
              <p className="text-sm text-black/70 leading-snug">
                Desbloquea resumen diario, borradores automáticos, archivar promos y leer tu calendario.
              </p>
              <p className="text-[11px] text-black/50 mt-1 font-mono">
                OAuth oficial de Google · Nadie de AI-Team lee tus correos.
              </p>
            </div>
            <a href="/api/lucia/auth" className="btn-mustard text-sm px-4 py-2 whitespace-nowrap shrink-0">
              🔗 Conectar mi Gmail →
            </a>
          </div>
        </div>
      )}

      {user.gmailTokens && (
        <div className="card-hard p-3 bg-green-50 border-2 border-green-700 flex items-center gap-2 text-sm">
          <span className="text-lg">✅</span>
          <p className="flex-1 min-w-0">
            <strong>Gmail conectado</strong> a <span className="font-mono break-all">{s.email}</span>. Ya puede leer tu bandeja y crear borradores.
          </p>
          <a href="/api/lucia/auth" className="text-xs font-bold underline whitespace-nowrap shrink-0">
            Reconectar
          </a>
        </div>
      )}

      {/* Reserva de cita (agenda central Google Calendar) */}
      <LuciaBooking connected={!!user.gmailTokens} />

      {/* Calendar + Chat: pareja corta y equilibrada */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <LuciaCalendar />
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
      </div>

      {/* Bandeja Gmail a ancho completo — bloque largo, sin partir */}
      <LuciaTools initialFlash={{ ok: sp.gmail, error: sp.gmail_error }} />
    </section>
  );
}
