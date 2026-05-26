import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { type CiudadData, CIUDADES, type VerticalCiudad } from "@/lib/ciudades";

type Props = {
  ciudad: CiudadData;
  vertical: VerticalCiudad;
  basePath: string; // "dentistas" | "fisioterapeutas" | etc
  agentes?: { emoji: string; name: string; desc: string }[];
  socialProof?: string;
};

const AGENTES_DEFAULT = (ciudadNombre: string) => [
  { emoji: "💬", name: "Pablo", desc: `Contesta WhatsApps en ${ciudadNombre} en 12 segundos, 24/7` },
  { emoji: "⭐", name: "Rocío", desc: "Pide reseñas tras cada cita y responde Google en <24h" },
  { emoji: "📧", name: "Eva", desc: "Manda recordatorios, secuencias y reactiva inactivos" },
  { emoji: "📬", name: "Lucía", desc: "Gestiona tu email y resume bandeja cada mañana" },
  { emoji: "📸", name: "Marta", desc: "Publica en Instagram y LinkedIn con tu tono" },
  { emoji: "📞", name: "Carmen", desc: `Atiende llamadas en español e inglés en ${ciudadNombre}` },
  { emoji: "🕵️", name: "Sergio", desc: "Vigila a tu competencia local 24/7" },
  { emoji: "🔍", name: "Diana", desc: "Audita tu negocio gratis cada mes" },
];

export default function SectorCiudadView({ ciudad, vertical, basePath, agentes, socialProof }: Props) {
  const v = vertical;
  const ag = agentes || AGENTES_DEFAULT(ciudad.nombre);

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
                Con más de <strong>{ciudad.population} habitantes</strong>, los negocios de {v.sector.toLowerCase()} en {ciudad.nombre} compiten por los mismos clientes
                y el que mejor contesta y mejor presencia digital tiene, gana.
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

        {/* 8 agentes */}
        <section className="py-16 bg-[color:var(--cream)] border-b-[3px] border-black">
          <div className="max-w-5xl mx-auto px-5 text-center">
            <h2 className="font-stencil text-3xl md:text-4xl mb-4">
              8 agentes IA trabajando por tu {v.sector.toLowerCase()} en {ciudad.nombre}
            </h2>
            <p className="text-black/70 mb-10 max-w-2xl mx-auto">
              Cada uno especializado en una tarea. Trabajan en cadena, 24/7, sin vacaciones.
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-left">
              {ag.map((a) => (
                <div key={a.name} className="card-hard p-4">
                  <div className="text-2xl mb-2">{a.emoji}</div>
                  <div className="font-stencil text-lg mb-1">{a.name}</div>
                  <p className="text-xs text-black/70">{a.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Prueba social */}
        <section className="py-12 border-b-[3px] border-black bg-black text-white">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <p className="font-stencil text-2xl md:text-3xl mb-2">
              &quot;{socialProof || `En 30 días dejamos de perder clientes por no contestar a tiempo`}&quot;
            </p>
            <p className="text-white/60 text-sm">— Negocio piloto, {ciudad.nombre}</p>
          </div>
        </section>

        {/* CTA */}
        <section id="cta" className="py-16 bg-[color:var(--cream)]">
          <div className="max-w-2xl mx-auto px-5 text-center">
            <h2 className="font-stencil text-3xl md:text-4xl mb-2">
              Diagnóstico gratis para {v.sector.toLowerCase()} de {ciudad.nombre}
            </h2>
            <p className="text-black/70 mb-6">Diana audita tu negocio en 2 minutos. Sin tarjeta. Sin compromiso.</p>
            <a href="/diagnostico" className="btn-mustard text-lg inline-block">{v.cta} →</a>
            <p className="text-sm text-black/60 mt-3">Pack desde 79€/mes · 14 días gratis · Precio fundador para siempre</p>
          </div>
        </section>

        {/* Otras ciudades */}
        <section className="py-10 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-4xl mx-auto px-5">
            <p className="text-xs font-mono text-black/50 mb-3 uppercase tracking-widest">También disponible en</p>
            <div className="flex flex-wrap gap-2">
              {CIUDADES.filter((c) => c.slug !== ciudad.slug).map((c) => (
                <a
                  key={c.slug}
                  href={`/${basePath}/${c.slug}`}
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
