import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Política de Privacidad — AI-Team",
  description:
    "Política de privacidad de AI-Team (ECOPRIME MEDITERRANEO SL), conforme al RGPD: qué datos tratamos, con qué base legal, con quién los compartimos y cómo ejercer tus derechos.",
  alternates: { canonical: "https://aiteam.marketing/privacy" },
  robots: { index: true },
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-16">
        <article className="max-w-3xl mx-auto px-5">
          <h1 className="font-stencil text-4xl md:text-6xl mb-2 leading-none">Política de privacidad</h1>
          <p className="text-sm text-black/60 mb-8">Última actualización: 9 de julio de 2026</p>

          <p className="text-base leading-relaxed">
            Esta política explica cómo <strong>ECOPRIME MEDITERRANEO SL</strong> trata los datos personales de las
            personas que usan <strong>AI-Team</strong> (el &quot;Servicio&quot;, en <a className="underline text-[color:var(--red)]" href="https://aiteam.marketing">aiteam.marketing</a>),
            de conformidad con el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).
          </p>

          <h2 className="font-stencil text-2xl mt-10 mb-3">1. Responsable del tratamiento</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Titular:</strong> ECOPRIME MEDITERRANEO SL</li>
            <li><strong>NIF:</strong> B21991559</li>
            <li><strong>Domicilio:</strong> Málaga (Marbella / Coín), España</li>
            <li><strong>Contacto de privacidad:</strong> <a className="underline text-[color:var(--red)]" href="mailto:hola@aiteam.marketing">hola@aiteam.marketing</a></li>
          </ul>

          <h2 className="font-stencil text-2xl mt-10 mb-3">2. Qué datos recogemos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Datos de cuenta:</strong> nombre de usuario, email, nombre, sector y ciudad de tu negocio.</li>
            <li><strong>Briefing del negocio:</strong> tono de marca, servicios, público y precios, para que el sistema responda en tu nombre.</li>
            <li><strong>Conversaciones:</strong> mensajes que tú y tus clientes intercambiáis a través de los canales conectados (WhatsApp, Instagram, chat, email).</li>
            <li><strong>Conexiones autorizadas (OAuth):</strong> tokens de Meta (WhatsApp Business / Instagram), Google (Gmail, Calendar, Perfil de Empresa) que tú actives.</li>
            <li><strong>Contactos que tú aportas:</strong> datos de tus pacientes/clientes que añades para las funciones de email o agenda.</li>
            <li><strong>Datos técnicos y de uso:</strong> registros de acceso, qué funciones usas y cuándo, para operar y mejorar el Servicio.</li>
          </ul>

          <h2 className="font-stencil text-2xl mt-10 mb-3">3. Para qué los usamos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Prestarte el Servicio: responder mensajes, agendar citas, publicar contenido y gestionar reseñas que autorices.</li>
            <li>Gestionar tu cuenta, el soporte y, en su caso, la facturación.</li>
            <li>Garantizar la seguridad, prevenir el fraude y cumplir obligaciones legales.</li>
            <li>Mejorar el producto mediante estadísticas agregadas.</li>
          </ul>
          <p className="mt-3"><strong>No usamos tus datos ni los de tus clientes para entrenar modelos de IA de terceros.</strong></p>

          <h2 className="font-stencil text-2xl mt-10 mb-3">4. Base legal (RGPD art. 6)</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Ejecución de un contrato:</strong> prestarte el Servicio que contratas.</li>
            <li><strong>Consentimiento:</strong> conexiones OAuth (Meta, Google) y comunicaciones comerciales; revocable en cualquier momento.</li>
            <li><strong>Interés legítimo:</strong> seguridad, prevención de abusos y mejora del Servicio.</li>
            <li><strong>Obligación legal:</strong> conservación de facturación y respuesta a autoridades.</li>
          </ul>

          <h2 className="font-stencil text-2xl mt-10 mb-3">5. Con quién los compartimos</h2>
          <p className="mb-3">Compartimos datos únicamente con proveedores que actúan como encargados del tratamiento, con contrato (DPA) y solo para prestar el Servicio:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Meta Platforms, Inc. (WhatsApp e Instagram):</strong> si conectas tus cuentas, tratamos los mensajes, comentarios y publicaciones para gestionarlos en tu nombre a través de la Meta Cloud API / Messenger Platform.</li>
            <li><strong>Google LLC (Gmail, Google Calendar, Perfil de Empresa):</strong> si lo autorizas por OAuth, accedemos a lo mínimo necesario para leer/redactar correo, crear citas o gestionar reseñas.</li>
            <li><strong>Resend:</strong> envío de emails transaccionales y campañas. Servidores en la UE.</li>
            <li><strong>Anthropic y OpenAI:</strong> generación de respuestas, imágenes y voz. Con contrato que prohíbe el entrenamiento con datos de cliente.</li>
            <li><strong>Vercel (hosting) y Supabase (base de datos):</strong> infraestructura del Servicio.</li>
          </ul>
          <p className="mt-3">No vendemos ni cedemos tus datos a terceros con fines comerciales. Algunos proveedores (Meta, Google, OpenAI) pueden tratar datos fuera del EEE bajo garantías adecuadas (cláusulas contractuales tipo).</p>

          <h2 className="font-stencil text-2xl mt-10 mb-3">6. Cuánto tiempo los conservamos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Cuenta activa:</strong> mientras uses el Servicio.</li>
            <li><strong>Tras la baja:</strong> hasta 30 días de retención y después borrado. Puedes pedir el borrado inmediato (ver <a className="underline text-[color:var(--red)]" href="/data-deletion">Borrado de datos</a>).</li>
            <li><strong>Tokens OAuth (Meta/Google):</strong> hasta que los revoques desde tu cuenta o nos lo pidas; se eliminan de nuestros servidores.</li>
            <li><strong>Facturación:</strong> 5 años por obligación fiscal (normativa española).</li>
          </ul>

          <h2 className="font-stencil text-2xl mt-10 mb-3">7. Tus derechos</h2>
          <p className="mb-3">Puedes ejercer en cualquier momento tus derechos de:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Acceso</strong> a tus datos.</li>
            <li><strong>Rectificación</strong> de datos inexactos.</li>
            <li><strong>Supresión</strong> (&quot;derecho al olvido&quot;).</li>
            <li><strong>Portabilidad</strong> y <strong>limitación</strong> del tratamiento.</li>
            <li><strong>Oposición</strong> al tratamiento y a decisiones automatizadas.</li>
            <li><strong>Retirar el consentimiento</strong> otorgado.</li>
          </ul>
          <p className="mt-3">
            Escríbenos a <a className="underline text-[color:var(--red)]" href="mailto:hola@aiteam.marketing">hola@aiteam.marketing</a> y responderemos en un plazo máximo de 30 días.
            También puedes reclamar ante la <strong>Agencia Española de Protección de Datos</strong> (<a className="underline text-[color:var(--red)]" href="https://www.aepd.es">aepd.es</a>).
          </p>

          <h2 className="font-stencil text-2xl mt-10 mb-3">8. Seguridad</h2>
          <p>Ciframos los datos en tránsito (HTTPS/TLS) y los tokens OAuth en almacenamiento. Aplicamos control de acceso y medidas técnicas y organizativas conformes al RGPD.</p>

          <h2 className="font-stencil text-2xl mt-10 mb-3">9. Cookies</h2>
          <p>Usamos solo cookies técnicas necesarias (sesión y autenticación). No usamos cookies de seguimiento publicitario de terceros.</p>

          <h2 className="font-stencil text-2xl mt-10 mb-3">10. Cambios</h2>
          <p>Si modificamos esta política, publicaremos la nueva versión en esta página y, si el cambio es sustancial, te avisaremos.</p>

          <div className="mt-12 card-hard bg-[color:var(--mustard)] p-5">
            <p className="font-bold">¿Quieres que borremos tus datos?</p>
            <p className="text-sm mt-1">Sigue las instrucciones en <a className="underline" href="/data-deletion">Borrado de datos</a> o escríbenos a <a className="underline" href="mailto:hola@aiteam.marketing">hola@aiteam.marketing</a>.</p>
          </div>

          <p className="mt-10 text-sm text-black/60 italic">Esta política se rige por la legislación española y europea (RGPD y LOPDGDD).</p>
        </article>
      </main>
      <Footer />
    </>
  );
}
