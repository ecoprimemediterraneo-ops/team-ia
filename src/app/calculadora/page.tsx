import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CalculadoraROI from "@/components/CalculadoraROI";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calculadora ROI — Cuánto ahorras con AI-Team",
  description: "Calcula en 30 segundos cuánto te ahorra AI-Team al mes y al año. Datos reales de pilotos en clínicas dentales y estéticas.",
  alternates: { canonical: "https://aiteam.marketing/calculadora" },
};

export default function CalculadoraPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-16 border-b-[3px] border-black bg-[color:var(--mustard)]">
          <div className="max-w-4xl mx-auto px-5 text-center">
            <span className="inline-block bg-black text-[color:var(--mustard)] px-3 py-1 text-xs font-mono font-bold tracking-widest mb-4">
              CALCULADORA ROI · 30 SEGUNDOS
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4">
              ¿Cuánto te ahorra AI-Team?
            </h1>
            <p className="text-lg text-black/80 max-w-2xl mx-auto">
              Mete 4 números de tu negocio. Te calcula ahorro mensual + anual + ROI del pack recomendado.
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="max-w-3xl mx-auto px-5">
            <CalculadoraROI />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
