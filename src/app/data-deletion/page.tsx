import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Borrado de datos — AI-Team",
  description:
    "Cómo solicitar el borrado de tus datos personales en AI-Team (ECOPRIME MEDITERRANEO SL): pasos, plazos y email de contacto.",
  alternates: { canonical: "https://aiteam.marketing/data-deletion" },
  robots: { index: true },
};

export default function DataDeletionPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-16">
        <article className="max-w-3xl mx-auto px-5">
          <h1 className="font-stencil text-4xl md:text-6xl mb-2 leading-none">Borrado de datos</h1>
          <p className="text-sm text-black/60 mb-8">Última actualización: 9 de julio de 2026</p>

          <p className="text-base leading-relaxed">
            En <strong>AI-Team</strong> (titular: <strong>ECOPRIME MEDITERRANEO SL</strong>, NIF B21991559, Málaga, España)
            respetamos tu derecho a la supresión de datos (&quot;derecho al olvido&quot;) conforme al RGPD. Aquí te explicamos
            cómo pedir que borremos tus datos personales, incluidos los obtenidos a través de Facebook e Instagram.
          </p>

          <h2 className="font-stencil text-2xl mt-10 mb-3">Cómo solicitar el borrado</h2>
          <ol className="list-decimal pl-6 space-y-2">
            <li>
              Envía un email a <a className="underline text-[color:var(--red)] font-bold" href="mailto:hola@aiteam.marketing?subject=Borrado%20de%20datos">hola@aiteam.marketing</a>{" "}
              con el asunto <strong>&quot;Borrado de datos&quot;</strong>.
            </li>
            <li>
              Indica desde qué dirección/cuenta usas AI-Team (el email de tu cuenta y, si aplica, el usuario de Instagram/Facebook conectado)
              para poder identificarte.
            </li>
            <li>
              Confirmaremos tu identidad y procederemos al borrado. Recibirás confirmación por email cuando esté hecho.
            </li>
          </ol>

          <div className="mt-6 card-hard bg-[color:var(--mustard)] p-5">
            <p className="text-sm">
              Email de contacto para borrado:{" "}
              <a className="underline font-bold" href="mailto:hola@aiteam.marketing?subject=Borrado%20de%20datos">hola@aiteam.marketing</a>
            </p>
          </div>

          <h2 className="font-stencil text-2xl mt-10 mb-3">Qué borramos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Los datos de tu cuenta (email, nombre, briefing del negocio).</li>
            <li>Las conversaciones y contactos asociados a tu cuenta.</li>
            <li>Los tokens de conexión con Meta (WhatsApp/Instagram) y Google, y los datos obtenidos a través de ellos.</li>
          </ul>
          <p className="mt-3 text-sm text-black/70">
            Se conservarán únicamente los datos que la ley nos obligue a mantener (por ejemplo, facturación durante 5 años),
            debidamente bloqueados y sin más uso.
          </p>

          <h2 className="font-stencil text-2xl mt-10 mb-3">Plazo</h2>
          <p>Completamos el borrado en un plazo máximo de <strong>30 días</strong> desde que verificamos tu solicitud, y normalmente mucho antes.</p>

          <h2 className="font-stencil text-2xl mt-10 mb-3">Revocar el acceso desde Facebook / Instagram</h2>
          <p>
            Además de escribirnos, puedes revocar en cualquier momento el acceso de AI-Team a tus cuentas de Meta desde{" "}
            <strong>Configuración → Apps y sitios web</strong> de tu cuenta de Facebook o Instagram. Al hacerlo, dejamos de recibir
            datos de esas cuentas y eliminamos los tokens correspondientes de nuestros servidores.
          </p>

          <p className="mt-10 text-sm text-black/60">
            Para más información sobre cómo tratamos tus datos, consulta nuestra{" "}
            <a className="underline text-[color:var(--red)]" href="/privacy">Política de privacidad</a>.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
