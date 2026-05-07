import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Pains from "@/components/Pains";
import Team from "@/components/Team";
import DayTimeline from "@/components/DayTimeline";
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
        <Team />
        <DayTimeline />
        <Compare />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
