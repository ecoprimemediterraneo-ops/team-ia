// Precio resumido del posicionamiento (Sistema Operativo):
//   - Producto principal: el SISTEMA. 299€/mes tachado → 149€/mes fundador.
//   - Add-on OPCIONAL: GESTIÓN +249€/mes (lo operamos por el cliente). Se SUMA.
//     Sistema + Gestión = 398€/mes. La Gestión NO está incluida en los 149€.
// Prop `compact`: en la home se muestran menos bullets; en /precios, todos.

const SISTEMA_FEATURES = [
  "WhatsApp: responde, agenda y capta leads 24/7",
  "Llamadas: atiende el teléfono y agenda citas",
  "Reseñas de Google: pide y responde por ti",
  "Correo y agenda: tu bandeja y tu día, ordenados",
  "Email marketing: campañas y reactivación de clientes",
  "Instagram y redes: prepara y programa contenido según tu configuración",
  "Capa proactiva: te avisa y se adelanta (en activación)",
  "Informe mensual: el dinero y el tiempo que te ahorra",
];

export default function Packs({ compact = false }: { compact?: boolean }) {
  return (
    <section id="packs" className="py-16 md:py-24 border-t-[3px] border-black bg-white">
      <div className="max-w-3xl mx-auto px-5">
        <div className="flex items-center gap-3 mb-6 text-xs font-mono flex-wrap">
          <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">PRECIO FUNDADOR</span>
          <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">PARA SIEMPRE</span>
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">SOLO 20 PLAZAS</span>
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
            <span className="text-[9px] font-bold tracking-widest bg-black text-[color:var(--mustard)] px-1.5 py-0.5">50% FUNDADOR</span>
          </div>
          <p className="text-xs text-black/60 leading-tight mb-4">El sistema completo que lleva tu negocio, integrado y proactivo.</p>

          <div className="mb-4">
            <div className="flex items-baseline gap-2">
              <span className="font-stencil text-5xl">149</span>
              <span className="text-sm font-bold">€/mes</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-black/50 line-through">299 €</span>
              <span className="text-[10px] font-bold tracking-widest bg-[color:var(--red)] text-white px-1.5 py-0.5">FUNDADOR · 50%</span>
            </div>
          </div>

          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/55 mb-2">Incluido en el Sistema</div>
          <ul className="space-y-1.5 mb-4 text-sm">
            {(compact ? SISTEMA_FEATURES.slice(0, 3) : SISTEMA_FEATURES).map((a) => (
              <li key={a} className="flex items-start gap-2">
                <span className="text-[color:var(--red)] font-bold leading-snug">▸</span>
                <span className="leading-snug">{a}</span>
              </li>
            ))}
          </ul>

          <a href="/beta" className="btn-mustard text-xs text-center block bg-black text-[color:var(--mustard)] border-black hover:bg-transparent hover:text-black">
            Pide tu demo →
          </a>
          <p className="text-[10px] text-black/50 text-center mt-1 font-mono">* El cobro se activa tras 6 meses gratis</p>
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
            <div className="font-stencil text-2xl leading-none">+249€</div>
            <div className="text-[10px] text-black/50">/mes</div>
          </div>
        </div>

        <p className="text-sm text-black/70 mt-6 border-l-4 border-[color:var(--mustard)] pl-3 max-w-md mx-auto leading-snug">
          <strong>149€/mes</strong> (fundador; normal 299€): 6 meses gratis, sin permanencia. La
          Gestión (+249€) es opcional y aparte → Sistema + Gestión = <strong>398€/mes</strong>.
        </p>

        <p className="text-sm text-black/60 mt-6 text-center">
          ¿Varias sedes o necesidades a medida?{" "}
          <a
            href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-bold hover:text-[color:var(--red)]"
          >
            Hablar con ventas →
          </a>
        </p>
      </div>
    </section>
  );
}
