import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import PromoVideo from "@/components/PromoVideo";
import StatsBar from "@/components/StatsBar";
import AgentOS from "@/components/AgentOS";
import Pains from "@/components/Pains";
import MockupShowcase from "@/components/MockupShowcase";
import HowItWorks from "@/components/HowItWorks";
import Team from "@/components/Team";
import DayTimeline from "@/components/DayTimeline";
import Packs from "@/components/Packs";
import Compare from "@/components/Compare";
import CaseStudy from "@/components/CaseStudy";
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
        <PromoVideo />
        <StatsBar />
        <AgentOS />
        <Pains />
        <MockupShowcase />
        <HowItWorks />
        <Team />
        <DayTimeline />
        <Packs />
        <Compare />
        <CaseStudy />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
