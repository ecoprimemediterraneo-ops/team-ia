import Navbar from "@/components/Navbar";
import HeroSwitcher from "@/components/HeroSwitcher";
import QuickActions from "@/components/QuickActions";
import AlreadyWorks from "@/components/AlreadyWorks";
import BetaCallout from "@/components/BetaCallout";
import AgentOS from "@/components/AgentOS";
import Pains from "@/components/Pains";
import HowItWorks from "@/components/HowItWorks";
import Team from "@/components/Team";
import SectorExamples from "@/components/SectorExamples";
import Packs from "@/components/Packs";
import Compare from "@/components/Compare";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <HeroSwitcher />
        <QuickActions />
        <AlreadyWorks />
        <BetaCallout />
        <AgentOS />
        <Pains />
        <HowItWorks />
        <Team />
        <SectorExamples />
        <Packs />
        <Compare />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
