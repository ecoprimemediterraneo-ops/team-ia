"use client";
import { useState } from "react";

// Home: bloque único de Confianza + 6 preguntas frecuentes (objeciones reales).
// El detalle de planes vive en /precios. Sin testimonios inventados.
const faqs = [
  {
    q: "¿Cuánto cuesta?",
    a: "El Sistema cuesta 149 €/mes en precio fundador (normal 299 €), con 6 meses gratis, sin tarjeta para empezar y cobro solo tras el periodo. Sin permanencia. La Gestión es opcional (+249 €/mes); Sistema + Gestión = 398 €/mes. Solo 20 plazas fundador con precio congelado. Detalle de planes en /precios.",
  },
  {
    q: "¿Qué incluye?",
    a: "Un único sistema que integra los canales de tu negocio: WhatsApp, llamadas, reseñas de Google, correo y agenda, email marketing e Instagram/redes, más un informe mensual. Tú gestionas un solo sistema. La Gestión (opcional) es que lo operemos nosotros por ti.",
  },
  {
    q: "¿Qué está disponible ahora mismo?",
    a: "Hoy ya funcionan: el email marketing desde tu dominio, la lectura de tu Gmail con borradores reales y la respuesta por WhatsApp Business. En cada pieza te indicamos qué está automático y qué es asistido. Sin humo.",
  },
  {
    q: "¿Qué requiere mi aprobación?",
    a: "Las reseñas de Google, la publicación en Instagram y las llamadas de voz funcionan en modo asistido: el sistema prepara el contenido y tú lo apruebas o publicas con un click, mientras cerramos las aprobaciones de las plataformas (Vapi, Google Business Profile, Meta). La capa proactiva (avisos y acciones automáticas) se activa por fases.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí, sin penalización. 6 meses de prueba sin tarjeta; después, mes a mes. Si no te aporta, te vas. Tus datos se borran a los 30 días tras la cancelación.",
  },
  {
    q: "¿Cómo tratáis mis datos?",
    a: "Servidores en la UE, cifrado en tránsito y cumplimiento RGPD. Las conexiones a Gmail/WhatsApp/etc. usan los protocolos oficiales (OAuth): nadie de AI-Team puede leer tus correos ni tus chats. Tu información no se usa para entrenar modelos.",
  },
];

const garantias = ["Sin tarjeta", "Sin permanencia", "Cancela cuando quieras", "Cumplimiento RGPD"];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-16 md:py-24 border-t-[3px] border-black bg-white">
      <div className="max-w-3xl mx-auto px-5">
        {/* Bloque de confianza (único) */}
        <div className="card-hard bg-[color:var(--cream)] p-5 md:p-6 mb-8">
          <div className="flex flex-wrap gap-2 mb-3">
            {garantias.map((g) => (
              <span key={g} className="text-[11px] font-bold tracking-wide bg-black text-[color:var(--mustard)] px-2 py-1">
                {g}
              </span>
            ))}
          </div>
          <p className="text-sm text-black/70 leading-snug">
            Tras pedir tu demo te escribimos para enseñarte el sistema con tu caso y resolver dudas.
            Sin compromiso ni tarjeta.{" "}
            <a href="/casos" className="underline font-bold hover:text-[color:var(--red)]">
              Ver casos de uso →
            </a>
          </p>
        </div>

        <h2 className="font-stencil text-4xl md:text-6xl text-center mb-8 leading-tight">Preguntas frecuentes</h2>
        <div className="flex flex-col divide-y divide-black/10 border-y border-black/10">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={i}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-q-${i}`}
                  className="w-full flex items-center justify-between py-4 text-left font-semibold text-base md:text-lg gap-4 min-h-[44px]"
                >
                  <span>{f.q}</span>
                  <span aria-hidden="true" className="text-black/30 text-xl shrink-0">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <div
                    id={`faq-panel-${i}`}
                    role="region"
                    aria-labelledby={`faq-q-${i}`}
                    className="pb-5 text-sm text-black/60 leading-relaxed"
                  >
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
