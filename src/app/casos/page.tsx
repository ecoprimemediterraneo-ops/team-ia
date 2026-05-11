import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Casos de Éxito · AI-Team | Resultados reales con agentes IA",
  description: "Descubre cómo clínicas dentales, peluquerías y restaurantes han automatizado su marketing con AI-Team. Casos reales con métricas reales.",
};

const casos = [
  {
    vertical: "🦷 Clínica Dental",
    negocio: "Clínica DentAll",
    ciudad: "Málaga",
    foto: "/avatars/rocio.png",
    color: "#e8f4f8",
    tiempo: "Usando AI-Team 4 meses",
    quote: "Antes perdíamos 3-4 citas a la semana porque nadie contestaba el WhatsApp por la noche. Ahora Pablo contesta solo y las citas no se caen.",
    autor: "Dr. Ramírez, director clínica",
    antes: [
      "WhatsApp sin contestar fuera de horario",
      "30% de no-shows sin aviso previo",
      "0 reseñas nuevas en Google ese trimestre",
      "Presupuestos enviados sin seguimiento",
    ],
    despues: [
      "Pablo contesta en <2 min 24/7",
      "No-shows reducidos al 8%",
      "+47 reseñas Google en 4 meses (4.8★)",
      "Rocío hace seguimiento automático de presupuestos",
    ],
    metricas: [
      { label: "Citas recuperadas", valor: "+22/mes" },
      { label: "Reseñas Google", valor: "+47" },
      { label: "No-shows", valor: "−73%" },
    ],
  },
  {
    vertical: "💇‍♀️ Peluquería",
    negocio: "Salón Aura",
    ciudad: "Marbella",
    foto: "/avatars/marta.png",
    color: "#fdf4e8",
    tiempo: "Usando AI-Team 3 meses",
    quote: "Marta nos lleva Instagram desde hace 3 meses sin que yo toque el móvil. El sábado antes era un caos de mensajes, ahora Pablo los filtra todos.",
    autor: "Sofía, propietaria",
    antes: [
      "Instagram sin publicar durante semanas",
      "Mensajes WA acumulados el sábado",
      "Clientas que no vuelven sin recordatorio",
      "Sin tiempo para hacer seguimiento",
    ],
    despues: [
      "3 posts semanales en Instagram + Stories",
      "Pablo filtra y responde WA en segundos",
      "Eva envía recordatorio a clientas cada 6 semanas",
      "+28% clientes que vuelven vs. trimestre anterior",
    ],
    metricas: [
      { label: "Seguidores IG", valor: "+340" },
      { label: "Retención clientas", valor: "+28%" },
      { label: "Horas/sem ahorradas", valor: "8h" },
    ],
  },
  {
    vertical: "🍽️ Restaurante",
    negocio: "Taberna El Puerto",
    ciudad: "Fuengirola",
    foto: "/avatars/lucia.png",
    color: "#f8f0e8",
    tiempo: "Usando AI-Team 2 meses",
    quote: "En verano el 40% de nuestros clientes son turistas extranjeros. Pablo les contesta en inglés y les confirma la reserva solo. Ya no perdemos mesas.",
    autor: "Javier, jefe de sala",
    antes: [
      "Turistas que llamaban y nadie atendía en inglés",
      "Reservas de WhatsApp que llegaban a deshora",
      "TripAdvisor sin respuestas en 6 meses",
      "Google Maps con fotos antiguas",
    ],
    despues: [
      "Pablo atiende en inglés, alemán y francés",
      "Reservas gestionadas 24/7 por WhatsApp",
      "Rocío responde cada reseña en 24h",
      "Marta publica fotos de platos cada semana",
    ],
    metricas: [
      { label: "Reservas online", valor: "+35%" },
      { label: "Reseñas respondidas", valor: "100%" },
      { label: "Rating TripAdvisor", valor: "4.7★" },
    ],
  },
];

export default function CasosPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="bg-[color:var(--olive)] text-white py-16 border-b-[6px] border-[color:var(--red)]">
          <div className="max-w-5xl mx-auto px-5 text-center">
            <div className="inline-block bg-[color:var(--mustard)] text-black text-xs font-mono font-bold tracking-widest px-3 py-1 mb-6">
              RESULTADOS REALES
            </div>
            <h1 className="font-stencil text-4xl sm:text-6xl md:text-7xl mb-6">
              CASOS DE ÉXITO
            </h1>
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
              Negocios como el tuyo que ya tienen a los 6 agentes trabajando.
              Métricas reales, nombres cambiados por privacidad.
            </p>
          </div>
        </section>

        <section className="py-20 bg-[color:var(--cream)]">
          <div className="max-w-5xl mx-auto px-5 space-y-16">
            {casos.map((c, i) => (
              <article key={i} className="card-hard overflow-hidden">
                <div className="p-2 bg-[color:var(--olive)] text-white text-xs font-mono font-bold tracking-widest">
                  {c.vertical} · {c.ciudad} · {c.tiempo}
                </div>
                <div className="p-6 md:p-8" style={{ background: c.color }}>
                  <h2 className="font-stencil text-3xl md:text-4xl mb-6">{c.negocio}</h2>

                  <blockquote className="border-l-4 border-[color:var(--red)] pl-5 mb-6">
                    <p className="text-lg md:text-xl italic text-black/80">&ldquo;{c.quote}&rdquo;</p>
                    <footer className="mt-2 text-sm font-bold text-black/60">— {c.autor}</footer>
                  </blockquote>

                  <div className="grid sm:grid-cols-3 gap-4 mb-8">
                    {c.metricas.map((m) => (
                      <div key={m.label} className="card-hard p-4 bg-white text-center">
                        <div className="font-stencil text-4xl text-[color:var(--red)]">{m.valor}</div>
                        <div className="text-xs font-mono text-black/60 mt-1">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <div className="font-bold text-[color:var(--red)] mb-3 font-mono text-sm uppercase tracking-wider">Antes de AI-Team</div>
                      <ul className="space-y-2">
                        {c.antes.map((a, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm">
                            <span className="text-[color:var(--red)] font-bold shrink-0">✗</span>
                            <span className="text-black/70">{a}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-bold text-green-700 mb-3 font-mono text-sm uppercase tracking-wider">Con AI-Team</div>
                      <ul className="space-y-2">
                        {c.despues.map((d, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm">
                            <span className="text-green-700 font-bold shrink-0">✓</span>
                            <span className="text-black/70">{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="py-16 bg-[color:var(--red)] text-white text-center border-t-[6px] border-black">
          <div className="max-w-2xl mx-auto px-5">
            <h2 className="font-stencil text-4xl md:text-5xl mb-4">¿Tu negocio es el siguiente?</h2>
            <p className="text-lg mb-8 text-white/80">Plazas fundadoras a 39,90 €/mes. Precio para siempre.</p>
            <a href="/#waitlist" className="btn-mustard text-lg">Reclutar mi equipo →</a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
