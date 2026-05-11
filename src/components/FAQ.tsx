"use client";
import { useState } from "react";

const faqs = [
  {
    q: "¿Cuánto cuesta?",
    a: "Cuatro packs: Local 39,90 €/mes fundador (WhatsApp + llamadas + reseñas), Digital 89 €/mes (correo + redes + email mkt), Élite 149 €/mes con los 6 especialistas, y Pro 299 €/mes (Élite + setup 1:1 + WhatsApp directo). Solo 100 plazas fundador con precio congelado de por vida. Después suben a precio normal.",
  },
  {
    q: "¿Necesito instalar algo o saber de tecnología?",
    a: "No. Te das de alta con tu email, describes tu negocio en 5 preguntas y la unidad ya está lista. Para conectar Gmail o tu WhatsApp Business hacemos juntos un setup de 10-15 minutos en una videollamada. Sin código, sin configurar APIs raras.",
  },
  {
    q: "¿Y si quiero solo 1 o 2 agentes en vez de los packs?",
    a: "Sí, puedes empezar con cualquier agente suelto desde 19 €/mes y ampliar cuando quieras. Mismo precio fundador, mismas plazas limitadas.",
  },
  {
    q: "¿Va de verdad a publicar y contestar, o solo es chat con IA?",
    a: "Te lo cuento honesto. En este momento (mayo 2026): Eva sí envía emails reales desde tu dominio (Resend integrado). Lucía sí lee tu Gmail real, te lo resume con IA y te crea borradores reales en tu Gmail (OAuth de Google). Pablo, Rocío, Marta y Carmen funcionan en modo asistido: generan el contenido (mensajes, respuestas, posts, guiones, voz) y tú lo publicas con un click. Para que publiquen 100% solos necesitamos las APIs oficiales de Meta (WhatsApp Business), Google Business Profile y Vapi (voz), que están en proceso de aprobación con Meta y Google. Te decimos en cada agente exactamente qué está automático y qué es asistido. Sin humo.",
  },
  {
    q: "¿En qué idiomas trabaja?",
    a: "Español nativo (ES, MX, AR, CO, CL) e inglés. Carmen es bilingüe en sus guiones de llamada. Otros idiomas bajo demanda.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí, sin penalización. 14 días de prueba sin tarjeta. Después, mes a mes. Si no te aporta, te vas. Tus datos se borran a los 30 días tras la cancelación.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Servidores en la UE, cifrado en tránsito, cumplimiento RGPD. Las conexiones a Gmail/WhatsApp/etc usan los protocolos oficiales (OAuth) — nadie de AI-Team puede leer tus correos ni tus chats. Tu información no se usa para entrenar modelos.",
  },
  {
    q: "¿Funciona con mi software actual (Gesden, ClinicCloud, etc.)?",
    a: "AI-Team vive 'al lado', no 'dentro' de tu software. Trabajamos con tu calendario (Google Calendar o Cal.com), tu WhatsApp Business y tu Gmail. La sincronización con software vertical (clínicas, peluquerías) la hace tu recepcionista en 30 segundos al confirmar cada cita. Estamos preparando integraciones directas con los más populares.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-24 border-t-[3px] border-black bg-white">
      <div className="max-w-3xl mx-auto px-5">
        <h2 className="font-stencil text-5xl md:text-7xl text-center mb-12">¿Preguntas?</h2>
        <div className="flex flex-col gap-4">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="card-hard overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left font-display text-xl md:text-2xl"
                >
                  <span>{f.q}</span>
                  <span className="text-3xl">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 border-t-2 border-black pt-4 text-black/80 leading-relaxed">
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
