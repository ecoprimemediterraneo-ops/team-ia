import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Team from "@/components/Team";
import MonthlyReportSection from "@/components/MonthlyReportSection";
import Packs from "@/components/Packs";
import HomeSteps from "@/components/HomeSteps";
import FAQ from "@/components/FAQ";
import FounderSection from "@/components/FounderSection";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* 2. Hero + tira de agentes */}
        <Hero />
        {/* 3. Agentes fusionados */}
        <Team />
        {/* 4. Informe mensual compacto + link a /precios */}
        <MonthlyReportSection compact />
        {/* 5. Precios compactos (2 cards, sin listas largas) */}
        <Packs compact />
        {/* 6. Qué pasa cuando te registras */}
        <HomeSteps />
        {/* 7. FAQ reducida a 4 */}
        <FAQ />
        {/* 8. Quién está detrás */}
        <FounderSection />
        {/* 9. CTA final: banner → /beta */}
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
