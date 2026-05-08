"use client";
import { useState } from "react";

const faqs = [
  {
    q: "¿Cuánto cuesta?",
    a: "Tres packs: Local 29 €/mes (WhatsApp + llamadas + reseñas), Digital 49 €/mes (correo + redes + email mkt) o Élite 89 €/mes con los 6 especialistas. Precio fundador para siempre si entras antes del lanzamiento.",
  },
  {
    q: "¿Necesito instalar algo o saber de tecnología?",
    a: "No. Te das de alta con tu email, describes tu negocio en 5 preguntas y la unidad ya está lista para trabajar. Sin código, sin configurar APIs raras.",
  },
  {
    q: "¿Y si quiero solo 1 o 2 agentes en vez de los packs?",
    a: "Sí, puedes empezar con cualquier agente suelto desde 19 €/mes y ampliar cuando quieras. Mismo precio fundador.",
  },
  {
    q: "¿Va de verdad a publicar y contestar, o solo es chat con IA?",
    a: "En la versión de lanzamiento sí publica y responde de verdad: WhatsApp con tu número de empresa, reseñas en tu Google My Business, emails desde tu dominio, etc. Hoy estamos en demo y se aprueba todo desde la app antes de salir.",
  },
  {
    q: "¿En qué idiomas trabaja?",
    a: "Español nativo (ES, MX, AR, CO, CL) e inglés. Otros idiomas bajo demanda.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí, sin penalización. 14 días de prueba sin tarjeta. Después, mes a mes. Si no te aporta, te vas.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Servidores en la UE, cifrado en reposo y en tránsito, cumplimiento RGPD. Tu información no se usa para entrenar modelos.",
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
