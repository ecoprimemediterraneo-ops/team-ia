import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BetaForm from "@/components/BetaForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Beta privada AI-Team — 50 plazas · 6 meses gratis",
  description:
    "Buscamos 50 negocios para nuestra beta privada: equipo IA completo, 6 meses gratis a cambio de feedback estructurado. Precio fundador 249€/mes congelado para siempre.",
  alternates: { canonical: "https://aiteam.marketing/beta" },
};

export default function BetaPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-16 border-b-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-4xl mx-auto px-5 text-center">
            <span className="inline-block bg-black text-[color:var(--mustard)] px-3 py-1 text-xs font-mono font-bold tracking-widest mb-4">
              🔒 BETA PRIVADA · PLAZAS LIMITADAS
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4 leading-[1.05]">
              Buscamos 50 negocios<br />que prueben AI-Team gratis<br />durante 3 meses
            </h1>
            <p className="text-lg text-black/70 max-w-2xl mx-auto mb-6">
              Activamos el equipo IA en su estado actual real
              (3 agentes operativos, 4 en beta funcional, 1 en desarrollo).
              A cambio: feedback semanal honesto para ayudarnos a pulir el producto.
              Si te sirve, precio fundador 249€/mes congelado para siempre.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono tracking-widest text-black/60">
              <span>✓ 3 MESES GRATIS</span>
              <span>·</span>
              <span>✓ SIN TARJETA</span>
              <span>·</span>
              <span>✓ ONBOARDING 1:1 CON EL FUNDADOR</span>
              <span>·</span>
              <span>✓ 50 PLAZAS</span>
            </div>
          </div>
        </section>

        {/* Lo que damos / lo que pedimos */}
        <section className="py-12 border-b-[3px] border-black">
          <div className="max-w-5xl mx-auto px-5 grid md:grid-cols-2 gap-6">
            <div className="card-hard p-6 bg-[color:var(--mustard)]/30">
              <div className="text-xs font-mono tracking-widest mb-2">LO QUE TE DAMOS</div>
              <h2 className="font-stencil text-2xl mb-4">Equipo IA en estado actual real</h2>
              <p className="text-xs text-black/70 mb-3">
                Te decimos la verdad de cada uno. Lo que está operativo y lo que está en alta:
              </p>
              <ul className="space-y-2 text-sm">
                <li>✅ <b>Diana</b> — auditoría digital completa (operativa)</li>
                <li>✅ <b>Eva</b> — email marketing real desde tu dominio (operativa)</li>
                <li>✅ <b>Sergio</b> — vigila a tus competidores cada noche (operativo)</li>
                <li>🟡 <b>Lucía</b> — Gmail real, borradores listos (Google verification en curso)</li>
                <li>🟡 <b>Marta</b> — genera posts + imagen + calendario (publicación auto: Meta App Review)</li>
                <li>🟡 <b>Pablo</b> — borradores WhatsApp con tu tono (alta Meta Business en curso)</li>
                <li>🟡 <b>Rocío</b> — respuestas a reseñas con tu estilo (Google Profile API en curso)</li>
                <li>🟠 <b>Carmen</b> — captura llamadas perdidas con voz natural (beta funcional, setup en días)</li>
              </ul>
              <p className="text-xs font-mono text-black/60 mt-4">
                Cero humo. 3 agentes 100% operativos, 4 en beta funcional, 1 en setup técnico. Por eso te lo damos GRATIS 3 meses.
              </p>
            </div>

            <div className="card-hard p-6">
              <div className="text-xs font-mono tracking-widest mb-2">LO QUE PEDIMOS</div>
              <h2 className="font-stencil text-2xl mb-4">Tu feedback honesto</h2>
              <ul className="space-y-2 text-sm">
                <li>· <b>1 llamada semanal de 30 min</b> en Zoom o WhatsApp, contándonos qué funciona y qué no</li>
                <li>· <b>1 formulario de feedback cada 2 semanas</b> (5 preguntas, 3 minutos)</li>
                <li>· Con tu permiso: <b>grabaciones de pantalla</b> cuando uses el dashboard, para mejorar UX</li>
                <li>· Permiso para usarte como <b>caso de éxito</b> (con tu nombre y logo) si los resultados son buenos</li>
                <li>· Probar al menos <b>3 agentes</b> de verdad, no solo mirar</li>
              </ul>
              <div className="mt-5 pt-5 border-t-2 border-black/20">
                <div className="text-xs font-mono tracking-widest mb-2">A PARTIR DEL MES 4</div>
                <p className="text-sm">
                  Si te ha servido: <b>249€/mes</b> (precio fundador congelado de por vida) en lugar de los 449€ que pagarán los demás.
                  Sin permanencia. Si no, te das de baja y mantienes los 6 meses gratis. Puedes exportar todos tus datos o pedir que los borremos.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Cómo va */}
        <section className="py-12 border-b-[3px] border-black bg-white">
          <div className="max-w-4xl mx-auto px-5">
            <h2 className="font-stencil text-3xl md:text-4xl mb-8 text-center">Cómo va la beta</h2>
            <div className="grid md:grid-cols-4 gap-4">
              {[
                { n: "1", t: "Rellenas el form", s: "2 min, sin compromiso" },
                { n: "2", t: "Hablamos 30 min", s: "Vemos si encajas (en menos de 48h)" },
                { n: "3", t: "Onboarding 1:1", s: "Configuramos juntos los agentes (1h Zoom)" },
                { n: "4", t: "90 días en marcha", s: "Métricas semanales + feedback estructurado" },
              ].map((p) => (
                <div key={p.n} className="card-hard p-4">
                  <div className="font-stencil text-4xl text-[color:var(--red)]">{p.n}</div>
                  <div className="font-bold mt-2">{p.t}</div>
                  <div className="text-xs text-black/60 mt-1">{p.s}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quién encaja */}
        <section className="py-12 border-b-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-4xl mx-auto px-5">
            <h2 className="font-stencil text-3xl md:text-4xl mb-6 text-center">Encajas si…</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="card-hard p-5 bg-white">
                <div className="text-xs font-mono tracking-widest text-[color:var(--red)] mb-2">SÍ</div>
                <ul className="space-y-2 text-sm">
                  <li>✓ Tienes un negocio local activo (clínica, peluquería, despacho, gimnasio…)</li>
                  <li>✓ Pierdes leads por no responder rápido</li>
                  <li>✓ Estás dispuesto a probar y dar feedback honesto cada semana</li>
                  <li>✓ España o LATAM</li>
                </ul>
              </div>
              <div className="card-hard p-5 bg-white">
                <div className="text-xs font-mono tracking-widest text-black/40 mb-2">NO</div>
                <ul className="space-y-2 text-sm text-black/60">
                  <li>✗ Quieres &quot;echar un vistazo&quot; y nada más</li>
                  <li>✗ No tienes 30 min/semana para hablar con nosotros</li>
                  <li>✗ Buscas una agencia que lo haga todo por ti (eso no somos)</li>
                  <li>✗ Necesitas SLA, soporte 24/7 y cero bugs (esto es beta)</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Diferenciación con ai.marketing */}
        <section className="py-8 bg-white border-b-[3px] border-black">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <p className="text-xs font-mono text-black/60">
              <strong>AI-Team es una marca independiente.</strong> No estamos afiliados con
              ai.marketing ni con ninguna empresa de nombre similar. Somos un equipo independiente
              con base en Marbella (Málaga).
            </p>
          </div>
        </section>

        {/* Form */}
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-5">
            <h2 className="font-stencil text-3xl md:text-4xl mb-2 text-center">Solicita tu plaza</h2>
            <p className="text-sm text-black/60 text-center mb-8 font-mono uppercase tracking-widest">
              Quedan plazas · No pedimos tarjeta · Respuesta en menos de 48h
            </p>
            <div className="card-hard p-6 md:p-8 bg-white">
              <BetaForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
