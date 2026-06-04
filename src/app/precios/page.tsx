import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Packs from "@/components/Packs";
import MonthlyReportSection from "@/components/MonthlyReportSection";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Precios — Desde 89€/mes",
  description:
    "Tres planes: Esencial, Completo y Pro. Precio fundador para siempre. 6 meses gratis, sin tarjeta, sin permanencia.",
  alternates: { canonical: "https://aiteam.marketing/precios" },
};

const faq = [
  {
    q: "¿Puedo cambiar de plan más adelante?",
    a: "Sí. Subes o bajas de plan en un click desde tu panel. El cambio se prorratea automáticamente.",
  },
  {
    q: "¿Qué es el precio fundador?",
    a: "Los primeros 20 negocios mantienen su precio fundador para siempre, incluso si subimos las tarifas. No expira mientras tu suscripción siga activa.",
  },
  {
    q: "¿Hay coste de instalación?",
    a: "No. El alta es self-service en los tres planes — el asistente de configuración te guía por sector paso a paso. Tardas unos 15 minutos.",
  },
  {
    q: "¿Qué pasa si cancelo?",
    a: "Cancelas con un click y dejas de pagar el siguiente ciclo. Tus datos quedan disponibles 30 días por si decides volver.",
  },
  {
    q: "¿El IVA está incluido?",
    a: "Los precios mostrados son sin IVA. La factura incluye el 21% según normativa española.",
  },
];

export default function PreciosPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-16 border-b-[3px] border-black">
          <div className="max-w-5xl mx-auto px-5 text-center">
            <span className="inline-block bg-black text-[color:var(--mustard)] px-3 py-1 text-xs font-mono font-bold tracking-widest mb-4">
              PRECIO FUNDADOR · 20 PLAZAS
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4">Precios sin sorpresas</h1>
            <p className="text-lg text-black/70 max-w-2xl mx-auto">
              Desde 89€/mes. 6 meses gratis. Sin tarjeta para empezar. Sin permanencia. Cambia de plan cuando quieras.
            </p>
          </div>
        </section>

        <Packs />

        <MonthlyReportSection />

        <section className="py-20 border-t-[3px] border-black">
          <div className="max-w-3xl mx-auto px-5">
            <h2 className="font-stencil text-3xl md:text-5xl mb-8">Preguntas sobre precios</h2>
            <div className="space-y-4">
              {faq.map((item) => (
                <details key={item.q} className="card-hard p-5 group">
                  <summary className="cursor-pointer font-bold flex justify-between items-center">
                    {item.q}
                    <span className="text-[color:var(--red)] group-open:rotate-45 transition-transform text-2xl leading-none">+</span>
                  </summary>
                  <p className="mt-3 text-black/70 text-sm leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
            <div className="text-center mt-12">
              <a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" target="_blank" rel="noopener noreferrer" className="btn-mustard inline-block">
                ¿Dudas? Reserva 15 min →
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
