import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import Image from "next/image";
import { agents } from "@/lib/agents";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Los agentes IA del equipo",
  description: "Conoce a Pablo, Rocío, Eva, Lucía, Marta, Carmen y Sergio. Cada uno especializado en un canal de tu negocio.",
  alternates: { canonical: "https://aiteam.marketing/agentes" },
};

export default function AgentesPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-16">
        <div className="max-w-6xl mx-auto px-5">
          <div className="mb-12">
            <span className="inline-block bg-black text-[color:var(--mustard)] px-3 py-1 text-xs font-mono font-bold tracking-widest mb-4">
              EL EQUIPO COMPLETO
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4">Los 8 agentes</h1>
            <p className="text-lg text-black/70 max-w-2xl">
              Cada uno especializado en un canal. Activa los que necesites.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {agents.map((a) => (
              <Link key={a.slug} href={`/agentes/${a.slug}`} className="card-hard p-5 bg-white hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex flex-col">
                <div className="relative aspect-square border-2 border-black mb-4 overflow-hidden" style={{ backgroundColor: a.color + "20" }}>
                  <Image src={a.avatar} alt={a.name} fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="font-stencil text-2xl">{a.name}</h2>
                </div>
                <div className="text-xs font-mono uppercase tracking-widest text-black/60 mb-3">{a.role}</div>
                <p className="text-sm text-black/70 flex-1">{a.short}</p>
                <div className="mt-4 text-xs font-bold text-[color:var(--red)] uppercase tracking-widest">
                  Ver detalle →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
