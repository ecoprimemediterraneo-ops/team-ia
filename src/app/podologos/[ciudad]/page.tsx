import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SectorCiudadView from "@/components/SectorCiudadView";
import { getCiudad, CIUDADES, VERTICALS } from "@/lib/ciudades";

export async function generateStaticParams() {
  return CIUDADES.map((c) => ({ ciudad: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ ciudad: string }> }): Promise<Metadata> {
  const { ciudad: slug } = await params;
  const ciudad = getCiudad(slug);
  if (!ciudad) return {};
  const v = VERTICALS.podologos;
  return {
    title: `${v.titulo(ciudad.nombre)} | AI-Team`,
    description: v.descripcion(ciudad.nombre, ciudad.demonym),
    alternates: { canonical: `https://aiteam.marketing/podologos/${slug}` },
    openGraph: { title: v.titulo(ciudad.nombre), description: v.descripcion(ciudad.nombre, ciudad.demonym) },
  };
}

export default async function PodologosCiudadPage({ params }: { params: Promise<{ ciudad: string }> }) {
  const { ciudad: slug } = await params;
  const ciudad = getCiudad(slug);
  if (!ciudad) notFound();
  return <SectorCiudadView ciudad={ciudad} vertical={VERTICALS.podologos} basePath="podologos" />;
}
