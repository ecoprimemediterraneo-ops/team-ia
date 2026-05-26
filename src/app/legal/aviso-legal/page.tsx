import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Aviso Legal — AI-Team",
  description: "Información legal de AI-Team conforme a la LSSI-CE.",
  alternates: { canonical: "https://aiteam.marketing/legal/aviso-legal" },
};

export default function AvisoLegalPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-16">
        <article className="max-w-3xl mx-auto px-5">
          <h1 className="font-stencil text-4xl md:text-6xl mb-2 leading-none">Aviso Legal</h1>
          <p className="text-sm text-black/60 mb-8">Última actualización: {new Date().toLocaleDateString("es-ES")}</p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">1. Titular del sitio web</h2>
          <p className="mb-2">
            En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la
            Sociedad de la Información y de Comercio Electrónico (LSSI-CE):
          </p>
          <ul className="list-disc pl-6 space-y-1 mb-4">
            <li><strong>Responsable:</strong> Cristóbal Serrano</li>
            <li><strong>Localidad:</strong> Marbella, Málaga (CP 29602), España</li>
            <li><strong>Email de contacto:</strong> <a className="underline" href="mailto:hola@aiteam.marketing">hola@aiteam.marketing</a></li>
            <li><strong>Sitio web:</strong> <a className="underline" href="https://aiteam.marketing">aiteam.marketing</a></li>
          </ul>
          <p className="text-sm text-black/70">
            Para datos fiscales completos (NIF/CIF) en caso de operación comercial formal, escríbenos.
            En esta fase de beta, AI-Team opera sin facturación a clientes finales.
          </p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">2. Objeto</h2>
          <p>
            AI-Team ofrece un sistema de agentes de inteligencia artificial para automatizar tareas
            repetitivas en negocios locales (clínicas, despachos, peluquerías, gimnasios y comercios). Actualmente nos
            encontramos en fase de <strong>beta privada</strong>: el servicio se ofrece sin coste a un
            número limitado de negocios a cambio de feedback estructurado.
          </p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">3. Condiciones de uso</h2>
          <p>El uso de este sitio web implica la aceptación de las siguientes condiciones:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>El usuario se compromete a hacer un uso lícito del sitio y de los servicios ofrecidos.</li>
            <li>El usuario es responsable de la veracidad de los datos que facilita en los formularios.</li>
            <li>Queda prohibido el uso del sitio para fines ilícitos, fraudulentos o que perjudiquen al titular o a terceros.</li>
            <li>El titular se reserva el derecho a modificar o suspender el servicio en cualquier momento.</li>
          </ul>

          <h2 className="font-stencil text-2xl mt-8 mb-3">4. Propiedad intelectual</h2>
          <p>
            Todos los contenidos del sitio (textos, imágenes, código, diseño, marca AI-Team y los
            personajes/agentes — Pablo, Rocío, Eva, Lucía, Marta, Carmen, Sergio, Diana, Tomás) son
            propiedad del titular o están licenciados a su favor. Queda prohibida su reproducción
            total o parcial sin autorización expresa por escrito.
          </p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">5. Limitación de responsabilidad</h2>
          <p>
            Los agentes de AI-Team generan contenido mediante modelos de lenguaje (LLM). El titular
            no garantiza la exactitud absoluta de los resultados generados por IA. El usuario es
            responsable de revisar el contenido antes de publicarlo o enviarlo a terceros. El
            servicio se ofrece &quot;tal cual&quot; durante la fase beta.
          </p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">6. Enlaces externos</h2>
          <p>
            Este sitio puede contener enlaces a webs de terceros (Resend, Anthropic, Google, Stripe,
            Vercel, etc.). El titular no se hace responsable del contenido ni de las políticas de
            dichas webs.
          </p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">7. Marca</h2>
          <p>
            AI-Team es una marca independiente. <strong>No estamos afiliados con &quot;ai.marketing&quot;</strong>
            ni con ninguna otra empresa de nombre similar. Si tienes dudas sobre la identidad del
            servicio, escríbenos a <a className="underline" href="mailto:hola@aiteam.marketing">hola@aiteam.marketing</a>.
          </p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">8. Legislación aplicable</h2>
          <p>
            Las presentes condiciones se rigen por la legislación española. Para cualquier
            controversia, las partes se someten a los Juzgados y Tribunales de Marbella (Málaga).
          </p>

          <p className="mt-12 text-sm text-black/60 italic">
            Consulta también nuestra <a href="/legal/privacidad" className="underline">Política de privacidad</a>
            {" "}y nuestros <a href="/legal/terminos" className="underline">Términos del servicio</a>.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
