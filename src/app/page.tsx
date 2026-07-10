import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import EjemploHome from "@/components/EjemploHome";
import Team from "@/components/Team";
import Derribo from "@/components/Derribo";
import Packs from "@/components/Packs";
import Comparador from "@/components/Comparador";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI-Team — Agentes IA para clínicas y negocios de servicios",
  description:
    "Un equipo de agentes IA atiende tu WhatsApp, tus llamadas, tu Instagram y tu agenda desde un único panel. Tu negocio sigue respondiendo aunque estés ocupado. Desde 149€/mes.",
  alternates: { canonical: "https://aiteam.marketing/" },
  openGraph: {
    title: "AI-Team — Tu negocio sigue respondiendo aunque estés ocupado",
    description:
      "WhatsApp, llamadas, Instagram y agenda, gestionados por un equipo de agentes IA desde un único panel. Desde 149€/mes.",
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
        {/* Hero — titular + CTA */}
        <Hero />
        {/* Tu equipo — 4 agentes protagonistas (id: como-funciona) */}
        <Team />
        {/* Demo ilustrativa del sistema en acción */}
        <EjemploHome />
        {/* Derribo — diferenciación corta */}
        <Derribo />
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
