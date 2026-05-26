import Navbar from "@/components/Navbar";
import HeroSwitcher from "@/components/HeroSwitcher";
import PromoVideo from "@/components/PromoVideo";
import StatsBar from "@/components/StatsBar";
import AgentOS from "@/components/AgentOS";
import Pains from "@/components/Pains";
import HowItWorks from "@/components/HowItWorks";
import Team from "@/components/Team";
import Packs from "@/components/Packs";
import PlansComparisonTable from "@/components/PlansComparisonTable";
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
        <HeroSwitcher />
        <PromoVideo />
        <StatsBar />
        <AgentOS />
        <Pains />
        <HowItWorks />
        <Team />
        <Packs />
        <PlansComparisonTable />
        <Compare />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
