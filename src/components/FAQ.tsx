"use client";
import { useState } from "react";

const faqs = [
  {
    q: "¿Cuánto cuesta?",
    a: "Tres planes: Esencial 89 €/mes (Pablo + Carmen + Rocío — WhatsApp, llamadas y reseñas), Completo 189 €/mes con los 6 agentes activos (añade Lucía + Eva + Marta), y Pro 389 €/mes (Completo + onboarding 1:1 + multiusuario hasta 5 cuentas + soporte prioritario 4h + integraciones a medida). Solo 50 plazas fundador con precio congelado de por vida.",
  },
  {
    q: "¿Necesito instalar algo o saber de tecnología?",
    a: "No. Te das de alta con tu email, describes tu negocio en 5 preguntas y la unidad ya está lista. Para conectar Gmail o tu WhatsApp Business hacemos juntos un setup de 10-15 minutos en una videollamada. Sin código, sin configurar APIs raras.",
  },
  {
    q: "¿Y si quiero solo 1 o 2 agentes en vez de los packs?",
    a: "Sí, puedes empezar con el plan Esencial (89 €/mes) y ampliar cuando quieras. El precio fundador se congela desde el primer día, independientemente del plan que elijas.",
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
    a: "Sí, sin penalización. 6 meses de prueba sin tarjeta. Después, mes a mes. Si no te aporta, te vas. Tus datos se borran a los 30 días tras la cancelación.",
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
        <h2 className="font-stencil text-5xl md:text-6xl text-center mb-16 leading-tight">Preguntas frecuentes</h2>
        <div className="flex flex-col divide-y divide-black/10 border-y border-black/10">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={i}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-left font-semibold text-base md:text-lg gap-4"
                >
                  <span>{f.q}</span>
                  <span className="text-black/30 text-xl shrink-0">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <div className="pb-5 text-sm text-black/60 leading-relaxed">
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
