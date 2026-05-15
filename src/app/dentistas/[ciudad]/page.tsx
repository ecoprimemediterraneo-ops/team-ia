import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getCiudad, CIUDADES, VERTICALS } from "@/lib/ciudades";

export async function generateStaticParams() {
  return CIUDADES.map((c) => ({ ciudad: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ ciudad: string }> }): Promise<Metadata> {
  const { ciudad: slug } = await params;
  const ciudad = getCiudad(slug);
  if (!ciudad) return {};
  const v = VERTICALS.dentistas;
  return {
    title: `${v.titulo(ciudad.nombre)} | AI-Team`,
    description: v.descripcion(ciudad.nombre, ciudad.demonym),
    alternates: { canonical: `https://aiteam.marketing/dentistas/${slug}` },
    openGraph: {
      title: v.titulo(ciudad.nombre),
      description: v.descripcion(ciudad.nombre, ciudad.demonym),
    },
  };
}

export default async function DentistasCiudadPage({ params }: { params: Promise<{ ciudad: string }> }) {
  const { ciudad: slug } = await params;
  const ciudad = getCiudad(slug);
  if (!ciudad) notFound();
  const v = VERTICALS.dentistas;

  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* Hero local */}
        <section className="brick border-b-[6px] border-[color:var(--red)] py-20">
          <div className="max-w-4xl mx-auto px-5 text-center text-white">
            <div className="flex flex-wrap justify-center gap-2 mb-6 text-xs font-mono">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">
                {v.emoji} {v.sector.toUpperCase()}
              </span>
              <span className="border-2 border-white text-white px-2 py-1 font-bold tracking-widest">
                {ciudad.nombre.toUpperCase()}
              </span>
            </div>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4 leading-tight">
              {v.titulo(ciudad.nombre)}
            </h1>
            <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
              {v.descripcion(ciudad.nombre, ciudad.demonym)}
            </p>
            <a href="#cta" className="btn-mustard text-lg">{v.cta} →</a>
          </div>
        </section>

        {/* Contexto local */}
        <section className="py-12 border-b-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-4xl mx-auto px-5">
            <div className="card-hard p-5 bg-[color:var(--mustard)]/10">
              <p className="text-sm">
                <strong>{ciudad.nombre}</strong> es {ciudad.highlight}.
                Con más de <strong>{ciudad.population} habitantes</strong>, las clínicas dentales de {ciudad.nombre} compiten por los mismos pacientes
                y el que mejor contesta y mejor presencia en Google tiene, gana.
              </p>
            </div>
          </div>
        </section>

        {/* Dolores */}
        <section className="py-16 border-b-[3px] border-black">
          <div className="max-w-4xl mx-auto px-5">
            <h2 className="font-stencil text-3xl md:text-4xl mb-8 text-center">
              ¿Te suena alguno de estos problemas?
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {v.pains.map((pain, i) => (
                <div key={i} className="card-hard p-4 flex items-start gap-3">
                  <span className="text-[color:var(--red)] font-stencil text-2xl">✗</span>
                  <p className="text-sm">{pain}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Los 6 agentes operativos */}
        <section className="py-16 bg-[color:var(--cream)] border-b-[3px] border-black">
          <div className="max-w-4xl mx-auto px-5 text-center">
            <h2 className="font-stencil text-3xl md:text-4xl mb-4">
              8 agentes trabajando por tu clínica en {ciudad.nombre}
            </h2>
            <p className="text-black/70 mb-10 max-w-2xl mx-auto">
              Cada uno especializado en una tarea. Trabajan en cadena, 24/7, sin vacaciones.
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 text-left">
              {[
                { emoji: "💬", name: "Pablo", desc: `Contesta WhatsApps de pacientes de ${ciudad.nombre} en 12 segundos` },
                { emoji: "⭐", name: "Rocío", desc: "Pide reseñas tras cada cita y responde las nuevas en Google" },
                { emoji: "📧", name: "Eva", desc: "Manda recordatorios, seguimientos de presupuesto y reactiva inactivos" },
                { emoji: "📬", name: "Lucía", desc: "Gestiona tu email y resume la bandeja cada mañana" },
                { emoji: "📸", name: "Marta", desc: "Publica en Instagram y Facebook con contenido de tu clínica" },
                { emoji: "📞", name: "Carmen", desc: `Atiende llamadas en español e inglés — ideal para ${ciudad.nombre}` },
              ].map((a) => (
                <div key={a.name} className="card-hard p-4">
                  <div className="text-2xl mb-2">{a.emoji}</div>
                  <div className="font-stencil text-lg mb-1">{a.name}</div>
                  <p className="text-xs text-black/70">{a.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Prueba social local */}
        <section className="py-12 border-b-[3px] border-black bg-black text-white">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <p className="font-stencil text-2xl md:text-3xl mb-2">
              "En 30 días redujimos los no-shows un 40% y subimos de 4.2 a 4.7 en Google"
            </p>
            <p className="text-white/60 text-sm">— Clínica piloto, Costa del Sol</p>
          </div>
        </section>

        {/* CTA */}
        <section id="cta" className="py-16 bg-[color:var(--cream)]">
          <div className="max-w-2xl mx-auto px-5">
            <div className="text-center mb-8">
              <h2 className="font-stencil text-3xl md:text-4xl mb-2">
                30 días gratis para clínicas de {ciudad.nombre}
              </h2>
              <p className="text-black/70">Sin tarjeta. Sin permanencia. Precio fundador 79€/mes después.</p>
            </div>
            <a href={`/dentistas#waitlist-dental`} className="btn-mustard text-lg inline-block">{v.cta} →</a>
            <p className="text-sm text-black/60 mt-3">Sin tarjeta · 30 días gratis · Precio fundador 79€/mes después</p>
          </div>
        </section>

        {/* Links a otras ciudades */}
        <section className="py-10 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-4xl mx-auto px-5">
            <p className="text-xs font-mono text-black/50 mb-3 uppercase tracking-widest">También disponible en</p>
            <div className="flex flex-wrap gap-2">
              {CIUDADES.filter((c) => c.slug !== ciudad.slug).map((c) => (
                <a
                  key={c.slug}
                  href={`/dentistas/${c.slug}`}
                  className="text-xs border-2 border-black px-3 py-1 font-mono hover:bg-black hover:text-white transition-colors"
                >
                  {v.emoji} {c.nombre}
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
