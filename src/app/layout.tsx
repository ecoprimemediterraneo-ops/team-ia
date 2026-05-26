import type { Metadata, Viewport } from "next";
import "./globals.css";
import CookieBanner from "@/components/CookieBanner";
import TomasWidget from "@/components/TomasWidget";
import BetaBanner from "@/components/BetaBanner";
import RegisterSW from "@/components/RegisterSW";

const SITE_URL = "https://aiteam.marketing";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    default: "AI-Team — El sistema operativo de empleados IA para tu negocio",
    template: "%s | AI-Team",
  },
  description:
    "Nueve agentes de IA gestionan WhatsApp, llamadas, reseñas, correo, redes sociales, email marketing e inteligencia competitiva. Autónomo. Medible. Desde 79€/mes.",
  metadataBase: new URL(SITE_URL),
  applicationName: "AI-Team",
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: SITE_URL,
    siteName: "AI-Team",
    title: "AI-Team — Nueve agentes IA para tu negocio",
    description:
      "Nueve agentes de IA gestionan WhatsApp, llamadas, reseñas, correo, redes, email marketing y diagnóstico. Desde 79€/mes.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI-Team — Nueve agentes IA para tu negocio",
    description:
      "Nueve agentes de IA gestionan WhatsApp, llamadas, reseñas, correo, redes, email marketing y diagnóstico. Desde 79€/mes.",
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
      className="h-full antialiased"
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AI-Team" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "AI-Team",
              url: SITE_URL,
              logo: `${SITE_URL}/logo.png`,
              description:
                "Sistema operativo de empleados IA para PYMES: WhatsApp, llamadas, reseñas, correo, redes sociales, email marketing e inteligencia competitiva.",
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
                lowPrice: "79",
                highPrice: "449",
                offerCount: "4",
              },
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[color:var(--cream)] text-[color:var(--ink)]">
        <RegisterSW />
        <BetaBanner />
        {children}
        <CookieBanner />
        <TomasWidget />
      </body>
    </html>
  );
}
