import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ColmenaNeuronal from "@/components/ColmenaNeuronal";
import EjemploHome from "@/components/EjemploHome";
import Team from "@/components/Team";
import MonthlyReportSection from "@/components/MonthlyReportSection";
import Packs from "@/components/Packs";
import Comparador from "@/components/Comparador";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI-Team — El sistema operativo de tu clínica o PyME de servicios",
  description:
    "Un único sistema que gestiona WhatsApp, llamadas, agenda, reseñas, email e Instagram de tu negocio, integrado y proactivo: se adelanta por ti. Desde 149€/mes.",
  alternates: { canonical: "https://aiteam.marketing/" },
  openGraph: {
    title: "AI-Team — El sistema operativo de tu negocio de servicios",
    description:
      "Atiende WhatsApp y llamadas, agenda citas y recupera clientes automáticamente. Un único sistema integrado y proactivo. Desde 149€/mes.",
    url: "https://aiteam.marketing/",
    type: "website",
    locale: "es_ES",
    siteName: "AI-Team",
  },
};

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* Hero — propuesta concreta + CTA */}
        <Hero />
        {/* La Colmena Neuronal: el diferencial de red */}
        <ColmenaNeuronal />
        {/* Ejemplo ilustrativo del sistema en acción */}
        <EjemploHome />
        {/* Cómo funciona (tres módulos) */}
        <Team />
        {/* Informe mensual + capa proactiva (fusionado, compacto) */}
        <MonthlyReportSection compact />
        {/* Precio resumido */}
        <Packs compact />
        {/* Comparador 3 columnas */}
        <Comparador />
        {/* FAQ */}
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
