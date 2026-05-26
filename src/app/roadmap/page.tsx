import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { agents } from "@/lib/agents";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roadmap público — AI-Team",
  description:
    "Qué está operativo, qué está en desarrollo y qué hay planeado para AI-Team. Estado real, sin humo, actualizado automáticamente.",
  alternates: { canonical: "https://aiteam.marketing/roadmap" },
};

const PLANNED = [
  { titulo: "Carmen conversacional", desc: "Voz IA que mantiene conversación natural, agenda citas y cierra leads. Tras validar Carmen Esencial." },
  { titulo: "Marketplace de plantillas", desc: "Mensajes WhatsApp, secuencias de email y posts pre-hechos por sector." },
  { titulo: "Multi-cuenta WhatsApp", desc: "Varios números bajo el mismo dashboard. Para grupos con múltiples sucursales o franquicias." },
  { titulo: "Análisis de sentimiento reseñas", desc: "Rocío detecta reseñas con tono negativo y avisa al dueño antes que respondas." },
  { titulo: "App móvil", desc: "Notificaciones push de leads entrantes y aprobación de respuestas con un click." },
  { titulo: "Integración Calendly/Cal.com", desc: "Carmen y Lucía agendan en tu calendario real con bloqueos automáticos." },
  { titulo: "Centro de aprendizaje", desc: "Cada agente aprende de las correcciones que tú haces a sus borradores." },
];

export default function RoadmapPage() {
  const operativos = agents.filter((a) => a.realPercent >= 70 && a.slug !== "tomas");
  const enDesarrollo = agents.filter((a) => a.realPercent < 70 && a.slug !== "tomas");

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-16 border-b-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-4xl mx-auto px-5 text-center">
            <span className="inline-block bg-black text-[color:var(--mustard)] px-3 py-1 text-xs font-mono font-bold tracking-widest mb-4">
              ROADMAP PÚBLICO · ACTUALIZADO HOY
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4 leading-[1.05]">
              Qué funciona ahora.<br />Qué llega pronto.<br />Qué viene después.
            </h1>
            <p className="text-lg text-black/70 max-w-2xl mx-auto">
              Cero humo. Te decimos exactamente qué porcentaje real de funcionalidad tiene cada
              agente y qué bloquea su 100%. Página auto-actualizada desde el código.
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="max-w-6xl mx-auto px-5">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* OPERATIVOS */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">✅</span>
                  <h2 className="font-stencil text-2xl">Operativo</h2>
                </div>
                <p className="text-xs font-mono text-black/60 mb-4">
                  Disponible hoy en producción. Funciona end-to-end.
                </p>
                <div className="space-y-3">
                  {operativos.map((a) => (
                    <div key={a.slug} className="card-hard p-4 bg-white">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{a.emoji}</span>
                        <div className="font-stencil text-lg">{a.name}</div>
                        <span className="ml-auto text-xs font-mono font-bold" style={{ color: a.color }}>
                          {a.realPercent}%
                        </span>
                      </div>
                      <div className="text-xs font-mono text-black/50 mb-2">{a.codename} · {a.role}</div>
                      <p className="text-sm text-black/80">{a.statusNote}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* EN DESARROLLO */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🚧</span>
                  <h2 className="font-stencil text-2xl">En desarrollo</h2>
                </div>
                <p className="text-xs font-mono text-black/60 mb-4">
                  Funcional parcial. Subiendo al 100% conforme llegan integraciones externas.
                </p>
                <div className="space-y-3">
                  {enDesarrollo.map((a) => (
                    <div key={a.slug} className="card-hard p-4 bg-white">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{a.emoji}</span>
                        <div className="font-stencil text-lg">{a.name}</div>
                        <span className="ml-auto text-xs font-mono font-bold" style={{ color: a.color }}>
                          {a.realPercent}%
                        </span>
                      </div>
                      <div className="text-xs font-mono text-black/50 mb-2">{a.codename} · {a.role}</div>
                      <p className="text-sm text-black/80 mb-2">{a.statusNote}</p>
                      {a.bloqueador && (
                        <p className="text-[11px] font-mono text-[color:var(--red)] border-t border-black/10 pt-2 mt-2">
                          Bloqueador: {a.bloqueador}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* PLANEADO */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">📅</span>
                  <h2 className="font-stencil text-2xl">Planeado</h2>
                </div>
                <p className="text-xs font-mono text-black/60 mb-4">
                  En la pila de prioridades. Sin fecha cerrada — la beta nos ayuda a ordenarla.
                </p>
                <div className="space-y-3">
                  {PLANNED.map((p, i) => (
                    <div key={i} className="card-hard p-4 bg-white">
                      <div className="font-stencil text-lg mb-1">{p.titulo}</div>
                      <p className="text-sm text-black/70">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <h2 className="font-stencil text-3xl mb-3">¿Quieres influir en este roadmap?</h2>
            <p className="text-sm text-black/70 mb-6">
              Los negocios que entran en la beta privada nos dicen qué priorizar.
              Sus dolores se convierten en las próximas features.
            </p>
            <a href="/beta" className="btn-mustard inline-block">Solicitar beta →</a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
