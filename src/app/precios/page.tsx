import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Packs from "@/components/Packs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Precios — Discover gratis · Local desde 79€/mes",
  description:
    "5 planes: Discover gratis, Local 79€, Digital 149€, Élite 249€, Pro 449€. 50 plazas beta · 6 meses gratis. Sin tarjeta para empezar.",
  alternates: { canonical: "https://aiteam.marketing/precios" },
};

const features: { label: string; discover: string | boolean; local: string | boolean; digital: string | boolean; elite: string | boolean; pro: string | boolean }[] = [
  { label: "Sergio — Vigila competidores", discover: "3 cuentas", local: "5 cuentas", digital: "10 cuentas", elite: "Ilimitado", pro: "Ilimitado" },
  { label: "Diana — Auditora", discover: "1 inicial", local: "Trimestral", digital: "Trimestral", elite: "Mensual", pro: "Mensual" },
  { label: "Tomás — Soporte IA 24/7", discover: true, local: true, digital: true, elite: true, pro: true },
  { label: "Pablo — WhatsApp 24/7", discover: false, local: true, digital: false, elite: true, pro: true },
  { label: "Rocío — Reseñas Google", discover: false, local: true, digital: false, elite: true, pro: true },
  { label: "Carmen — Recepcionista contestador", discover: false, local: "100 llamadas", digital: false, elite: "100 llamadas", pro: "500 llamadas" },
  { label: "Lucía — Correo y calendario", discover: false, local: false, digital: true, elite: true, pro: true },
  { label: "Marta — Redes sociales", discover: false, local: false, digital: true, elite: true, pro: true },
  { label: "Eva — Email marketing", discover: false, local: false, digital: "1.000 emails", elite: "1.000 emails", pro: "5.000 emails" },
  { label: "Carmen Pro — Reservas/agenda automática", discover: false, local: false, digital: false, elite: true, pro: true },
  { label: "Onboarding 1:1 con setup incluido", discover: false, local: false, digital: false, elite: false, pro: true },
  { label: "Multi-usuario", discover: false, local: false, digital: false, elite: false, pro: "Hasta 5" },
  { label: "Integración a medida con tu software", discover: false, local: false, digital: false, elite: false, pro: true },
  { label: "Soporte", discover: "IA", local: "IA + Email", digital: "IA + Email", elite: "Prioritario", pro: "WhatsApp directo" },
  { label: "Período gratuito (beta)", discover: "Siempre gratis", local: "6 meses", digital: "6 meses", elite: "6 meses", pro: "6 meses" },
  { label: "Permanencia", discover: "Ninguna", local: "Ninguna", digital: "Ninguna", elite: "Ninguna", pro: "Ninguna" },
];

const faq = [
  {
    q: "¿Puedo cambiar de plan más adelante?",
    a: "Sí. Subes o bajas de plan en un click desde tu panel. El cambio se prorratea automáticamente.",
  },
  {
    q: "¿Qué es el precio fundador?",
    a: "Los primeros 50 negocios beta mantienen su precio fundador para siempre, incluso si subimos las tarifas. No expira mientras tu suscripción siga activa.",
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
              PRECIO FUNDADOR · 50 PLAZAS BETA · 6 MESES GRATIS
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4">Precios sin sorpresas</h1>
            <p className="text-lg text-black/70 max-w-2xl mx-auto">
              Desde 79€/mes. 6 meses gratis. Sin tarjeta para empezar. Sin permanencia. Cambia de plan cuando quieras.
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
                    <th className="px-4 py-3 font-mono text-xs tracking-widest">DISCOVER</th>
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
                      {(["discover", "local", "digital", "elite", "pro"] as const).map((p) => {
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
