import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Packs from "@/components/Packs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Precios — Desde 79€/mes",
  description:
    "Planes Local, Digital, Élite y Pro. Precio fundador para siempre. 14 días gratis, sin tarjeta, sin permanencia.",
  alternates: { canonical: "https://aiteam.marketing/precios" },
};

const features: { label: string; local: string | boolean; digital: string | boolean; elite: string | boolean; pro: string | boolean }[] = [
  { label: "Pablo — WhatsApp 24/7", local: true, digital: false, elite: true, pro: true },
  { label: "Carmen — Llamadas entrantes", local: true, digital: false, elite: true, pro: true },
  { label: "Rocío — Reseñas Google", local: true, digital: false, elite: true, pro: true },
  { label: "Lucía — Correo y calendario", local: false, digital: true, elite: true, pro: true },
  { label: "Marta — Redes sociales", local: false, digital: true, elite: true, pro: true },
  { label: "Eva — Email marketing", local: false, digital: true, elite: true, pro: true },
  { label: "Sergio — Inteligencia competitiva", local: false, digital: false, elite: false, pro: true },
  { label: "Diana — Diagnóstico continuo", local: false, digital: false, elite: false, pro: true },
  { label: "Onboarding 1:1", local: false, digital: false, elite: false, pro: true },
  { label: "Soporte", local: "Email", digital: "Email", elite: "Prioritario", pro: "Directo" },
  { label: "Período de prueba", local: "14 días", digital: "14 días", elite: "14 días", pro: "14 días" },
  { label: "Permanencia", local: "Ninguna", digital: "Ninguna", elite: "Ninguna", pro: "Ninguna" },
];

const faq = [
  {
    q: "¿Puedo cambiar de plan más adelante?",
    a: "Sí. Subes o bajas de plan en un click desde tu panel. El cambio se prorratea automáticamente.",
  },
  {
    q: "¿Qué es el precio fundador?",
    a: "Los primeros 100 negocios mantienen su precio fundador para siempre, incluso si subimos las tarifas. No expira mientras tu suscripción siga activa.",
  },
  {
    q: "¿Hay coste de instalación?",
    a: "No. En los planes Local, Digital y Élite el alta es self-service. Solo el plan Pro incluye onboarding 1:1 (sin coste extra).",
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
              PRECIO FUNDADOR · 100 PLAZAS
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4">Precios sin sorpresas</h1>
            <p className="text-lg text-black/70 max-w-2xl mx-auto">
              Desde 79€/mes. 14 días gratis. Sin tarjeta para empezar. Sin permanencia. Cambia de plan cuando quieras.
            </p>
          </div>
        </section>

        <Packs />

        <section className="py-20 border-t-[3px] border-black bg-white">
          <div className="max-w-6xl mx-auto px-5">
            <h2 className="font-stencil text-3xl md:text-5xl mb-8">Comparativa de planes</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-2 border-black text-sm">
                <thead>
                  <tr className="bg-black text-[color:var(--mustard)]">
                    <th className="text-left px-4 py-3 font-mono text-xs tracking-widest">FUNCIÓN</th>
                    <th className="px-4 py-3 font-mono text-xs tracking-widest">LOCAL</th>
                    <th className="px-4 py-3 font-mono text-xs tracking-widest">DIGITAL</th>
                    <th className="px-4 py-3 font-mono text-xs tracking-widest bg-[color:var(--mustard)] text-black">ÉLITE</th>
                    <th className="px-4 py-3 font-mono text-xs tracking-widest">PRO</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((f, i) => (
                    <tr key={f.label} className={i % 2 === 0 ? "bg-[color:var(--cream)]/40" : "bg-white"}>
                      <td className="px-4 py-3 font-semibold">{f.label}</td>
                      {(["local", "digital", "elite", "pro"] as const).map((p) => {
                        const v = f[p];
                        return (
                          <td key={p} className="px-4 py-3 text-center">
                            {typeof v === "boolean" ? (
                              v ? <span className="text-[color:var(--red)] font-bold text-lg">✓</span> : <span className="text-black/20">—</span>
                            ) : (
                              <span className="text-xs">{v}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

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
