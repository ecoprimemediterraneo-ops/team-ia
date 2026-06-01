import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import AgentChat from "@/components/AgentChat";
import RocioTools from "@/components/RocioTools";
import RocioTracker from "@/components/RocioTracker";
import { agentBySlug } from "@/lib/agents";

export default async function RocioPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  const user = await getUser(s.email);
  if (!user.business) redirect("/onboarding");
  const a = agentBySlug.rocio;

  return (
    <section>
      <div className="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap">
        <span className="border-2 border-black px-2 py-1 font-bold tracking-widest" style={{ background: a.color }}>
          {a.role.toUpperCase()}
        </span>
        <span className="bg-black/70 text-white px-2 py-1 font-bold tracking-widest">PRÓXIMAMENTE</span>
      </div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-stencil text-4xl md:text-5xl leading-none">{a.name}</h1>
          <p className="text-sm text-black/60 mt-1">{a.short}</p>
        </div>
        <p className="text-xs font-mono text-black/50 max-w-xs text-right">
          Rocío genera respuestas a reseñas con IA. Publicación automática en Google: próximamente.
        </p>
      </div>

      <AgentChat
        agent="rocio"
        initialMessages={user.chats.rocio}
        placeholder="Pídele a Rocío que pida o responda reseñas…"
        suggestions={[
          "Redacta un mensaje WhatsApp pidiendo reseña tras una cita",
          "Responde a esta reseña 5★: «Trato excelente, repetiré»",
          "Responde a esta reseña 1★: «Llegué a la hora y me hicieron esperar 30 min»",
        ]}
      />

      <RocioTools />
      <RocioTracker />
    </section>
  );
}
