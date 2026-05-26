import type { MetadataRoute } from "next";
import { CIUDADES } from "@/lib/ciudades";
import { posts } from "@/lib/blog";
import { agents } from "@/lib/agents";

const BASE = "https://aiteam.marketing";

export default function sitemap(): MetadataRoute.Sitemap {
  const ciudadPages = CIUDADES.flatMap((c) => [
    { url: `${BASE}/dentistas/${c.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.75 },
    { url: `${BASE}/peluquerias/${c.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.75 },
    { url: `${BASE}/restaurantes/${c.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.75 },
    { url: `${BASE}/fisioterapeutas/${c.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${BASE}/abogados/${c.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${BASE}/asesorias/${c.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${BASE}/gimnasios/${c.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${BASE}/podologos/${c.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 },
  ]);
  const sectorIndex = ["fisioterapeutas", "abogados", "asesorias", "gimnasios", "podologos"].map((s) => ({
    url: `${BASE}/${s}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.8,
  }));

  const blogPages = posts.map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/demo`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/precios`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/reclutar`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/diagnostico`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.95 },
    { url: `${BASE}/calculadora`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/sobre-nosotros`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/integraciones`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE}/vs/doctoralia`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/vs/klinik`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/vs/agencia`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/vs/mailchimp`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/agentes`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.85 },
    ...agents.map((a) => ({
      url: `${BASE}/agentes/${a.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
    { url: `${BASE}/casos`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE}/dentistas`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/peluquerias`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    ...ciudadPages,
    ...sectorIndex,
    ...blogPages,
    { url: `${BASE}/legal/privacidad`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/legal/terminos`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
}
