import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import AgentChat from "@/components/AgentChat";
import MartaTools from "@/components/MartaTools";
import MartaEditorialCalendar from "@/components/MartaEditorialCalendar";
import MartaIgDashboard from "@/components/MartaIgDashboard";
import MartaEditor from "@/components/MartaEditor";
import MartaPendingQueue from "@/components/MartaPendingQueue";
import MartaSuggestions from "@/components/MartaSuggestions";
import MartaReelsStudio from "@/components/MartaReelsStudio";
import MartaCarruselesStudio from "@/components/MartaCarruselesStudio";
import MartaInbox from "@/components/MartaInbox";
import MartaAnalytics from "@/components/MartaAnalytics";
import MartaVirales from "@/components/MartaVirales";
import MartaAbTest from "@/components/MartaAbTest";
import MartaRepurposeStudio from "@/components/MartaRepurposeStudio";
import MartaHoraOptima from "@/components/MartaHoraOptima";
import MartaTemplatesEventos from "@/components/MartaTemplatesEventos";
import MartaTranslate from "@/components/MartaTranslate";
import MartaVoice from "@/components/MartaVoice";
import MartaColaboraciones from "@/components/MartaColaboraciones";
import MartaReportes from "@/components/MartaReportes";
import MartaShopping from "@/components/MartaShopping";
import MartaSection from "@/components/MartaSection";
import MartaHero from "@/components/MartaHero";
import { agentBySlug } from "@/lib/agents";

export default async function MartaPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  const user = await getUser(s.email);
  if (!user.business) redirect("/onboarding");
  const a = agentBySlug.marta;

  return (
    <section>
      {/* Cabecera identificación */}
      <div className="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap">
        <span className="px-2 py-1 font-bold tracking-widest border-2 border-black" style={{ background: a.color }}>
          {a.codename}
        </span>
        <span className="border-2 border-black px-2 py-1 font-bold tracking-widest">{a.role.toUpperCase()}</span>
      </div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-stencil text-4xl md:text-5xl leading-none">{a.name}</h1>
          <p className="text-sm text-black/60 mt-1">{a.short}</p>
        </div>
      </div>

      {/* HERO · Acceso rápido */}
      <MartaHero />

      {/* CHAT siempre visible */}
      <div className="mt-6">
        <AgentChat
          agent="marta"
          initialMessages={user.chats.marta}
          placeholder="Pídele a Marta posts, carruseles, guiones de reel…"
          suggestions={[
            "3 ideas de posts para esta semana",
            "Carrusel sobre por qué elegirnos a nosotros",
            "Guion de reel de 30 segundos sobre un consejo útil",
          ]}
        />
      </div>

      {/* SUGERENCIAS personalizadas siempre visibles */}
      <div className="mt-4">
        <MartaSuggestions />
      </div>

      {/* === GRUPOS COLAPSABLES === */}

      {/* 1. CREAR */}
      <div id="sec-crear">
        <MartaSection
          emoji="✍️"
          title="Crear contenido"
          subtitle="Posts, reels, carruseles, calendario editorial y templates por eventos"
          defaultOpen
        >
          <MartaEditor />
          <MartaReelsStudio />
          <MartaCarruselesStudio />
          <MartaTools />
          <MartaEditorialCalendar />
          <MartaTemplatesEventos />
        </MartaSection>
      </div>

      {/* 2. COMUNICACIÓN */}
      <div id="sec-comunicacion">
        <MartaSection
          emoji="📥"
          title="Comunicación entrante"
          subtitle="DMs, comentarios, menciones y aprobaciones pendientes"
        >
          <MartaInbox />
          <MartaPendingQueue />
          <MartaIgDashboard />
        </MartaSection>
      </div>

      {/* 3. INTELIGENCIA */}
      <div id="sec-inteligencia">
        <MartaSection
          emoji="📊"
          title="Inteligencia y aprendizaje"
          subtitle="Métricas, hora óptima, oportunidades virales, A/B de hooks y reportes ejecutivos"
        >
          <MartaAnalytics />
          <MartaHoraOptima />
          <MartaVirales />
          <MartaAbTest />
          <MartaReportes />
        </MartaSection>
      </div>

      {/* 4. CRECIMIENTO (avanzado) */}
      <div id="sec-crecimiento">
        <MartaSection
          emoji="🚀"
          title="Crecimiento avanzado"
          subtitle="Repurposing 1→5, captions multilingües, voz IA, colaboraciones y catálogo Shopping"
        >
          <MartaRepurposeStudio />
          <MartaTranslate />
          <MartaVoice />
          <MartaColaboraciones />
          <MartaShopping />
        </MartaSection>
      </div>
    </section>
  );
}
