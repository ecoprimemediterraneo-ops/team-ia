import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "AI-Team — Tu agencia de marketing con agentes de IA",
  description:
    "6 especialistas de IA que se ocupan de tu WhatsApp, reseñas, email, redes, llamadas y correo. Tu agencia de marketing en una caja.",
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
