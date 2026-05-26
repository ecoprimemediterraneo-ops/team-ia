import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sobre AI-Team — Por qué automatizamos negocios con 8 empleados IA",
  description: "Manifiesto fundador: por qué montamos AI-Team, qué creemos, cómo trabajamos.",
  alternates: { canonical: "https://aiteam.marketing/sobre-nosotros" },
};

const manifiesto = [
  {
    titulo: "Las PYMES pierden 45.000€/año en cosas que no hacen",
    body: "Llevamos 7 meses auditando negocios. La media pierde 14.000€ al año por no contestar WhatsApp a tiempo, 8.400€ por reseñas mal gestionadas, 12.000€ por llamadas perdidas. Suma: 45.000€ que se van al competidor de al lado. Empezamos AI-Team para tapar esas fugas sin contratar a 3 personas más.",
  },
  {
    titulo: "Las agencias de marketing tradicionales no escalan a PYMES",
    body: "Una agencia que de verdad cubre los 6 canales (WhatsApp, llamadas, reseñas, redes, email, competencia) cuesta 1.500-2.500€/mes. Un negocio que factura 15-30k€/mes no puede pagar eso de marketing. Por eso el 80% acaba haciendo nada o haciéndolo mal con su sobrina como community manager.",
  },
  {
    titulo: "La IA no sustituye humanos. Sustituye 'lo hago cuando pueda'",
    body: "Marta no reemplaza a tu community manager si lo tienes y funciona. Reemplaza al 'esta semana no he podido publicar nada'. Pablo no reemplaza a tu recepcionista. Reemplaza al 'lo veo mañana cuando abra'. El humano queda libre para lo que realmente requiere humano.",
  },
  {
    titulo: "Tú apruebas todo. Siempre.",
    body: "Ningún post se publica sin tu OK. Ningún email sale sin tu visto bueno. Ninguna cita se cierra sin verificar. Por eso AI-Team funciona donde fallan los bots de plantilla: porque tú sigues mandando, los agentes ejecutan.",
  },
  {
    titulo: "Honestidad antes que venta",
    body: "Si Diana detecta que tu negocio no necesita AI-Team todavía, te lo dice. Si una agencia te conviene más, te lo decimos. Si tu cuello de botella es el local, no el digital, te lo decimos. Vender mal una vez = perder un cliente para siempre.",
  },
];

export default function SobreNosotrosPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-20 border-b-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-4xl mx-auto px-5">
            <span className="inline-block bg-black text-[color:var(--mustard)] px-3 py-1 text-xs font-mono font-bold tracking-widest mb-4">
              MANIFIESTO · 5 CREENCIAS
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-6 leading-tight">
              Por qué AI-Team existe
            </h1>
            <p className="text-xl text-black/70 leading-relaxed">
              Mi padre tiene una clínica dental en Málaga. Hace 30 años. Trabaja 11 horas, llega a casa, cena, y a las 22:30 sigue contestando WhatsApps. Su agencia de redes le cuesta 600€/mes y publica 1 post a la semana. AI-Team nació de ahí.
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-3xl mx-auto px-5 space-y-12">
            {manifiesto.map((m, i) => (
              <article key={i} className="card-hard p-6 bg-white">
                <div className="text-[color:var(--red)] font-stencil text-5xl mb-3">{String(i + 1).padStart(2, "0")}</div>
                <h2 className="font-stencil text-2xl md:text-3xl mb-3 leading-tight">{m.titulo}</h2>
                <p className="text-black/70 leading-relaxed">{m.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="py-16 border-t-[3px] border-black bg-white">
          <div className="max-w-4xl mx-auto px-5">
            <h2 className="font-stencil text-3xl md:text-5xl mb-8">El equipo</h2>
            <div className="card-hard p-6 bg-[color:var(--cream)]/40">
              <div className="flex items-start gap-4 flex-wrap">
                <div>
                  <div className="font-stencil text-2xl">Cristóbal Serrano</div>
                  <div className="text-sm text-black/60 mb-3">Fundador & CEO</div>
                  <p className="text-sm">
                    Empresario digital con experiencia en SaaS, marketplaces y trading algorítmico. Hace 7 meses dejó de tener Excels de ideas y empezó a construir AI-Team. Hoy son 9 agentes IA operativos.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-black/60 mt-6 leading-relaxed">
              No somos un equipo grande. Somos un fundador con manos de programador, una visión clara y una obsesión por que las PYMES dejen de perder dinero en cosas que la IA puede hacer mejor que cualquier humano cansado a las 22:30.
            </p>
          </div>
        </section>

        <section className="py-16 border-t-[3px] border-black bg-[color:var(--mustard)]">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <h2 className="font-stencil text-3xl md:text-5xl mb-4">Empieza por el diagnóstico</h2>
            <p className="text-lg mb-8">
              Diana audita tu negocio gratis en 2 minutos. Sin tarjeta. Sin compromiso. Y si no te convence, sigues con lo que ya tienes.
            </p>
            <Link href="/diagnostico" className="btn-mustard bg-black text-[color:var(--mustard)] hover:bg-[color:var(--red)] hover:text-white inline-block">
              EMPEZAR DIAGNÓSTICO →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
