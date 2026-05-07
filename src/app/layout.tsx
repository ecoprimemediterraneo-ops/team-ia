import type { Metadata } from "next";
import { Anton, Inter, Black_Ops_One } from "next/font/google";
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

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Team IA — Tu unidad de élite para escalar tu negocio",
  description:
    "Cuatro especialistas de IA que gestionan tu correo, redes, leads y llamadas. Para autónomos y PYMEs en España y LATAM.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${anton.variable} ${stencil.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[color:var(--cream)] text-[color:var(--ink)]">
        {children}
      </body>
    </html>
  );
}
