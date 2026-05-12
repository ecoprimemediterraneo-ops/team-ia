import type { Metadata, Viewport } from "next";
import { Anton, Inter, Black_Ops_One, VT323 } from "next/font/google";
import "./globals.css";

const anton = Anton({
  weight: "400",
  variable: "--font-anton",
  subsets: ["latin"],
});

const stencil = Black_Ops_One({
  weight: "400",
  variable: "--font-stencil",
  subsets: ["latin"],
});

const terminal = VT323({
  weight: "400",
  variable: "--font-terminal",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

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
    "Siete agentes de IA gestionan WhatsApp, llamadas, reseñas, correo, redes sociales, email marketing e inteligencia competitiva. Autónomo. Medible. Desde 39€/mes.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: SITE_URL,
    siteName: "AI-Team",
    title: "AI-Team — Siete agentes IA para tu negocio",
    description:
      "Siete agentes de IA gestionan WhatsApp, llamadas, reseñas, correo, redes y email marketing. Desde 39€/mes.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI-Team — Siete agentes IA para tu negocio",
    description:
      "Siete agentes de IA gestionan WhatsApp, llamadas, reseñas, correo, redes y email marketing. Desde 39€/mes.",
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
      className={`${anton.variable} ${stencil.variable} ${terminal.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[color:var(--cream)] text-[color:var(--ink)]">
        {children}
      </body>
    </html>
  );
}
