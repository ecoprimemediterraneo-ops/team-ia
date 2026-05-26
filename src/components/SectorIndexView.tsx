import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { CIUDADES, type VerticalCiudad } from "@/lib/ciudades";

type Props = {
  vertical: VerticalCiudad;
  basePath: string;
};

export default function SectorIndexView({ vertical, basePath }: Props) {
  const v = vertical;
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="brick border-b-[6px] border-[color:var(--red)] py-20">
          <div className="max-w-4xl mx-auto px-5 text-center text-white">
            <div className="flex justify-center gap-2 mb-4 text-xs font-mono">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">
                {v.emoji} {v.sector.toUpperCase()}
              </span>
            </div>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4 leading-tight">
              IA para {v.sector}s en España
            </h1>
            <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
              8 agentes IA especializados en {v.sector.toLowerCase()}. Desde 79€/mes. 14 días gratis.
            </p>
            <Link href="/diagnostico" className="btn-mustard text-lg">{v.cta} →</Link>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-5xl mx-auto px-5">
            <h2 className="font-stencil text-3xl md:text-4xl mb-8 text-center">
              Disponible en {CIUDADES.length} ciudades
            </h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {CIUDADES.map((c) => (
                <Link
                  key={c.slug}
                  href={`/${basePath}/${c.slug}`}
                  className="card-hard p-4 hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform bg-white"
                >
                  <div className="text-2xl mb-1">{v.emoji}</div>
                  <div className="font-stencil text-xl">{c.nombre}</div>
                  <div className="text-xs text-black/60">{c.provincia}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 border-t-[3px] border-black bg-[color:var(--mustard)]">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <h2 className="font-stencil text-3xl md:text-5xl mb-4">¿Tu ciudad no está?</h2>
            <p className="text-lg mb-8">
              Damos servicio en toda España. Pide diagnóstico gratis y te activamos en 24h.
            </p>
            <Link href="/diagnostico" className="btn-mustard bg-black text-[color:var(--mustard)] hover:bg-[color:var(--red)] hover:text-white inline-block">
              DIAGNÓSTICO GRATIS →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
