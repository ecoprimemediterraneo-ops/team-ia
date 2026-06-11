"use client";
import { useState } from "react";

// Home: 4 preguntas esenciales. El resto vive en /precios.
const faqs = [
  {
    q: "¿Cuánto cuesta?",
    a: "Dos planes: Esencial 99 €/mes (Pablo + Carmen + Rocío — WhatsApp, llamadas y reseñas) con resumen mensual incluido; y Completo 189 €/mes con los 6 agentes activos (añade Lucía + Eva + Marta) e informe mensual con análisis y leads calientes. ¿Necesitas multiusuario o soporte prioritario? Hablamos con ventas. Solo 20 plazas fundador con precio congelado de por vida. Ver detalle en /precios.",
  },
  {
    q: "¿Va de verdad a publicar y contestar, o solo es chat con IA?",
    a: "Te lo cuento honesto. Hoy: Eva envía emails reales desde tu dominio (Resend integrado). Lucía lee tu Gmail real, lo resume con IA y crea borradores reales (OAuth de Google). Pablo está conectado a WhatsApp Business Cloud (Meta) y contesta en tu nombre. Carmen, Rocío y Marta funcionan en modo asistido: generan el contenido y tú lo publicas con un click, mientras terminamos las aprobaciones de Vapi (voz), Google Business Profile (reseñas) y Meta para Instagram/Facebook. Te indicamos en cada agente qué está automático y qué es asistido. Sin humo.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí, sin penalización. 6 meses de prueba sin tarjeta. Después, mes a mes. Si no te aporta, te vas. Tus datos se borran a los 30 días tras la cancelación.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Servidores en la UE, cifrado en tránsito, cumplimiento RGPD. Las conexiones a Gmail/WhatsApp/etc usan los protocolos oficiales (OAuth) — nadie de AI-Team puede leer tus correos ni tus chats. Tu información no se usa para entrenar modelos.",
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
