import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { agents, type AgentSlug } from "@/lib/agents";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Las funciones del sistema",
  description: "WhatsApp, llamadas, reseñas de Google, correo y agenda, email marketing, Instagram e inteligencia competitiva. Un único sistema operativo para tu negocio, no herramientas sueltas.",
  alternates: { canonical: "https://aiteam.marketing/agentes" },
};

// Reorientación: de personajes con nombre a FUNCIONES del sistema.
// Mapeo slug → función (mismo slug, misma ruta /agentes/[slug]).
const FUNCTIONS: Record<AgentSlug, { fn: string; emoji: string; short: string }> = {
  pablo: {
    fn: "WhatsApp",
    emoji: "💬",
    short: "El sistema gestiona tu WhatsApp Business: responde consultas, agenda citas y captura leads las 24 horas.",
  },
  carmen: {
    fn: "Llamadas",
    emoji: "📞",
    short: "El sistema atiende llamadas entrantes en español, agenda citas y registra los recados con precisión.",
  },
  rocio: {
    fn: "Reseñas de Google",
    emoji: "⭐",
    short: "El sistema pide reseñas tras cada visita y responde las nuevas con el tono de tu negocio.",
  },
  lucia: {
    fn: "Correo y agenda",
    emoji: "📬",
    short: "El sistema procesa la bandeja de entrada, prioriza correos y deja borradores listos con tu estilo.",
  },
  eva: {
    fn: "Email marketing",
    emoji: "✉️",
    short: "El sistema ejecuta secuencias, newsletters y campañas automáticas desde tu propio dominio.",
  },
  marta: {
    fn: "Instagram y redes",
    emoji: "📱",
    short: "El sistema genera y publica contenido para Instagram y redes con el tono y la estrategia de tu negocio.",
  },
  sergio: {
    fn: "Inteligencia competitiva",
    emoji: "🕵️",
    short: "El sistema vigila a tus competidores 24/7 y avisa de cambios de precio, ofertas o posicionamiento.",
  },
};

export default function AgentesPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-16">
        <div className="max-w-6xl mx-auto px-5">
          <div className="mb-12">
            <span className="inline-block bg-black text-[color:var(--mustard)] px-3 py-1 text-xs font-mono font-bold tracking-widest mb-4">
              UN SOLO SISTEMA
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4">Las funciones del sistema</h1>
            <p className="text-lg text-black/70 max-w-2xl">
              No son empleados sueltos ni herramientas que conectas a mano. Es un único sistema operativo para tu negocio. Estas son las funciones que cubre.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {agents.map((a) => {
              const f = FUNCTIONS[a.slug];
              return (
                <Link key={a.slug} href={`/agentes/${a.slug}`} className="card-hard p-5 bg-white hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex flex-col">
                  <div className="relative aspect-square border-2 border-black mb-4 overflow-hidden flex items-center justify-center" style={{ backgroundColor: a.color + "20" }}>
                    <span className="text-7xl" aria-hidden="true">{f.emoji}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="font-stencil text-2xl">{f.fn}</h2>
                  </div>
                  <div className="text-xs font-mono uppercase tracking-widest text-black/60 mb-3">Función del sistema</div>
                  <p className="text-sm text-black/70 flex-1">{f.short}</p>
                  <div className="mt-4 text-xs font-bold text-[color:var(--red)] uppercase tracking-widest">
                    Ver función →
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-12 card-hard p-6 bg-[color:var(--mustard)]">
            <p className="font-stencil text-2xl md:text-3xl">
              Si tu software solo responde cuando le hablas, vive en los 90.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
