"use client";
import { useState } from "react";

const faqs = [
  {
    q: "¿Cuánto cuesta?",
    a: "Estamos en lista de espera. Los primeros 500 negocios entran con precio fundador: 29 €/mes por toda la tropa. El precio público al lanzar será de 49 €/mes.",
  },
  {
    q: "¿Tengo que saber escribir prompts?",
    a: "No. Solo describes tu negocio y tus objetivos en lenguaje normal. La tropa hace el resto y te consulta cuando necesita tu visto bueno.",
  },
  {
    q: "¿En qué idiomas trabaja?",
    a: "Español nativo (ES, MX, AR, CO, CL) e inglés. Otros idiomas bajo demanda.",
  },
  {
    q: "¿Se integra con mis herramientas actuales?",
    a: "Sí. Gmail, Outlook, Google Calendar, Instagram, LinkedIn, WhatsApp Business, HubSpot, Notion y más. Si usas algo raro, lo conectamos.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí, sin penalización ni preguntas. Mes a mes. Si no te aporta, te vas.",
  },
  {
    q: "¿Qué pasa con mis datos?",
    a: "Servidores en la UE, cifrado en reposo y en tránsito, cumplimiento RGPD. Tus datos no se usan para entrenar modelos.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-24 border-t-[3px] border-black bg-white">
      <div className="max-w-3xl mx-auto px-5">
        <h2 className="font-display text-5xl md:text-7xl text-center mb-12">¿Preguntas?</h2>
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
