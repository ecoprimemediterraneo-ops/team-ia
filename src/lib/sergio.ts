export type Competitor = {
  id: string;
  name: string;
  sector: string;
  city: string;
  googleRating: number;
  reviewCount: number;
  website?: string;
  instagram?: string;
  lastPost?: string; // fecha ISO último post IG
  whatsappSpeed?: string; // "< 1h" | "1-4h" | "> 4h" | "sin WA"
  hasBookingOnline: boolean;
  weaknesses: string[];
  opportunities: string[];
  scrapedAt: string;
};

// Mock data — en producción se reemplaza con Firecrawl/SerpAPI scraping
export const MOCK_COMPETITORS: Competitor[] = [
  {
    id: "c1",
    name: "Clínica Dental Sonrisa Marbella",
    sector: "Clínica dental",
    city: "Marbella",
    googleRating: 4.2,
    reviewCount: 87,
    website: "https://example.com",
    lastPost: "2025-04-01",
    whatsappSpeed: "> 4h",
    hasBookingOnline: false,
    weaknesses: ["Sin reservas online", "WhatsApp lento", "Pocas reseñas vs competencia"],
    opportunities: ["Ofrecer cita online 24/7", "Respuesta WhatsApp en <12s", "Campaña de reseñas"],
    scrapedAt: new Date().toISOString(),
  },
  {
    id: "c2",
    name: "Dental Málaga Centro",
    sector: "Clínica dental",
    city: "Málaga",
    googleRating: 4.6,
    reviewCount: 312,
    website: "https://example2.com",
    instagram: "@dentalmalagacentro",
    lastPost: "2025-05-08",
    whatsappSpeed: "1-4h",
    hasBookingOnline: true,
    weaknesses: ["Instagram poco activo", "Sin seguimiento de presupuestos", "No responden reseñas negativas"],
    opportunities: ["Automatizar respuestas a reseñas", "Reactivar pacientes inactivos", "Contenido dental educativo"],
    scrapedAt: new Date().toISOString(),
  },
  {
    id: "c3",
    name: "Salón Glamour Fuengirola",
    sector: "Peluquería",
    city: "Fuengirola",
    googleRating: 3.9,
    reviewCount: 45,
    website: undefined,
    lastPost: "2025-02-14",
    whatsappSpeed: "sin WA",
    hasBookingOnline: false,
    weaknesses: ["Sin presencia en WhatsApp", "Instagram abandonado", "Rating bajo"],
    opportunities: ["Captar clientes por WhatsApp", "Campaña de reseñas urgente", "Contenido Instagram semanal"],
    scrapedAt: new Date().toISOString(),
  },
  {
    id: "c4",
    name: "Restaurante La Brasa Nerja",
    sector: "Restaurante",
    city: "Nerja",
    googleRating: 4.4,
    reviewCount: 523,
    website: "https://example3.com",
    instagram: "@labrasanerja",
    lastPost: "2025-05-10",
    whatsappSpeed: "< 1h",
    hasBookingOnline: false,
    weaknesses: ["Sin reservas online", "No responde TripAdvisor", "Solo en español"],
    opportunities: ["Reservas WhatsApp en inglés para turistas", "Respuestas TripAdvisor automáticas", "Menú digital QR"],
    scrapedAt: new Date().toISOString(),
  },
  {
    id: "c5",
    name: "Clínica Dental Estepona Salud",
    sector: "Clínica dental",
    city: "Estepona",
    googleRating: 4.1,
    reviewCount: 63,
    lastPost: "2025-03-20",
    whatsappSpeed: "1-4h",
    hasBookingOnline: false,
    weaknesses: ["Pocas reseñas", "Sin web actualizada", "WhatsApp tardío"],
    opportunities: ["Subir a 100+ reseñas en 2 meses", "Cita online", "Seguimiento presupuestos"],
    scrapedAt: new Date().toISOString(),
  },
];

export function filterCompetitors(
  data: Competitor[],
  { sector, city }: { sector?: string; city?: string }
): Competitor[] {
  return data.filter((c) => {
    if (sector && !c.sector.toLowerCase().includes(sector.toLowerCase())) return false;
    if (city && c.city.toLowerCase() !== city.toLowerCase()) return false;
    return true;
  });
}
