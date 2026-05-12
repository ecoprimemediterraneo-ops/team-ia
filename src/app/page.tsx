import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Pains from "@/components/Pains";
import MockupShowcase from "@/components/MockupShowcase";
import HowItWorks from "@/components/HowItWorks";
import Team from "@/components/Team";
import DayTimeline from "@/components/DayTimeline";
import Packs from "@/components/Packs";
import Compare from "@/components/Compare";
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
        <Pains />
        <MockupShowcase />
        <HowItWorks />
        <Team />
        <DayTimeline />
        <Packs />
        <Compare />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
