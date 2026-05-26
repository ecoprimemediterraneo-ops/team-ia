import type { Metadata } from "next";
import SectorIndexView from "@/components/SectorIndexView";
import { VERTICALS } from "@/lib/ciudades";

export const metadata: Metadata = {
  title: "IA para Negocios de Podología — 9 agentes desde 79€/mes",
  description: "WhatsApp 24/7, reseñas Google y email marketing automatizado para negocios de podología en toda España.",
  alternates: { canonical: "https://aiteam.marketing/podologos" },
};

export default function PodologosPage() {
  return <SectorIndexView vertical={VERTICALS.podologos} basePath="podologos" />;
}
