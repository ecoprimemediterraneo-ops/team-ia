import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import AgentOS from "@/components/AgentOS";
import Team from "@/components/Team";
import KitInicio from "@/components/KitInicio";
import MonthlyReportSection from "@/components/MonthlyReportSection";
import Packs from "@/components/Packs";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <AgentOS />
        <Team />
        <MonthlyReportSection />
        <KitInicio />
        <Packs />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
