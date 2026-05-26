import type { Metadata } from "next";
import SectorIndexView from "@/components/SectorIndexView";
import { VERTICALS } from "@/lib/ciudades";

export const metadata: Metadata = {
  title: "IA para Asesorías y Gestorías — 9 agentes desde 79€/mes",
  description: "Atención automatizada de dudas, recordatorios de plazos y captación de autónomos. Para asesorías en toda España.",
  alternates: { canonical: "https://aiteam.marketing/asesorias" },
};

export default function AsesoriasPage() {
  return <SectorIndexView vertical={VERTICALS.asesorias} basePath="asesorias" />;
}
