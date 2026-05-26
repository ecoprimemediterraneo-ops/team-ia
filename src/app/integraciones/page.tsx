import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integraciones — AI-Team se conecta con tu stack actual",
  description: "WhatsApp, Gmail, Google Business, Instagram, Resend, Stripe, Supabase, Twilio, Vapi. AI-Team encaja en tu stack sin reemplazarlo.",
  alternates: { canonical: "https://aiteam.marketing/integraciones" },
};

type Integ = { nombre: string; agente: string; tipo: "ready" | "soon" | "roadmap"; descripcion: string };

const integraciones: Integ[] = [
  // READY
  { nombre: "Gmail", agente: "Lucía", tipo: "ready", descripcion: "OAuth real. Lectura, borradores y limpieza automática de bandeja." },
  { nombre: "Google Calendar", agente: "Lucía / Pablo / Carmen", tipo: "ready", descripcion: "Lectura y escritura de citas." },
  { nombre: "Resend", agente: "Eva", tipo: "ready", descripcion: "Envío real de emails desde eva@aiteam.marketing." },
  { nombre: "Anthropic Claude", agente: "Todos", tipo: "ready", descripcion: "Modelo principal de IA (Sonnet 4.5 y Haiku 4.5)." },
  { nombre: "OpenAI", agente: "Todos (fallback)", tipo: "ready", descripcion: "Fallback opcional para tareas específicas." },
  { nombre: "Supabase", agente: "Todos (storage)", tipo: "ready", descripcion: "Base de datos compartida para histórico." },

  // SOON
  { nombre: "WhatsApp Business (Meta Cloud API)", agente: "Pablo", tipo: "soon", descripcion: "Auto-respuesta real 24/7. En alta Meta Business." },
  { nombre: "Google Business Profile", agente: "Rocío", tipo: "soon", descripcion: "Solicitud y respuesta automática de reseñas. En aprobación Google." },
  { nombre: "Instagram Graph API", agente: "Marta", tipo: "soon", descripcion: "Publicación auto en feed + reels + stories." },
  { nombre: "LinkedIn Marketing API", agente: "Marta", tipo: "soon", descripcion: "Publicación auto en Company Page." },
  { nombre: "Stripe", agente: "Billing", tipo: "soon", descripcion: "Suscripciones recurrentes con prueba 14 días." },

  // ROADMAP
  { nombre: "Twilio Voice", agente: "Carmen", tipo: "roadmap", descripcion: "Llamadas entrantes reales en español." },
  { nombre: "Vapi", agente: "Carmen", tipo: "roadmap", descripcion: "IA conversacional de voz en tiempo real." },
  { nombre: "Ayrshare (alternativa)", agente: "Marta", tipo: "roadmap", descripcion: "Cliente Multi-red opcional. Solo si no usamos Meta API directa." },
  { nombre: "Doctoralia", agente: "Pablo + Rocío", tipo: "roadmap", descripcion: "Sincronización agenda + reseñas." },
  { nombre: "Klinik / Dentalink / Gesden", agente: "Pablo", tipo: "roadmap", descripcion: "Sincronización con software de gestión negocio." },
  { nombre: "Treatwell / Booksy / Fresha", agente: "Pablo + Marta", tipo: "roadmap", descripcion: "Sincronización para peluquerías y estética." },
  { nombre: "TikTok for Business API", agente: "Marta", tipo: "roadmap", descripcion: "Vídeos auto-publicados. Cuando facturemos para verificación." },
];

const tipoColor = {
  ready: { bg: "#22C55E", label: "OPERATIVA" },
  soon: { bg: "#F5C518", label: "EN TRÁMITE" },
  roadmap: { bg: "#9CA3AF", label: "ROADMAP" },
} as const;

export default function IntegracionesPage() {
  const ready = integraciones.filter((i) => i.tipo === "ready");
  const soon = integraciones.filter((i) => i.tipo === "soon");
  const roadmap = integraciones.filter((i) => i.tipo === "roadmap");

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-16 border-b-[3px] border-black">
          <div className="max-w-4xl mx-auto px-5">
            <span className="inline-block bg-black text-[color:var(--mustard)] px-3 py-1 text-xs font-mono font-bold tracking-widest mb-4">
              {integraciones.length} INTEGRACIONES
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4">Integraciones</h1>
            <p className="text-lg text-black/70">
              AI-Team no reemplaza tu stack. Se conecta encima. Esto es lo que ya hablamos con otras herramientas.
            </p>
          </div>
        </section>

        <Seccion titulo="✅ Operativas hoy" items={ready} />
        <Seccion titulo="🟡 En trámite — disponibles 2-4 semanas" items={soon} />
        <Seccion titulo="⚪ Roadmap — siguiente trimestre" items={roadmap} />

        <section className="py-16 border-t-[3px] border-black bg-[color:var(--mustard)]">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <h2 className="font-stencil text-3xl md:text-5xl mb-4">¿Usas otra herramienta?</h2>
            <p className="text-lg mb-8">
              Si tu software no está aquí, dinos cuál es. Construimos integraciones bajo demanda para clientes Pro.
            </p>
            <Link href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" target="_blank" rel="noopener noreferrer" className="btn-mustard bg-black text-[color:var(--mustard)] hover:bg-[color:var(--red)] hover:text-white inline-block">
              HABLAR 15 MIN →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Seccion({ titulo, items }: { titulo: string; items: Integ[] }) {
  return (
    <section className="py-12 border-t border-black/10">
      <div className="max-w-5xl mx-auto px-5">
        <h2 className="font-stencil text-2xl md:text-3xl mb-6">{titulo}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((i) => {
            const t = tipoColor[i.tipo];
            return (
              <article key={i.nombre} className="card-hard p-5 bg-white">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-bold text-lg leading-tight">{i.nombre}</h3>
                  <span className="text-[9px] font-mono font-bold tracking-widest px-2 py-1 shrink-0 text-white" style={{ backgroundColor: t.bg }}>
                    {t.label}
                  </span>
                </div>
                <div className="text-xs font-mono uppercase tracking-widest text-black/60 mb-2">{i.agente}</div>
                <p className="text-sm text-black/70">{i.descripcion}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
