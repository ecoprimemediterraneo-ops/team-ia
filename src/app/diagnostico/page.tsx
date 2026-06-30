import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DiagnosticoForm from "@/components/diagnostico/DiagnosticoForm";

export const metadata = {
  title: "Diagnóstico digital gratis — Auditoría con IA para tu negocio | AI-Team",
  description:
    "Una IA audita de verdad tu web, tu Instagram y tu forma de captar clientes, y te dice cuánto dinero se te escapa cada mes. Informe valorado en 499€, gratis en beta. Resultado al instante + informe completo por email.",
};

// Los 5 frentes que el sistema audita (cada uno con semáforo + sub-checks).
const FRENTES = [
  { emoji: "⚡", titulo: "Velocidad de respuesta", sub: "Cuánto tardas y qué pasa fuera de horario" },
  { emoji: "🖥️", titulo: "Tu web", sub: "SEO, contacto claro, captación y aviso legal (RGPD)" },
  { emoji: "📸", titulo: "Tu Instagram", sub: "Perfil, actividad y si convierte seguidores en clientes" },
  { emoji: "⭐", titulo: "Reseñas de Google", sub: "Cuántas tienes, cómo respondes y si las pides" },
  { emoji: "🎯", titulo: "Captación", sub: "Publicidad, newsletter y seguimiento de los que no compran" },
];

export default function DiagnosticoPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* ── GANCHO / HERO ─────────────────────────────────────────── */}
        <section className="py-20 border-b-[3px] border-black bg-[color:var(--ink)] text-white">
          <div className="max-w-4xl mx-auto px-5 text-center">
            <div className="flex items-center justify-center gap-3 mb-6 text-xs font-mono">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">
                DIAGNÓSTICO DIGITAL
              </span>
              <span className="border-2 border-[color:var(--mustard)] text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">
                HECHO POR IA
              </span>
            </div>

            {/* Ancla de valor: 499€ tachado → gratis */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <span className="font-stencil text-3xl md:text-4xl text-white/40 line-through decoration-[color:var(--red)] decoration-4">
                499€
              </span>
              <span className="font-stencil text-4xl md:text-5xl text-[color:var(--mustard)] rotate-[-3deg] inline-block">
                GRATIS EN BETA
              </span>
            </div>

            <h1 className="font-stencil text-4xl md:text-7xl leading-[0.95] mb-6">
              Descubre cuánto dinero<br />
              <span className="text-[color:var(--mustard)]">se te escapa cada mes</span>
            </h1>

            <p className="text-base md:text-xl text-white/80 max-w-2xl mx-auto">
              Una IA analiza de verdad tu web, tu Instagram y tu forma de atender y captar clientes.
              En 2 minutos te decimos qué tienes flojo, qué te está costando dinero y qué se arregla con el sistema.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3">
              <a href="#diag-form" className="btn-mustard text-lg">
                Quiero mi diagnóstico →
              </a>
              <p className="text-sm text-white/55">Resultado al instante en pantalla · informe completo por email · sin compromiso</p>
            </div>
          </div>
        </section>

        {/* ── QUÉ AUDITAMOS (5 frentes) ─────────────────────────────── */}
        <section className="py-16 border-b-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-6xl mx-auto px-5">
            <h2 className="font-stencil text-3xl md:text-5xl mb-3">Auditamos 5 frentes</h2>
            <p className="text-base text-black/65 max-w-2xl mb-10">
              No es un test genérico: miramos lo que de verdad mueve clientes en un negocio como el tuyo.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {FRENTES.map((f, i) => (
                <article key={f.titulo} className="card-hard p-5 bg-white">
                  <div className="text-3xl mb-2">{f.emoji}</div>
                  <div className="text-[11px] font-mono text-black/40 mb-1">FRENTE {String(i + 1).padStart(2, "0")}</div>
                  <h3 className="font-bold text-base leading-tight mb-1">{f.titulo}</h3>
                  <p className="text-xs text-black/55 leading-snug">{f.sub}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── CÓMO FUNCIONA (3 pasos) ───────────────────────────────── */}
        <section className="py-14 border-b-[3px] border-black bg-white">
          <div className="max-w-5xl mx-auto px-5">
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { n: "1", t: "Cuéntanos lo tuyo", d: "Tu web, tu Instagram y 8 preguntas rápidas. 2 minutos." },
                { n: "2", t: "Adelanto al instante", d: "En pantalla ves tu semáforo por frente y el dinero que se escapa." },
                { n: "3", t: "Informe completo por email", d: "El detalle, con qué falla y cómo se arregla, te llega al correo." },
              ].map((p) => (
                <div key={p.n} className="flex items-start gap-4">
                  <span className="font-stencil text-5xl text-[color:var(--red)] leading-none">{p.n}</span>
                  <div>
                    <h3 className="font-bold text-lg">{p.t}</h3>
                    <p className="text-sm text-black/65 mt-1">{p.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FORMULARIO ────────────────────────────────────────────── */}
        <section id="diag-form" className="py-20 bg-[color:var(--cream)]">
          <div className="max-w-3xl mx-auto px-5">
            <div className="mb-10">
              <h2 className="font-stencil text-4xl md:text-6xl mb-3">Tu diagnóstico</h2>
              <p className="text-base text-black/65">
                Rellena esto y dale a <strong>Ver mi diagnóstico</strong>. Cuanto más sincero, más útil te sale.
              </p>
            </div>
            <DiagnosticoForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
