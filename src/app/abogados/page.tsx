import type { Metadata } from "next";
import SectorIndexView from "@/components/SectorIndexView";
import { VERTICALS } from "@/lib/ciudades";

export const metadata: Metadata = {
  title: "IA para Despachos de Abogados — 9 agentes desde 79€/mes",
  description: "Lucía gestiona tu bandeja, Pablo cualifica leads y Eva mantiene contactos calientes. Para despachos en toda España.",
  alternates: { canonical: "https://aiteam.marketing/abogados" },
};

export default function AbogadosPage() {
  return <SectorIndexView vertical={VERTICALS.abogados} basePath="abogados" />;
}
