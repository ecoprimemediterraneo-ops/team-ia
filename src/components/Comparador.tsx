"use client";
import { useState } from "react";

// Comparador de 3 columnas. En móvil: resumen de las 3 alternativas + detalle
// desplegable. En escritorio: las 3 columnas siempre visibles, con la de
// AI-Team destacada. Marca/estilo intactos. No inventa testimonios.

const tools = [
  { label: "ManyChat o similar", sub: "WhatsApp/DMs con IA", price: 70 },
  { label: "Synthflow / Retell", sub: "asistente de voz IA (llamadas)", price: 149 },
  { label: "Birdeye o similar", sub: "gestión de reseñas", price: 79 },
  { label: "Hootsuite / Metricool", sub: "programar y analizar redes", price: 50 },
  { label: "Mailchimp / Brevo", sub: "email marketing", price: 40 },
  { label: "Canva Pro", sub: "diseño de contenido", price: 15 },
  { label: "Calendly o similar", sub: "agenda/reservas", price: 20 },
];

const subtotal = tools.reduce((s, t) => s + t.price, 0); // 423

const winnerPoints = [
  "Todo en UN sistema integrado: WhatsApp, llamadas, Instagram, reseñas, email, diseño y agenda.",
  "Cero curva de aprendizaje: lo configuramos nosotros.",
  "Todo conectado: ejecuta las acciones que autorices y se adelanta con tu aprobación.",
  "Disponible para responder fuera de tu horario, todos los días.",
];

export default function Comparador({ hidePreciosLink = false }: { hidePreciosLink?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <section id="comparador" className="py-16 md:py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center gap-3 mb-6 text-xs font-mono flex-wrap">
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">COMPARA</span>
          <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">LA CUENTA NO SALE</span>
        </div>
        <h2 className="font-stencil text-4xl md:text-6xl mb-3 leading-[1.02]">
          Hazlo tú, contrata a alguien<br />o ten un sistema.
        </h2>
        <p className="text-base max-w-2xl mb-8 text-black/70">
          La misma operación, tres formas de pagarla. La diferencia se ve de un vistazo.
        </p>

        {/* RESUMEN — 3 alternativas de un vistazo (siempre visible) */}
        <div className="mb-5 space-y-2 max-w-2xl">
          <div className="card-hard bg-white p-4 flex items-center justify-between gap-3">
            <span className="text-sm font-bold leading-tight">Herramientas sueltas</span>
            <span className="font-stencil text-xl text-[color:var(--red)] line-through whitespace-nowrap">423€</span>
          </div>
          <div className="card-hard bg-white p-4 flex items-center justify-between gap-3">
            <span className="text-sm font-bold leading-tight">Contratar a alguien</span>
            <span className="font-stencil text-xl text-[color:var(--red)] line-through whitespace-nowrap">1.800€</span>
          </div>
          <div className="card-hard bg-[color:var(--mustard)] border-[3px] border-black p-4 flex items-center justify-between gap-3">
            <span className="text-sm font-bold leading-tight">AI-Team · todo en uno</span>
            <span className="font-stencil text-3xl whitespace-nowrap">149€</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="cmp-grid"
            className="w-full mt-1 border-2 border-black bg-white font-bold text-sm py-2.5 uppercase tracking-widest hover:bg-black hover:text-[color:var(--mustard)] transition-colors"
          >
            {open ? "Ocultar comparación ▴" : "Ver comparación completa ▾"}
          </button>
        </div>

        {/* DETALLE — 3 columnas. Oculto por defecto; se muestra al desplegar (en todos los tamaños). */}
        <div id="cmp-grid" className={`${open ? "grid" : "hidden"} gap-5 md:grid-cols-[1fr_1fr_1.35fr] items-stretch`}>
          {/* COLUMNA 1 — herramientas sueltas */}
          <article className="card-hard bg-white p-6 flex flex-col">
            <div className="font-stencil text-2xl leading-tight mb-1">Hazlo tú con herramientas sueltas</div>
            <p className="text-xs text-black/55 mb-4">7 apps distintas, contratadas por separado.</p>

            <ul className="space-y-2 text-sm mb-4">
              {tools.map((t) => (
                <li key={t.label} className="flex items-start justify-between gap-3 border-b border-black/10 pb-2">
                  <span className="leading-snug">
                    <span className="font-bold text-black/85">{t.label}</span>
                    <span className="block text-[11px] text-black/45">{t.sub}</span>
                  </span>
                  <span className="font-bold whitespace-nowrap">{t.price}€</span>
                </li>
              ))}
            </ul>

            <div className="flex items-baseline justify-between border-t-2 border-black pt-3">
              <span className="font-bold text-sm uppercase tracking-widest">Subtotal</span>
              <span className="font-stencil text-4xl text-[color:var(--red)] line-through decoration-[3px]">
                {subtotal}€<span className="text-sm">/mes</span>
              </span>
            </div>

            <div className="mt-4 border-2 border-black bg-[color:var(--red)] text-white p-3">
              <div className="text-[10px] font-mono uppercase tracking-widest font-bold mb-1">+ El coste oculto</div>
              <p className="text-sm leading-snug">
                + tu tiempo: aprender a usar 7 herramientas distintas, configurarlas, conectarlas (no
                se hablan entre sí) y mantenerlas cada mes. 7 logins, 7 facturas, 7 curvas de
                aprendizaje. Y aun así, nada es proactivo.
              </p>
            </div>

            <p className="text-[10px] text-black/45 mt-3 leading-snug">
              Precios públicos orientativos de cada herramienta, consultados el 19 de junio de 2026; pueden variar.
            </p>
          </article>

          {/* COLUMNA 2 — contratar a alguien */}
          <article className="card-hard bg-white p-6 flex flex-col">
            <div className="font-stencil text-2xl leading-tight mb-1">Contrata a alguien que lo lleve</div>
            <p className="text-xs text-black/55 mb-4">Una persona que gestione todo eso.</p>

            <div className="text-center py-6">
              <div className="text-[10px] font-mono uppercase tracking-widest text-black/55 mb-2">Coste real con cargas</div>
              <div className="font-stencil text-5xl md:text-6xl text-[color:var(--red)] line-through decoration-[4px]">
                1.800€<span className="text-xl">/mes</span>
              </div>
              <p className="text-xs text-black/60 mt-3">
                Aprox.: sueldo bruto + Seguridad Social + vacaciones. (Sin contar bajas ni rotación.)
              </p>
            </div>

            <div className="border-2 border-black bg-[color:var(--red)] text-white p-3 mb-3">
              <p className="text-sm leading-snug">
                Una sola persona <strong>NO puede con todo</strong>: llamadas + WhatsApp + Instagram +
                analítica + email + diseño + agenda. Es imposible para una persona.
              </p>
            </div>
            <p className="text-sm font-bold leading-snug mt-auto">
              Y trabaja 8 horas al día, 5 días a la semana. No de noche, no en festivos, no en
              vacaciones.
            </p>
          </article>

          {/* COLUMNA 3 — AI-Team (GANADORA, dominante) */}
          <article className="bg-[color:var(--mustard)] p-7 md:p-8 flex flex-col relative border-[4px] border-black shadow-[10px_10px_0_#000]">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[color:var(--red)] text-white text-xs font-bold tracking-widest px-4 py-1 border-2 border-black z-10 whitespace-nowrap shadow-[3px_3px_0_#000]">
              ★ LA MEJOR OPCIÓN
            </div>
            <div className="font-stencil text-4xl leading-none mb-1 mt-1">AI-Team</div>
            <p className="text-xs text-black/70 mb-4">Todo lo anterior en un solo sistema integrado.</p>

            <div className="mb-1">
              <span className="font-stencil text-2xl text-black/45 line-through decoration-[3px]">299€</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-stencil text-7xl md:text-8xl leading-none">149€</span>
              <span className="text-base font-bold">/mes</span>
            </div>
            <div className="inline-block self-start bg-black text-[color:var(--mustard)] text-[10px] font-bold tracking-widest px-2 py-1 mt-3 mb-5">
              PRECIO PARA LOS PRIMEROS CLIENTES · 20 PLAZAS
            </div>

            <ul className="space-y-3 text-sm">
              {winnerPoints.map((b) => (
                <li key={b} className="flex items-start gap-2 leading-snug">
                  <span aria-hidden="true" className="text-[color:var(--red)] font-stencil text-lg leading-none">✓</span>
                  <span className="font-medium">{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 border-2 border-black bg-black text-[color:var(--mustard)] p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest mb-1 text-white/70">Nunca te quedas atrás</div>
              <p className="font-stencil text-lg md:text-xl leading-tight text-[color:var(--mustard)]">
                Tu clínica evoluciona sola. El sistema se adapta a las nuevas tecnologías por ti.
              </p>
            </div>

            <div className="flex-1" />

            <a
              href="/beta"
              className="mt-6 block text-center bg-black text-[color:var(--mustard)] font-bold text-sm py-3.5 px-6 border-[3px] border-black hover:bg-transparent hover:text-black transition-colors tracking-wide uppercase"
            >
              Pide tu demo →
            </a>
          </article>
        </div>

        {/* CIERRE (CTA distinta a la de la tarjeta, para no repetir) */}
        <div className="mt-5 text-center">
          <p className="font-stencil text-xl md:text-3xl max-w-4xl mx-auto leading-tight">
            Pagar <span className="text-[color:var(--red)]">423€</span> en herramientas sueltas, o{" "}
            <span className="text-[color:var(--red)]">1.800€</span> por una persona que no llega a
            todo, o <span className="bg-[color:var(--mustard)] px-2 box-decoration-clone">149€ por un sistema</span>{" "}
            que centraliza todo y responde fuera de tu horario. Tú decides.
          </p>
          {!hidePreciosLink && (
            <a href="/precios" className="inline-block mt-7 text-sm font-bold underline underline-offset-4 hover:text-[color:var(--red)]">
              Ver planes y precios →
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
