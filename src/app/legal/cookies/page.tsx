import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Política de Cookies — AI-Team",
  description: "Qué cookies usa AI-Team y cómo gestionarlas.",
  alternates: { canonical: "https://aiteam.marketing/legal/cookies" },
};

export default function CookiesPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-16">
        <article className="max-w-3xl mx-auto px-5">
          <h1 className="font-stencil text-4xl md:text-6xl mb-2 leading-none">Política de cookies</h1>
          <p className="text-sm text-black/60 mb-8">Última actualización: {new Date().toLocaleDateString("es-ES")}</p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">1. Qué son las cookies</h2>
          <p>
            Las cookies son pequeños archivos de texto que se guardan en tu dispositivo cuando
            navegas por una web. Permiten recordar información sobre tu visita (por ejemplo, si
            tienes sesión iniciada).
          </p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">2. Qué cookies usamos</h2>
          <p>AI-Team utiliza <strong>únicamente cookies técnicas estrictamente necesarias</strong>:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>
              <strong>team_ia_session</strong> — guarda tu sesión cuando inicias acceso con
              magic-link. Caduca a los 30 días. Necesaria para que no tengas que volver a
              identificarte en cada página.
            </li>
            <li>
              <strong>aiteam-variant</strong> — recuerda qué versión de la home te tocó (test A/B
              para mejorar el producto). No te identifica personalmente.
            </li>
            <li>
              <strong>aiteam-cookies-accepted</strong> — recuerda que aceptaste este aviso para no
              mostrártelo en cada visita.
            </li>
          </ul>

          <h2 className="font-stencil text-2xl mt-8 mb-3">3. Cookies que NO usamos</h2>
          <p>
            <strong>No utilizamos cookies publicitarias, de seguimiento de terceros, ni de
            analítica externa</strong> (Google Analytics, Facebook Pixel, TikTok Pixel, etc.).
            Cuando empecemos a usar analítica, lo haremos con herramientas que respetan la
            privacidad por diseño (Plausible o similar) y actualizaremos esta política con
            antelación.
          </p>

          <h2 className="font-stencil text-2xl mt-8 mb-3">4. Cómo gestionarlas</h2>
          <p>
            Puedes borrar las cookies en cualquier momento desde la configuración de tu navegador.
            Si lo haces, tendrás que volver a iniciar sesión la próxima vez que entres.
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2 text-sm">
            <li><a className="underline" href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Chrome</a></li>
            <li><a className="underline" href="https://support.mozilla.org/es/kb/borrar-cookies" target="_blank" rel="noopener noreferrer">Firefox</a></li>
            <li><a className="underline" href="https://support.apple.com/es-es/guide/safari/sfri11471" target="_blank" rel="noopener noreferrer">Safari</a></li>
            <li><a className="underline" href="https://support.microsoft.com/es-es/topic/eliminar-y-administrar-cookies-168dab11-0753-043d-7c16-ede5947fc64d" target="_blank" rel="noopener noreferrer">Edge</a></li>
          </ul>

          <h2 className="font-stencil text-2xl mt-8 mb-3">5. Cambios</h2>
          <p>
            Si añadimos nuevas cookies, actualizaremos esta página y volveremos a pedir tu
            consentimiento con el banner de cookies.
          </p>

          <p className="mt-12 text-sm text-black/60 italic">
            Para más información sobre tus datos, lee la{" "}
            <a href="/legal/privacidad" className="underline">Política de privacidad</a>.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
