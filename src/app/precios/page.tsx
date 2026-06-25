import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Packs from "@/components/Packs";
import Comparador from "@/components/Comparador";
import MonthlyReportSection from "@/components/MonthlyReportSection";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Precios — El Sistema Operativo desde 149€/mes",
  description:
    "Un sistema único: 299€/mes con 50% de descuento fundador = 149€/mes. Gestión opcional +249€/mes. Precio fundador para siempre. 6 meses gratis, sin tarjeta, sin permanencia.",
  alternates: { canonical: "https://aiteam.marketing/precios" },
  openGraph: {
    title: "Precios — El Sistema Operativo desde 149€/mes",
    description:
      "299€/mes con 50% fundador = 149€/mes. Gestión opcional +249€/mes aparte. 6 meses gratis, sin tarjeta, sin permanencia.",
    url: "https://aiteam.marketing/precios",
    type: "website",
    locale: "es_ES",
    siteName: "AI-Team",
  },
};

const faq = [
  {
    q: "¿Puedo añadir o quitar la Gestión más adelante?",
    a: "Sí. El Sistema Operativo es el producto base (149€/mes fundador). La Gestión (+249€/mes) es opcional: la añades o la quitas en un click desde tu panel y se prorratea automáticamente.",
  },
  {
    q: "¿Qué es el precio fundador?",
    a: "El Sistema Operativo cuesta 299€/mes; los primeros 20 negocios entran con un 50% de descuento de por vida = 149€/mes. No expira mientras tu suscripción siga activa, aunque subamos las tarifas.",
  },
  {
    q: "¿Hay coste de instalación?",
    a: "No. El alta del sistema es self-service — el asistente de configuración te guía por sector paso a paso. Tardas unos 15 minutos.",
  },
  {
    q: "¿Necesito instalar algo o saber de tecnología?",
    a: "No. Reservas tu plaza en /beta, te damos de alta con tu email y un onboarding guiado paso a paso (15-20 min) para conectar tu WhatsApp Business, Gmail y Google Business. Sin código, sin configurar APIs raras.",
  },
  {
    q: "¿En qué idiomas trabaja?",
    a: "Español nativo (ES, MX, AR, CO, CL) e inglés. El sistema es bilingüe en sus guiones de llamada. Otros idiomas bajo demanda.",
  },
  {
    q: "¿Funciona con mi software actual (Gesden, ClinicCloud, etc.)?",
    a: "AI-Team vive 'al lado', no 'dentro' de tu software. Trabajamos con tu calendario (Google Calendar o Cal.com), tu WhatsApp Business y tu Gmail. Las integraciones directas con software vertical (Gesden, ClinicCloud, Treatwell, Booksy, TheFork…) se preparan bajo demanda — escríbenos a ventas.",
  },
  {
    q: "¿Qué pasa si cancelo?",
    a: "Cancelas con un click y dejas de pagar el siguiente ciclo. Tus datos quedan disponibles 30 días por si decides volver.",
  },
  {
    q: "¿El IVA está incluido?",
    a: "Los precios mostrados son sin IVA. La factura incluye el 21% según normativa española.",
  },
];

export default function PreciosPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-16 border-b-[3px] border-black">
          <div className="max-w-5xl mx-auto px-5 text-center">
            <span className="inline-block bg-black text-[color:var(--mustard)] px-3 py-1 text-xs font-mono font-bold tracking-widest mb-4">
              PRECIO FUNDADOR · 20 PLAZAS
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4">Precios sin sorpresas</h1>
            <p className="text-lg text-black/70 max-w-2xl mx-auto">
              El Sistema Operativo desde 149€/mes (50% fundador sobre 299€). 6 meses gratis. Sin tarjeta para empezar. Sin permanencia. Gestión opcional aparte.
            </p>
          </div>
        </section>

        <Packs />

        <Comparador hidePreciosLink />

        <MonthlyReportSection />

        <section className="py-20 border-t-[3px] border-black">
          <div className="max-w-3xl mx-auto px-5">
            <h2 className="font-stencil text-3xl md:text-5xl mb-8">Preguntas sobre precios</h2>
            <div className="space-y-4">
              {faq.map((item) => (
                <details key={item.q} className="card-hard p-5 group">
                  <summary className="cursor-pointer font-bold flex justify-between items-center">
                    {item.q}
                    <span className="text-[color:var(--red)] group-open:rotate-45 transition-transform text-2xl leading-none">+</span>
                  </summary>
                  <p className="mt-3 text-black/70 text-sm leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
            <div className="text-center mt-12">
              <a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" target="_blank" rel="noopener noreferrer" className="btn-mustard inline-block">
                ¿Dudas? Reserva 15 min →
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
