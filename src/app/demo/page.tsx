import { agents } from "@/lib/agents";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo — Prueba los agentes IA | AI-Team",
  description: "Prueba gratis cómo trabajan Pablo, Rocío, Eva, Lucía, Marta, Carmen y Sergio. Sin registro, sin tarjeta.",
};

const demos: { slug: string; scenario: string; input: string; output: string }[] = [
  {
    slug: "pablo",
    scenario: "Un cliente escribe a las 23:00 un sábado",
    input: "Hola, quería pedir cita para una limpieza dental. ¿Tenéis hueco esta semana?",
    output: "¡Hola! 😊 Claro, tenemos hueco el miércoles a las 10:00 o el jueves a las 16:30. ¿Cuál te viene mejor? La limpieza dura unos 45 minutos. Si necesitas algo más, dime y te lo agendo todo junto.",
  },
  {
    slug: "rocio",
    scenario: "Un paciente deja 4 estrellas en Google",
    input: "Buena atención, aunque tuve que esperar 20 minutos. El trato del doctor muy profesional.",
    output: "¡Muchas gracias por tu reseña! 🙏 Lamentamos la espera — estamos ajustando la agenda para que no vuelva a pasar. Nos alegra que el Dr. García te haya atendido bien. ¡Te esperamos en tu próxima revisión!",
  },
  {
    slug: "eva",
    scenario: "Email de seguimiento 72h después del primer contacto",
    input: "(Automático — sin acción del negocio)",
    output: "Asunto: Re: idea rápida para Clínica Dental Sonrisa\n\n¿Has podido ver el email del lunes? No te robo más tiempo, solo confirmo si te interesa una de las 5 plazas piloto antes de que las cierre.\n\nSi es no, perfecto, no insisto más.\nSi es sí, te paso enlace para reservar 15 min.",
  },
  {
    slug: "lucia",
    scenario: "Resumen de bandeja del lunes por la mañana",
    input: "47 emails sin leer acumulados del fin de semana",
    output: "📬 Buenos días. Resumen de tu bandeja:\n\n🔴 URGENTE (2): Factura vencida de Dentalpro · Paciente con dolor agudo pide cita urgente\n🟡 IMPORTANTE (5): 3 confirmaciones de cita · Presupuesto de laboratorio · Newsletter COEM\n⚪ BAJO (40): 38 promos archivadas automáticamente · 2 notificaciones de Google",
  },
  {
    slug: "marta",
    scenario: "Crear post de Instagram para promoción de blanqueamiento",
    input: "Quiero un post para promocionar blanqueamiento dental esta semana",
    output: "📸 POST LISTO:\n\n✨ ¿Sabías que el blanqueamiento profesional dura hasta 3 años?\n\nEsta semana, tu sonrisa brilla con un 20% de descuento.\n\n📍 Pide cita → enlace en bio\n\n#blanqueamientodental #sonrisa #clinicadental #[tuciudad]\n\n🎨 Imagen generada: foto profesional de sonrisa con fondo clínico minimalista",
  },
  {
    slug: "carmen",
    scenario: "Llamada de un paciente nuevo pidiendo información",
    input: "Hola, buenos días, llamaba para preguntar cuánto cuesta una limpieza dental",
    output: "¡Buenos días! Gracias por llamar a Clínica Dental Sonrisa. La limpieza dental tiene un precio de 60 euros e incluye revisión completa con el doctor. Dura unos 45 minutos. ¿Le gustaría que le agende una cita? Tenemos hueco el miércoles por la mañana o el jueves por la tarde.",
  },
  {
    slug: "sergio",
    scenario: "Escaneo nocturno de la web de un competidor",
    input: "(Automático — 03:00 AM, lunes)",
    output: "🕵️ ALERTA · Clínica Dental Vecina\n\n· Precio limpieza: 60€ → 45€ (-25%)\n· Nueva landing: 'Implantes desde 599€'\n· Reseñas Google: 4,3 → 4,5 (+12 reseñas en 7 días)\n\nRecomendación: revisa tu promo de limpiezas esta semana y plantea un mensaje de Pablo con descuento de bienvenida.",
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
              Así trabaja tu equipo
            </h1>
            <p className="text-lg text-black/70 max-w-2xl mx-auto">
              Ejemplos reales de cómo cada agente resuelve situaciones del día a día de una clínica dental.
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
                      <span className="font-bold">{agent.name}</span>
                      <span className="text-black/60 text-sm ml-2">— {agent.role}</span>
                    </div>
                    <span className="ml-auto text-xs font-mono bg-black text-white px-2 py-1">{agent.codename}</span>
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
                        <div className="text-[10px] font-mono font-bold text-black/40 mb-2">RESPUESTA DEL AGENTE</div>
                        <p className="text-sm whitespace-pre-wrap">{d.output}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-16 space-y-4">
            <p className="text-lg font-bold">¿Quieres probarlos con TU negocio?</p>
            <a href="/#waitlist" className="btn-mustard text-lg inline-block">
              SOLICITAR ACCESO GRATIS →
            </a>
            <p className="text-xs text-black/50">30 días gratis · Sin tarjeta · Sin compromiso</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
