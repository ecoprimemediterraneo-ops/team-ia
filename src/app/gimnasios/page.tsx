import type { Metadata } from "next";
import SectorIndexView from "@/components/SectorIndexView";
import { VERTICALS } from "@/lib/ciudades";

export const metadata: Metadata = {
  title: "IA para Gimnasios y Centros Deportivos — 9 agentes desde 79€/mes",
  description: "Reservas, reactivación de socios y reseñas automatizadas. Para gimnasios en toda España.",
  alternates: { canonical: "https://aiteam.marketing/gimnasios" },
};

export default function GimnasiosPage() {
  return <SectorIndexView vertical={VERTICALS.gimnasios} basePath="gimnasios" />;
}
