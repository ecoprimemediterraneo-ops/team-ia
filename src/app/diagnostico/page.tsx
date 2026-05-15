import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DiagnosticoForm from "@/components/DiagnosticoForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Diagnóstico gratis de tu clínica en 2 minutos",
  description:
    "Diana analiza tu web, Google Business, Instagram, WhatsApp y software de gestión. Te entrega un informe con tu pérdida estimada anual en 2 minutos. Sin tarjeta.",
  alternates: { canonical: "https://aiteam.marketing/diagnostico" },
};

export default function DiagnosticoPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-16 border-b-[3px] border-black" style={{ backgroundColor: "#14B8A615" }}>
          <div className="max-w-4xl mx-auto px-5 text-center">
            <span className="inline-block bg-black text-[#14B8A6] px-3 py-1 text-xs font-mono font-bold tracking-widest mb-4">
              HOTEL-D8 · DIANA · AUDITORA DE CLÍNICAS
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4">
              ¿Dónde pierdes dinero<br />en tu clínica?
            </h1>
            <p className="text-lg text-black/70 max-w-2xl mx-auto mb-6">
              Diana audita 7 áreas digitales en 2 minutos: web, Google, reseñas, WhatsApp, redes, gestión y competencia. Te entrega tu pérdida estimada anual en euros.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono tracking-widest text-black/60">
              <span>✓ 2 MINUTOS</span>
              <span>·</span>
              <span>✓ SIN TARJETA</span>
              <span>·</span>
              <span>✓ INFORME PDF POR EMAIL</span>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-3xl mx-auto px-5">
            <DiagnosticoForm />
          </div>
        </section>

        <section className="py-16 border-t-[3px] border-black bg-white">
          <div className="max-w-4xl mx-auto px-5">
            <h2 className="font-stencil text-2xl md:text-4xl mb-8 text-center">
              Qué analiza Diana
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { k: "🌐", t: "Web", d: "Velocidad, SEO local, conversión, schema.org" },
                { k: "⭐", t: "Reputación Google", d: "Reseñas, nota, frecuencia, respuestas" },
                { k: "💬", t: "WhatsApp", d: "Tiempo medio respuesta, recordatorios, no-shows" },
                { k: "📞", t: "Llamadas", d: "Tasa de atención, fuera de horario" },
                { k: "📱", t: "Instagram", d: "Frecuencia, engagement, calendario editorial" },
                { k: "✉️", t: "Email marketing", d: "BBDD, newsletter, SPF/DKIM/DMARC" },
                { k: "🔍", t: "Competencia", d: "Precios y promos de clínicas cercanas" },
              ].map((x) => (
                <div key={x.t} className="card-hard p-5 bg-[color:var(--cream)]/40 flex gap-3 items-start">
                  <span className="text-3xl">{x.k}</span>
                  <div>
                    <div className="font-bold">{x.t}</div>
                    <div className="text-sm text-black/70">{x.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
