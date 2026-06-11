import type { Metadata, Viewport } from "next";
import "./globals.css";
import CookieBanner from "@/components/CookieBanner";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import TomasWidget from "@/components/TomasWidget";

const SITE_URL = "https://aiteam.marketing";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "AI-Team — Tu equipo de empleados IA. Seis agentes desde 99€/mes.",
    template: "%s | AI-Team",
  },
  description:
    "Seis agentes IA gestionan WhatsApp, llamadas, reseñas, correo, redes y email marketing. Sin nóminas. Desde 99€/mes. 6 meses gratis.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: SITE_URL,
    siteName: "AI-Team",
    title: "AI-Team — Seis agentes IA para tu negocio",
    description:
      "Seis agentes IA gestionan WhatsApp, llamadas, reseñas, correo, redes y email marketing. Sin nóminas. Desde 99€/mes. 6 meses gratis.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI-Team — Seis agentes IA para tu negocio",
    description:
      "Seis agentes IA gestionan WhatsApp, llamadas, reseñas, correo, redes y email marketing. Sin nóminas. Desde 99€/mes. 6 meses gratis.",
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
                lowPrice: "39",
                highPrice: "299",
                offerCount: "4",
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
