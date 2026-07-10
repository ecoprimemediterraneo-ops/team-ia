import type { Metadata, Viewport } from "next";
import { Anton } from "next/font/google";
import "./globals.css";
import CookieBanner from "@/components/CookieBanner";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import TomasWidget from "@/components/TomasWidget";

const SITE_URL = "https://aiteam.marketing";

// Fuente de marca para titulares/logo (display). Se auto-hospeda en build; cae a Impact si no carga.
const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton-loaded", display: "swap" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "AI-Team — Agentes IA para clínicas y negocios de servicios",
    template: "%s | AI-Team",
  },
  description:
    "Un equipo de agentes IA atiende tu WhatsApp, tus llamadas, tu Instagram y tu agenda desde un único panel. Tu negocio sigue respondiendo aunque estés ocupado. Desde 149€/mes.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: SITE_URL,
    siteName: "AI-Team",
    title: "AI-Team — Tu negocio sigue respondiendo aunque estés ocupado",
    description:
      "WhatsApp, llamadas, Instagram y agenda, gestionados por un equipo de agentes IA desde un único panel. Desde 149€/mes.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI-Team — Tu negocio sigue respondiendo aunque estés ocupado",
    description:
      "WhatsApp, llamadas, Instagram y agenda, gestionados por un equipo de agentes IA desde un único panel. Desde 149€/mes.",
  },
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`h-full antialiased ${anton.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "AI-Team",
              url: SITE_URL,
              logo: `${SITE_URL}/logo-ai-team.png`,
              description:
                "Tu equipo de empleados IA para PYMES: WhatsApp, llamadas, reseñas, correo, redes sociales, email marketing e inteligencia competitiva.",
              contactPoint: [
                {
                  "@type": "ContactPoint",
                  contactType: "sales",
                  email: "hola@aiteam.marketing",
                  areaServed: "ES",
                  availableLanguage: ["Spanish"],
                },
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "AI-Team",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "EUR",
                lowPrice: "149",
                highPrice: "948",
                offerCount: "2",
              },
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[color:var(--cream)] text-[color:var(--ink)]">
        {children}
        <TomasWidget />
        <WhatsAppFloat />
        <CookieBanner />
      </body>
    </html>
  );
}
