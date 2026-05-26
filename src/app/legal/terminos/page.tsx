import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Términos y Condiciones — AI-Team",
};

export default function TerminosPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-16">
        <article className="max-w-3xl mx-auto px-5 prose prose-stone">
          <h1 className="font-stencil text-4xl md:text-6xl mb-2 leading-none">Términos y condiciones</h1>
          <p className="text-sm text-black/60 mb-8">Última actualización: 11 de mayo de 2026</p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">1. Qué es AI-Team</h2>
          <p>AI-Team es un servicio software que ofrece 6 asistentes de IA (Pablo, Lucía, Eva, Rocío, Marta, Carmen) para PYMEs. Operamos como SaaS por suscripción mensual.</p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">2. Quién puede usarlo</h2>
          <p>Mayores de 18 años, con un negocio legal. No para uso personal/doméstico. No para sectores prohibidos por la AppStore de Apple/Google (apuestas, contenido adulto, drogas, etc.).</p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">3. Suscripciones y precios</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Pago mensual. Sin permanencia.</li>
            <li>6 meses de prueba sin tarjeta. Puedes cancelar antes sin coste.</li>
            <li>Plazas <strong>fundadoras</strong>: 50 primeros clientes con precio congelado de por vida.</li>
            <li>Tras el lanzamiento general, los precios pueden subir para nuevos clientes (no para fundadores).</li>
            <li>Reembolsos: si en los primeros 6 meses no estás contento, devolvemos el 100%.</li>
          </ul>

          <h2 className="font-stencil text-2xl mt-8 mb-3">4. Cancelación</h2>
          <p>Puedes cancelar tu suscripción desde el panel en cualquier momento. La cancelación es efectiva al final del periodo actual ya pagado. No hay reembolsos parciales del mes en curso.</p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">5. Lo que ofrecemos honestamente</h2>
          <p><strong>Estado actual del producto (mayo 2026):</strong></p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Eva:</strong> envía emails reales por Resend desde tu dominio si lo conectas.</li>
            <li><strong>Lucía:</strong> lee tu Gmail real con OAuth, te genera borradores en tu cuenta.</li>
            <li><strong>Pablo, Rocío, Marta, Carmen:</strong> modo &quot;asistido&quot; — generan contenido (mensajes, respuestas, posts, voz) y tú los publicas con un click. La auto-publicación 100% requiere integraciones con APIs externas (Meta WhatsApp Business, Google Business Profile, Instagram Graph, Vapi) que estamos solicitando. Tiempos estimados: 2-12 semanas.</li>
          </ul>
          <p>Te avisamos en cada agente exactamente qué está automatizado y qué es asistido. <strong>Sin humo.</strong></p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">6. Tus responsabilidades</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Revisar las respuestas que los agentes generan antes de publicarlas o enviarlas.</li>
            <li>Cumplir las leyes aplicables a tu negocio (RGPD, alérgenos, etc.).</li>
            <li>No usar el servicio para spam, fraude, contenido ilegal.</li>
            <li>Mantener tu cuenta segura.</li>
          </ul>

          <h2 className="font-stencil text-2xl mt-8 mb-3">7. Nuestras responsabilidades</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Mantener el servicio disponible (objetivo 99% uptime).</li>
            <li>Avisar de mantenimientos planificados con 48h.</li>
            <li>Proteger tus datos (ver Política de Privacidad).</li>
            <li>Devolver tu dinero si el servicio no funciona como prometemos.</li>
          </ul>

          <h2 className="font-stencil text-2xl mt-8 mb-3">8. Limitación de responsabilidad</h2>
          <p>Los agentes son IA generativa. Pueden cometer errores. Tú eres responsable de revisar antes de publicar. AI-Team no se hace responsable de pérdidas indirectas derivadas de respuestas generadas que tú no hayas validado.</p>
          <p>Responsabilidad máxima: el importe pagado los últimos 12 meses.</p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">9. Ley aplicable</h2>
          <p>Estos términos se rigen por la ley española. Jurisdicción: tribunales de Málaga.</p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">10. Contacto</h2>
          <p><a className="underline" href="mailto:ecoprimemediterraneo@gmail.com">ecoprimemediterraneo@gmail.com</a></p>
        </article>
      </main>
      <Footer />
    </>
  );
}
