import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { agents } from "@/lib/agents";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recluta tu equipo IA",
  description:
    "Elige los agentes IA que necesita tu negocio. Activación en 24h. 6 meses gratis sin tarjeta. Precio fundador para siempre.",
  alternates: { canonical: "https://aiteam.marketing/reclutar" },
};

const steps = [
  { n: "01", title: "Elige tus agentes", body: "Marca los agentes que necesita tu negocio. Empieza por uno o lánzate con el equipo completo." },
  { n: "02", title: "Conecta tus canales", body: "WhatsApp, Gmail, Google My Business, Instagram. Onboarding self-service guiado en 15 minutos." },
  { n: "03", title: "Aprueba el tono", body: "Los agentes aprenden tu voz, catálogo y precios. Tú revisas y firmas. Empiezan a operar." },
  { n: "04", title: "Mide resultados", body: "Panel único: leads capturados, reseñas conseguidas, citas agendadas, emails enviados. Cancela cuando quieras." },
];

export default function ReclutarPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-20 border-b-[3px] border-black">
          <div className="max-w-5xl mx-auto px-5 text-center">
            <span className="inline-block bg-[color:var(--red)] text-white px-3 py-1 text-xs font-mono font-bold tracking-widest mb-4">
              RECLUTAMIENTO ABIERTO · 50 PLAZAS FUNDADOR
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4">
              Recluta a tu equipo IA
            </h1>
            <p className="text-lg text-black/70 max-w-2xl mx-auto">
              Ocho agentes especializados. Activa los que necesites. Operan en 24h.
            </p>
          </div>
        </section>

        <section className="py-20">
          <div className="max-w-6xl mx-auto px-5">
            <h2 className="font-stencil text-3xl md:text-5xl mb-8">El equipo disponible</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {agents.map((a) => (
                <article key={a.slug} className="card-hard p-5 flex flex-col bg-white">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{a.emoji}</span>
                    <div>
                      <div className="font-bold text-lg">{a.name}</div>
                      <div className="text-xs text-black/60">{a.role}</div>
                    </div>
                    <span className="ml-auto text-[10px] font-mono bg-black text-white px-2 py-1">{a.codename}</span>
                  </div>
                  <p className="text-sm text-black/70 flex-1 mb-4">{a.short}</p>
                  <div className="text-[10px] font-mono text-black/50 uppercase tracking-widest">
                    {a.statusNote}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 border-t-[3px] border-black bg-white">
          <div className="max-w-5xl mx-auto px-5">
            <h2 className="font-stencil text-3xl md:text-5xl mb-12">Cómo funciona</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {steps.map((s) => (
                <div key={s.n} className="card-hard p-6 bg-[color:var(--cream)]/40">
                  <div className="font-stencil text-5xl text-[color:var(--red)] mb-3">{s.n}</div>
                  <div className="font-bold text-lg mb-2">{s.title}</div>
                  <p className="text-sm text-black/70">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 border-t-[3px] border-black bg-[color:var(--mustard)]">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <h2 className="font-stencil text-3xl md:text-5xl mb-4">Empieza hoy</h2>
            <p className="text-lg mb-8">
              6 meses gratis. Sin tarjeta. Sin permanencia. Precio fundador para siempre.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <a href="/onboarding" className="btn-mustard bg-black text-[color:var(--mustard)] hover:bg-[color:var(--red)] hover:text-white">
                ACTIVAR MI EQUIPO →
              </a>
              <a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" target="_blank" rel="noopener noreferrer" className="border-[3px] border-black px-5 py-3 font-bold uppercase tracking-widest text-sm hover:bg-black hover:text-[color:var(--mustard)] transition-colors">
                Hablar 15 min
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
