import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BetaForm from "./BetaForm";

export const metadata: Metadata = {
  title: "Pide tu demo · AI-Team",
  description:
    "Demo de 15 min, sin compromiso. Te enseñamos el sistema operativo para tu negocio. 6 meses gratis, sin tarjeta, sin permanencia.",
  alternates: { canonical: "https://aiteam.marketing/beta" },
  openGraph: {
    title: "Pide tu demo · AI-Team",
    description:
      "Demo de 15 min, sin compromiso. El sistema operativo para clínicas y PyMEs de servicios. 6 meses gratis, sin tarjeta.",
    url: "https://aiteam.marketing/beta",
    type: "website",
    locale: "es_ES",
    siteName: "AI-Team",
  },
};

const SECTORES = [
  "Clínica (estética, fisio, podología…)",
  "Clínica dental",
  "Bufete de abogados",
  "Estudio de arquitectura / ingeniería",
  "Asesoría / gestoría",
  "Peluquería / salón",
  "Restaurante / bar",
  "Gimnasio",
  "Inmobiliaria",
  "Otro",
];

export default function BetaPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-20 border-b-[3px] border-black bg-black text-[color:var(--cream)]">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <div className="flex flex-wrap justify-center items-center gap-3 text-xs font-mono mb-6">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">
                🔒 BETA PRIVADA
              </span>
              <span className="border border-white/20 text-white/60 px-3 py-1 tracking-widest">
                20 PLAZAS · 6 MESES GRATIS · SIN PERMANENCIA
              </span>
            </div>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4 leading-tight">
              Pide tu demo
            </h1>
            <p className="text-base md:text-lg text-white/70 max-w-xl mx-auto">
              15 minutos, sin compromiso. Te enseñamos el sistema funcionando para tu negocio. 6 meses gratis, sin tarjeta, precio fundador para siempre.
            </p>
          </div>
        </section>

        <section className="py-16 border-b-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-xl mx-auto px-5">
            <BetaForm sectores={SECTORES} />
          </div>
        </section>

        <section className="py-12 border-b-[3px] border-black bg-white">
          <div className="max-w-3xl mx-auto px-5 grid sm:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="font-stencil text-3xl mb-1">01</div>
              <div className="font-bold mb-1">Te contactamos</div>
              <p className="text-black/60">En menos de 24h te escribimos para agendar la demo de 15 min.</p>
            </div>
            <div>
              <div className="font-stencil text-3xl mb-1">02</div>
              <div className="font-bold mb-1">Setup en 15 min</div>
              <p className="text-black/60">Conectas WhatsApp y Gmail; el sistema aprende tu negocio y tu tono.</p>
            </div>
            <div>
              <div className="font-stencil text-3xl mb-1">03</div>
              <div className="font-bold mb-1">Operativo en 24h</div>
              <p className="text-black/60">Tu sistema empieza a contestar, agendar, publicar y captar.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
