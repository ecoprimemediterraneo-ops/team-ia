import { agents } from "@/lib/agents";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo — Mira el sistema en acción | AI-Team",
  description: "Prueba gratis cómo el sistema operativo de tu negocio resuelve WhatsApp, llamadas, reseñas, correo, email marketing, redes e inteligencia competitiva. Sin registro, sin tarjeta.",
};

// Etiqueta de FUNCIÓN para cada módulo del sistema (sin nombres de persona).
const fnLabel: Record<string, string> = {
  pablo: "WhatsApp",
  rocio: "Reseñas de Google",
  eva: "Email marketing",
  lucia: "Correo y agenda",
  marta: "Instagram y redes",
  carmen: "Llamadas",
  sergio: "Inteligencia competitiva",
};

const demos: { slug: string; scenario: string; input: string; output: string }[] = [
  {
    slug: "pablo",
    scenario: "Un cliente escribe fuera de horario, un sábado por la noche",
    input: "Hola, quería pedir cita para una limpieza dental. ¿Tenéis hueco esta semana?",
    output: "¡Hola! 😊 Claro, te miro los huecos disponibles esta semana y te propongo los que mejor te encajen. La limpieza dura algo menos de una hora. Si necesitas algo más, dime y te lo agendo todo junto.",
  },
  {
    slug: "rocio",
    scenario: "Un paciente deja una reseña positiva con un matiz de mejora",
    input: "Buena atención, aunque tuve que esperar un poco. El trato del doctor, muy profesional.",
    output: "¡Muchas gracias por tu reseña! 🙏 Lamentamos la espera — estamos ajustando la agenda para que no vuelva a pasar. Nos alegra que el equipo te haya atendido bien. ¡Te esperamos en tu próxima revisión!",
  },
  {
    slug: "eva",
    scenario: "Email de seguimiento unos días después del primer contacto",
    input: "(Automático — sin acción del negocio)",
    output: "Asunto: Re: idea rápida para tu negocio\n\n¿Has podido ver el email anterior? No te robo más tiempo, solo confirmo si te interesa una de las plazas fundadoras antes de que se cierren.\n\nSi es no, perfecto, no insisto más.\nSi es sí, te paso enlace para reservar 15 min.",
  },
  {
    slug: "lucia",
    scenario: "Resumen de bandeja del lunes por la mañana",
    input: "Emails sin leer acumulados del fin de semana",
    output: "📬 Buenos días. Resumen de tu bandeja:\n\n🔴 URGENTE: Una factura pendiente · Un paciente con dolor pide cita urgente\n🟡 IMPORTANTE: Varias confirmaciones de cita · Un presupuesto de laboratorio · Newsletter del sector\n⚪ BAJO: Promociones archivadas automáticamente · Notificaciones varias",
  },
  {
    slug: "marta",
    scenario: "Crear un post de Instagram para una promoción de blanqueamiento",
    input: "Quiero un post para promocionar blanqueamiento dental esta semana",
    output: "📸 POST LISTO:\n\n✨ El blanqueamiento profesional mantiene tu sonrisa luminosa durante mucho tiempo.\n\nEsta semana, una condición especial para que des el paso.\n\n📍 Pide cita → enlace en bio\n\n#blanqueamientodental #sonrisa #clinicadental #[tuciudad]\n\n🎨 Imagen sugerida: foto profesional de sonrisa con fondo clínico minimalista",
  },
  {
    slug: "carmen",
    scenario: "Llamada de un paciente nuevo pidiendo información",
    input: "Hola, buenos días, llamaba para preguntar cuánto cuesta una limpieza dental",
    output: "¡Buenos días! Gracias por llamar. La limpieza dental incluye una revisión completa con el doctor y dura algo menos de una hora; te paso el precio exacto al confirmar la cita. ¿Le gustaría que le busque un hueco esta semana?",
  },
  {
    slug: "sergio",
    scenario: "Escaneo nocturno de la web de un competidor (ejemplo ilustrativo)",
    input: "(Automático — de madrugada)",
    output: "🕵️ ALERTA · Competidor cercano (datos de ejemplo)\n\n· Ha bajado el precio de una de sus promociones\n· Nueva landing destacando implantes\n· Está sumando reseñas nuevas estos días\n\nRecomendación: revisa tu promo de limpiezas esta semana y lanza un mensaje de WhatsApp con descuento de bienvenida.",
  },
];

export default function DemoPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-16">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-16">
            <span className="inline-block bg-black text-[color:var(--mustard)] px-3 py-1 text-xs font-mono font-bold tracking-widest mb-4">
              DEMO · SIN REGISTRO
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4">
              Así trabaja tu sistema
            </h1>
            <p className="text-lg text-black/70 max-w-2xl mx-auto">
              Un único sistema integrado, no varias herramientas sueltas. Ejemplos ilustrativos de cómo resuelve, función a función, el día a día de una clínica dental.
            </p>
            <p className="text-sm text-black/50 max-w-2xl mx-auto mt-4">
              Mientras otros esperan a que les escribas, tu sistema ya actuó.
            </p>
          </div>

          <div className="space-y-8">
            {demos.map((d) => {
              const agent = agents.find((a) => a.slug === d.slug)!;
              return (
                <div key={d.slug} className="card-hard p-0 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-3 border-b-2 border-black" style={{ backgroundColor: agent.color + "20" }}>
                    <span className="text-2xl">{agent.emoji}</span>
                    <div>
                      <span className="font-bold">{fnLabel[d.slug] ?? agent.role}</span>
                      <span className="text-black/60 text-sm ml-2">— módulo del sistema</span>
                    </div>
                    <span className="ml-auto text-xs font-mono bg-black text-white px-2 py-1">SISTEMA</span>
                  </div>

                  <div className="p-5">
                    <div className="text-xs font-mono text-black/50 mb-3">
                      ESCENARIO: {d.scenario}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-white border-2 border-black/20 p-4 rounded">
                        <div className="text-[10px] font-mono font-bold text-black/40 mb-2">ENTRADA</div>
                        <p className="text-sm whitespace-pre-wrap">{d.input}</p>
                      </div>
                      <div className="border-2 border-black p-4 rounded bg-[color:var(--mustard)]/10">
                        <div className="text-[10px] font-mono font-bold text-black/40 mb-2">RESPUESTA DEL SISTEMA</div>
                        <p className="text-sm whitespace-pre-wrap">{d.output}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card-hard p-6 mt-16">
            <div className="text-xs font-mono font-bold text-black/40 mb-2">NO SOLO RESPONDE · SE ADELANTA</div>
            <p className="font-bold mb-3">Lo importante no es lo que hace cuando le hablas, sino lo que hace cuando no le hablas.</p>
            <ul className="space-y-2 text-sm text-black/70">
              <li>· Te avisa de un lead que lleva horas sin respuesta.</li>
              <li>· Te recuerda por la mañana las citas del día.</li>
              <li>· Publica solo en Instagram cuando toca.</li>
              <li>· Te sugiere a qué cliente conviene reescribir.</li>
            </ul>
            <p className="text-xs text-black/50 mt-4">
              Sistema proactivo en activación por fases: lo encendemos contigo, módulo a módulo. Si tu software solo responde cuando le hablas, vive en los 90.
            </p>
          </div>

          <div className="text-center mt-16 space-y-4">
            <p className="text-lg font-bold">¿Quieres verlo con TU negocio?</p>
            <a href="/#waitlist" className="btn-mustard text-lg inline-block">
              SOLICITAR ACCESO GRATIS →
            </a>
            <p className="text-xs text-black/50">20 plazas · 6 meses gratis · sin tarjeta · precio fundador para siempre</p>
            <p className="text-xs text-black/40">Automatización de verdad, no la de hace diez años.</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
