import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Casos · AI-Team",
  description:
    "Estamos lanzando con 20 fundadores beta. Los primeros casos reales se publicarán aquí en los próximos meses.",
  alternates: { canonical: "https://aiteam.marketing/casos" },
};

export default function CasosPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-20 border-b-[3px] border-black">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <span className="inline-block bg-black text-[color:var(--mustard)] px-3 py-1 text-xs font-mono font-bold tracking-widest mb-4">
              BETA EN MARCHA
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-6 leading-tight">
              Los primeros casos<br />reales, en camino
            </h1>
            <p className="text-lg text-black/70 max-w-2xl mx-auto mb-3">
              Estamos lanzando con <strong>20 fundadores beta</strong> el sistema operativo de su negocio. Los primeros resultados reales se publicarán aquí en los próximos meses, con métricas verificables y nombre del negocio.
            </p>
            <p className="text-sm text-black/50 max-w-xl mx-auto">
              Sin testimonios inventados. Sin números inflados. Cuando un cliente nos autorice a publicar su caso, lo subimos aquí tal cual.
            </p>
          </div>
        </section>

        <section className="py-16 bg-[color:var(--cream)] border-b-[3px] border-black">
          <div className="max-w-3xl mx-auto px-5">
            <h2 className="font-stencil text-3xl md:text-4xl mb-6">
              ¿Quieres ser uno de ellos?
            </h2>
            <p className="text-base text-black/70 mb-8 leading-relaxed">
              Las 20 plazas fundadoras incluyen el sistema operativo completo de tu negocio: 6 meses gratis sin tarjeta y precio fundador congelado para siempre. A cambio te pedimos feedback honesto y, si los resultados son buenos, autorización para publicar tu caso aquí.
            </p>
            <p className="text-sm text-black/50 mb-8 leading-relaxed">
              El sistema detecta la oportunidad y ejecuta las acciones que tengas autorizadas.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/beta"
                className="btn-mustard inline-block"
              >
                Pide tu demo →
              </a>
              <a
                href="/precios"
                className="border-[3px] border-black px-5 py-3 font-bold uppercase tracking-widest text-sm hover:bg-black hover:text-[color:var(--mustard)] transition-colors"
              >
                Ver planes y precios
              </a>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-3xl mx-auto px-5 grid sm:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="font-stencil text-4xl text-[color:var(--red)] mb-2">20</div>
              <div className="font-bold mb-1">plazas fundadoras</div>
              <p className="text-black/60">Cuando se agoten, abren a precio normal.</p>
            </div>
            <div>
              <div className="font-stencil text-4xl text-[color:var(--red)] mb-2">6</div>
              <div className="font-bold mb-1">meses gratis</div>
              <p className="text-black/60">Sin tarjeta. Sin permanencia. Cancela cuando quieras.</p>
            </div>
            <div>
              <div className="font-stencil text-4xl text-[color:var(--red)] mb-2">0</div>
              <div className="font-bold mb-1">testimonios inflados</div>
              <p className="text-black/60">Solo casos reales y verificables. Cuando los haya.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
