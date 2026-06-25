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
  const v = VERTICALS.peluquerias;
  return {
    title: `${v.titulo(ciudad.nombre)} | AI-Team`,
    description: v.descripcion(ciudad.nombre, ciudad.demonym),
    alternates: { canonical: `https://aiteam.marketing/peluquerias/${slug}` },
    openGraph: {
      title: v.titulo(ciudad.nombre),
      description: v.descripcion(ciudad.nombre, ciudad.demonym),
    },
  };
}

export default async function PeluqueriasCiudadPage({ params }: { params: Promise<{ ciudad: string }> }) {
  const { ciudad: slug } = await params;
  const ciudad = getCiudad(slug);
  if (!ciudad) notFound();
  const v = VERTICALS.peluquerias;

  return (
    <>
      <Navbar />
      <main className="flex-1">
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

        <section className="py-12 border-b-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-4xl mx-auto px-5">
            <div className="card-hard p-5 bg-[color:var(--mustard)]/10">
              <p className="text-sm">
                <strong>{ciudad.nombre}</strong> es {ciudad.highlight}.
                Las peluquerías y salones de belleza de {ciudad.nombre} tienen una competencia feroz —
                y tus competidores ya están automatizados. Los clientes esperan respuesta al instante:
                sin un sistema que gestione tu WhatsApp y tu Instagram solo, te quedas fuera.
              </p>
            </div>
          </div>
        </section>

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

        <section className="py-16 bg-[color:var(--cream)] border-b-[3px] border-black">
          <div className="max-w-4xl mx-auto px-5 text-center">
            <h2 className="font-stencil text-3xl md:text-4xl mb-4">
              Un solo sistema para tu salón en {ciudad.nombre}
            </h2>
            <p className="text-sm text-black/70 max-w-2xl mx-auto mb-2">
              No son herramientas sueltas: es un único sistema integrado que se adelanta y actúa solo.
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 text-left mt-8">
              {[
                { emoji: "💬", name: "WhatsApp", desc: "Contesta WhatsApps de clientas y agenda citas al instante" },
                { emoji: "⭐", name: "Reseñas de Google", desc: "Pide reseñas a tus clientas y responde las de Google" },
                { emoji: "✉️", name: "Email marketing", desc: "Reactiva clientas que llevan 3 meses sin venir" },
                { emoji: "📬", name: "Correo y agenda", desc: "Gestiona tu bandeja y filtra lo importante" },
                { emoji: "📱", name: "Instagram y redes", desc: `Publica reels y posts en Instagram cada semana` },
                { emoji: "📞", name: "Llamadas", desc: "Atiende llamadas cuando estás con una clienta" },
              ].map((a) => (
                <div key={a.name} className="card-hard p-4">
                  <div className="text-2xl mb-2">{a.emoji}</div>
                  <div className="font-stencil text-lg mb-1">{a.name}</div>
                  <p className="text-xs text-black/70">{a.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 font-display text-xl md:text-2xl text-[color:var(--red)]">
              Mientras otros esperan a que les escribas, tu sistema ya actuó.
            </p>
          </div>
        </section>

        <section className="py-12 border-b-[3px] border-black bg-black text-white">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <p className="font-stencil text-2xl md:text-3xl mb-2">
              Objetivo estimado: más reseñas en Google y un WhatsApp del sábado bajo control.
            </p>
            <p className="text-white/60 text-sm">— Estimación objetivo en los primeros meses</p>
          </div>
        </section>

        <section id="cta" className="py-16 bg-[color:var(--cream)]">
          <div className="max-w-2xl mx-auto px-5 text-center">
            <h2 className="font-stencil text-3xl md:text-4xl mb-2">
              6 meses gratis para salones de {ciudad.nombre}
            </h2>
            <p className="text-black/70 mb-6">20 plazas · sin tarjeta · sin permanencia · 149€/mes fundador para siempre.</p>
            <a href="/peluquerias#waitlist-pelu" className="btn-mustard text-lg">{v.cta} →</a>
          </div>
        </section>

        <section className="py-10 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-4xl mx-auto px-5">
            <p className="text-xs font-mono text-black/50 mb-3 uppercase tracking-widest">También disponible en</p>
            <div className="flex flex-wrap gap-2">
              {CIUDADES.filter((c) => c.slug !== ciudad.slug).map((c) => (
                <a key={c.slug} href={`/peluquerias/${c.slug}`}
                  className="text-xs border-2 border-black px-3 py-1 font-mono hover:bg-black hover:text-white transition-colors">
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
