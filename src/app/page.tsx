import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import AgentOS from "@/components/AgentOS";
import HowItWorks from "@/components/HowItWorks";
import Team from "@/components/Team";
import MonthlyReportSection from "@/components/MonthlyReportSection";
import Packs from "@/components/Packs";
import Testimonials from "@/components/Testimonials";
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
        <HowItWorks />
        <Team />
        <MonthlyReportSection />
        <Packs />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
