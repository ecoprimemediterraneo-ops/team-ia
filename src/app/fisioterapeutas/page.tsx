import type { Metadata } from "next";
import SectorIndexView from "@/components/SectorIndexView";
import { VERTICALS } from "@/lib/ciudades";

export const metadata: Metadata = {
  title: "IA para Negocios de Fisioterapia — 9 agentes desde 79€/mes",
  description: "Reduce no-shows, contesta WhatsApp 24/7 y sube tu Google. AI-Team para negocios de fisioterapia en toda España.",
  alternates: { canonical: "https://aiteam.marketing/fisioterapeutas" },
};

export default function FisioterapeutasPage() {
  return <SectorIndexView vertical={VERTICALS.fisioterapeutas} basePath="fisioterapeutas" />;
}
