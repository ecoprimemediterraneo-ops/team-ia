// Precio resumido del posicionamiento (Sistema Operativo). Todos los números salen de
// src/lib/oferta.ts (fuente única). NO hardcodear precios aquí.
//   - Producto principal: el SISTEMA. 299€/mes tachado → 149€/mes fundador.
//   - Add-on OPCIONAL: GESTIÓN +799€/mes (lo operamos por el cliente). Se SUMA → 948€/mes.
// Prop `compact`: en la home mostramos SOLO los 4 canales núcleo; en /precios, el stack completo.
import {
  PRECIO_FUNDADOR,
  PRECIO_NORMAL,
  GESTION_PRECIO,
  TOTAL_SISTEMA_GESTION,
  DESCUENTO_PCT,
  BETA,
  CTA,
} from "@/lib/oferta";

// Home (compact): los 4 canales núcleo, en llano.
const CORE_FEATURES = [
  "WhatsApp: responde, agenda y capta leads 24/7",
  "Llamadas: coge el teléfono y agenda citas",
  "Instagram: responde mensajes directos y publica",
  "Agenda: todas tus citas en un sitio, sin dobles reservas",
];

// /precios (full): además, todo lo que va incluido en el Sistema.
const SISTEMA_FEATURES = [
  ...CORE_FEATURES,
  "Reseñas de Google: pide y responde por ti",
  "Email marketing: campañas y reactivación de clientes",
  "Análisis de competencia: alertas de precios y promos",
  "Capa proactiva: te avisa y se adelanta (en activación)",
];

export default function Packs({ compact = false }: { compact?: boolean }) {
  const feats = compact ? CORE_FEATURES : SISTEMA_FEATURES;
  return (
    <section id="packs" className="py-16 md:py-24 border-t-[3px] border-black bg-white">
      <div className="max-w-3xl mx-auto px-5">
        <div className="flex items-center gap-3 mb-6 text-xs font-mono flex-wrap">
          <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">PRECIO FUNDADOR</span>
          <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">PARA SIEMPRE</span>
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">SOLO {BETA.plazas} PLAZAS</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-7xl mb-4">
          Un sistema.<br />Un precio.
        </h2>
        <p className="text-base max-w-2xl mb-6 text-black/70">
          La misma operación que harías con varias herramientas o una contratación, en un solo
          sistema. Sin nóminas y sin apps sueltas.
        </p>

        {/* Tarjeta única: el SISTEMA */}
        <article className="card-hard bg-[color:var(--mustard)] p-6 md:p-7 flex flex-col relative max-w-md mx-auto">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[color:var(--red)] text-white text-xs font-bold tracking-widest px-3 py-1 border-2 border-black z-10 whitespace-nowrap shadow-[3px_3px_0_#000]">
            ★ EL SISTEMA
          </div>
          <div className="flex items-center justify-between gap-2 mb-1 mt-1">
            <div className="font-stencil text-3xl">Sistema Operativo</div>
            <span className="text-[9px] font-bold tracking-widest bg-black text-[color:var(--mustard)] px-1.5 py-0.5">{DESCUENTO_PCT}% FUNDADOR</span>
          </div>
          <p className="text-xs text-black/60 leading-tight mb-4">El sistema completo que lleva tu negocio, integrado y proactivo.</p>

          <div className="mb-4">
            <div className="flex items-baseline gap-2">
              <span className="font-stencil text-5xl">{PRECIO_FUNDADOR}</span>
              <span className="text-sm font-bold">€/mes</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-black/50 line-through">{PRECIO_NORMAL} €</span>
              <span className="text-[10px] font-bold tracking-widest bg-[color:var(--red)] text-white px-1.5 py-0.5">FUNDADOR · {DESCUENTO_PCT}%</span>
            </div>
          </div>

          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/55 mb-2">Incluido en el Sistema</div>
          <ul className="space-y-1.5 mb-4 text-sm">
            {feats.map((a) => (
              <li key={a} className="flex items-start gap-2">
                <span className="text-[color:var(--red)] font-bold leading-snug">▸</span>
                <span className="leading-snug">{a}</span>
              </li>
            ))}
          </ul>

          <a href={CTA.primaria.href} className="btn-mustard text-xs text-center block bg-black text-[color:var(--mustard)] border-black hover:bg-transparent hover:text-black">
            {CTA.primaria.label} →
          </a>
          <p className="text-[10px] text-black/50 text-center mt-1 font-mono">* El cobro se activa tras {BETA.mesesGratis} meses gratis</p>
        </article>

        {/* Add-on opcional: GESTIÓN (fila compacta, no tarjeta) */}
        <div className="card-hard bg-white p-4 mt-5 max-w-md mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-stencil text-lg leading-none">Gestión</span>
              <span className="text-[9px] font-bold tracking-widest bg-black text-[color:var(--mustard)] px-1.5 py-0.5">OPCIONAL</span>
            </div>
            <p className="text-xs text-black/60 leading-snug">La operamos nosotros por ti: revisamos, aprobamos y ajustamos campañas y respuestas.</p>
          </div>
          <div className="text-right shrink-0">
            <div className="font-stencil text-2xl leading-none">+{GESTION_PRECIO}€</div>
            <div className="text-[10px] text-black/50">/mes</div>
          </div>
        </div>

        <p className="text-sm text-black/70 mt-6 border-l-4 border-[color:var(--mustard)] pl-3 max-w-md mx-auto leading-snug">
          <strong>{PRECIO_FUNDADOR}€/mes</strong> (fundador; normal {PRECIO_NORMAL}€): {BETA.mesesGratis} meses gratis, sin permanencia. La
          Gestión (+{GESTION_PRECIO}€) es opcional y aparte → Sistema + Gestión = <strong>{TOTAL_SISTEMA_GESTION}€/mes</strong>.
        </p>

        <p className="text-sm text-black/60 mt-6 text-center">
          ¿Varias sedes o necesidades a medida?{" "}
          <a
            href={CTA.ventas.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-bold hover:text-[color:var(--red)]"
          >
            {CTA.ventas.label} →
          </a>
        </p>
      </div>
    </section>
  );
}
