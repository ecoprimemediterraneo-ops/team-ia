import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Equipo — AI-Team",
  description: "Quién está detrás de AI-Team. Estamos terminando nuestra presencia pública.",
  alternates: { canonical: "https://aiteam.marketing/equipo" },
};

export default function EquipoPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-16 border-b-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-3xl mx-auto px-5">
            <span className="inline-block bg-black text-[color:var(--mustard)] px-3 py-1 text-xs font-mono font-bold tracking-widest mb-4">
              EQUIPO · MISIÓN
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-6 leading-[1.05]">
              Detrás de AI-Team<br />hay personas reales.
            </h1>

            <div className="card-hard p-6 bg-white">
              <p className="text-lg mb-4">
                Estamos en una fase muy temprana del proyecto. Ahora mismo estamos terminando de
                preparar nuestra presencia pública (LinkedIn, perfiles, biografías).
              </p>
              <p className="text-base text-black/70 mb-4">
                Mientras tanto, lo único que te podemos decir con verdad:
              </p>
              <ul className="space-y-2 text-base">
                <li>· <b>Equipo independiente</b> con base en <b>Marbella (Málaga)</b>.</li>
                <li>· No estamos afiliados con <i>ai.marketing</i> ni con ninguna otra empresa de nombre similar.</li>
                <li>· Responsable del proyecto: <b>Cristóbal Serrano</b>.</li>
                <li>· Contacto directo: <a href="mailto:hola@aiteam.marketing" className="underline">hola@aiteam.marketing</a></li>
              </ul>

              <div className="mt-6 pt-6 border-t-2 border-black/10">
                <h2 className="font-stencil text-2xl mb-3">Por qué construimos esto</h2>
                <p className="text-base mb-3">
                  Hemos visto demasiados negocios locales perder leads cada noche por no
                  contestar el WhatsApp a tiempo. Clínicas, despachos, peluquerías,
                  gimnasios boutique — todos con el mismo dolor: la gente que entra fuera de horario
                  se va a la competencia.
                </p>
                <p className="text-base">
                  AI-Team es nuestra respuesta: un equipo de agentes IA con nombre y cara que se
                  ocupan de lo repetitivo (WhatsApp, reseñas, email, redes, llamadas, competencia)
                  para que tú te enfoques en lo importante: atender bien a quien sí está delante.
                </p>
              </div>

              <div className="mt-6 pt-6 border-t-2 border-black/10 text-sm text-black/60">
                <p className="mb-3">
                  <b>¿Quieres saber más sobre nosotros antes de probar?</b> Escríbenos a{" "}
                  <a href="mailto:hola@aiteam.marketing" className="underline">hola@aiteam.marketing</a>{" "}
                  y te contestamos personalmente — no hay equipo de marketing intermediando.
                </p>
                <p>
                  Esta página irá creciendo conforme construyamos en público. Vuelve en unas
                  semanas y verás caras, historias y trayectorias.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 bg-white">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <h2 className="font-stencil text-3xl mb-3">¿Listo para probar AI-Team?</h2>
            <p className="text-sm text-black/70 mb-6">
              50 plazas beta · 6 meses gratis · cancela cuando quieras · sin permanencia
            </p>
            <a href="/beta" className="btn-mustard inline-block">Solicitar plaza →</a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
