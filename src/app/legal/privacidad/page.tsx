import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Política de Privacidad — AI-Team",
  description: "Cómo tratamos tus datos en AI-Team.",
};

export default function PrivacidadPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-16">
        <article className="max-w-3xl mx-auto px-5 prose prose-stone">
          <h1 className="font-stencil text-4xl md:text-6xl mb-2 leading-none">Política de privacidad</h1>
          <p className="text-sm text-black/60 mb-8">Última actualización: 11 de mayo de 2026</p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">1. Responsable del tratamiento</h2>
          <p>AI-Team (en adelante &quot;el Servicio&quot;), gestionado por Cristóbal Serrano. Contacto: <a className="underline" href="mailto:ecoprimemediterraneo@gmail.com">ecoprimemediterraneo@gmail.com</a></p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">2. Datos que recogemos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Cuenta:</strong> email, nombre, sector y ciudad de tu negocio.</li>
            <li><strong>Briefing:</strong> tono, servicios, público, precios — para que los agentes respondan en tu nombre.</li>
            <li><strong>Conversaciones con agentes:</strong> mensajes que escribes en el chat con cada agente.</li>
            <li><strong>Conexiones OAuth (opcionales):</strong> Gmail (lectura/borradores) si activas Lucía.</li>
            <li><strong>Contactos de tu lista:</strong> emails de pacientes/clientes que tú añades para Eva.</li>
            <li><strong>Métricas de uso:</strong> qué agentes usas, cuándo, para mejorar el servicio.</li>
          </ul>

          <h2 className="font-stencil text-2xl mt-8 mb-3">3. Para qué los usamos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Prestarte el servicio (generar respuestas, enviar emails, leer tu Gmail si lo autorizas).</li>
            <li>Facturarte (cuando contrates plan de pago).</li>
            <li>Mejorar el producto (estadísticas agregadas anónimas).</li>
          </ul>
          <p><strong>NO usamos tus datos para entrenar modelos de IA externos.</strong> Los LLM que usamos (Anthropic Claude, OpenAI) tienen contrato comercial que prohíbe entrenamiento con datos de cliente.</p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">4. Con quién los compartimos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Anthropic (Claude):</strong> envío de prompts para generar respuestas. Servidores EU/US. Anthropic firma DPA y no entrena con datos.</li>
            <li><strong>OpenAI (DALL-E + voz):</strong> generación de imágenes para Marta y audio para Carmen.</li>
            <li><strong>Resend:</strong> envío de emails transaccionales y campañas de Eva. Servidor EU.</li>
            <li><strong>Google (OAuth):</strong> si conectas Gmail, accedemos solo a leer mensajes y crear borradores en tu cuenta. Cumple Google API Services User Data Policy.</li>
            <li><strong>Vercel:</strong> hosting del servicio. Servidores EU (Frankfurt).</li>
          </ul>
          <p>No vendemos ni cedemos tus datos a terceros para fines comerciales.</p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">5. Cuánto tiempo los guardamos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Cuenta activa:</strong> mientras uses el servicio.</li>
            <li><strong>Tras baja:</strong> 30 días de retención por si te arrepientes. Después borrado completo.</li>
            <li><strong>Tokens Gmail/OAuth:</strong> los puedes revocar en cualquier momento desde tu cuenta Google. Se eliminan también de nuestros servidores cuando lo haces.</li>
            <li><strong>Facturación:</strong> 5 años por obligación fiscal española.</li>
          </ul>

          <h2 className="font-stencil text-2xl mt-8 mb-3">6. Tus derechos (RGPD)</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Acceso a tus datos.</li>
            <li>Rectificación.</li>
            <li>Supresión (&quot;derecho al olvido&quot;).</li>
            <li>Portabilidad.</li>
            <li>Oposición al tratamiento.</li>
          </ul>
          <p>Para ejercerlos, escríbenos a <a className="underline" href="mailto:ecoprimemediterraneo@gmail.com">ecoprimemediterraneo@gmail.com</a> y te respondemos en menos de 30 días.</p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">7. Seguridad</h2>
          <p>Datos cifrados en tránsito (HTTPS/TLS). Tokens OAuth cifrados en almacenamiento. Servidores en la UE con cumplimiento RGPD. Auditorías de seguridad periódicas.</p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">8. Cookies</h2>
          <p>Usamos solo cookies técnicas necesarias (sesión, autenticación). NO usamos cookies de tracking de terceros (Google Analytics, Facebook Pixel, etc.).</p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">9. Cambios</h2>
          <p>Si cambiamos esta política, te avisamos por email con 30 días de antelación.</p>

          <p className="mt-12 text-sm text-black/60 italic">Esta política se rige por la legislación española y europea (RGPD, LOPDGDD).</p>
        </article>
      </main>
      <Footer />
    </>
  );
}
