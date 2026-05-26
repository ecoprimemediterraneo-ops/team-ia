// Tabla comparativa de los 3 planes — usada en home y en /precios
// Tokens visuales copiados de Packs.tsx: card-hard, --mustard, --red, --cream, font-stencil, font-mono

type Plan = "esencial" | "completo" | "pro";

type Row =
  | { kind: "value"; label: string; esencial: string; completo: string; pro: string; emphasize?: boolean }
  | { kind: "check"; label: string; esencial: boolean; completo: boolean; pro: boolean }
  | { kind: "group"; label: string };

const rows: Row[] = [
  // Precio (sin etiqueta de grupo)
  { kind: "value", label: "Precio fundador", esencial: "89€/mes", completo: "189€/mes", pro: "389€/mes", emphasize: true },
  { kind: "value", label: "Precio normal", esencial: "189€", completo: "389€", pro: "789€" },

  // AGENTES
  { kind: "group", label: "Agentes" },
  { kind: "check", label: "Pablo · WhatsApp 24/7", esencial: true, completo: true, pro: true },
  { kind: "check", label: "Carmen · Llamadas entrantes", esencial: true, completo: true, pro: true },
  { kind: "check", label: "Rocío · Reseñas Google", esencial: true, completo: true, pro: true },
  { kind: "check", label: "Lucía · Correo y agenda", esencial: false, completo: true, pro: true },
  { kind: "check", label: "Eva · Email marketing", esencial: false, completo: true, pro: true },
  { kind: "check", label: "Marta · Instagram", esencial: false, completo: true, pro: true },
  { kind: "check", label: "Diana · Auditoría inicial", esencial: true, completo: true, pro: true },

  // EXTRAS
  { kind: "group", label: "Extras" },
  { kind: "check", label: "Onboarding 1:1 personalizado", esencial: false, completo: false, pro: true },
  { kind: "check", label: "Multiusuario (5 cuentas)", esencial: false, completo: false, pro: true },
  { kind: "check", label: "Soporte prioritario email (4h)", esencial: false, completo: false, pro: true },
  { kind: "check", label: "Integraciones a medida", esencial: false, completo: false, pro: true },

  // GARANTÍAS
  { kind: "group", label: "Garantías" },
  { kind: "check", label: "6 meses gratis", esencial: true, completo: true, pro: true },
  { kind: "check", label: "Sin permanencia", esencial: true, completo: true, pro: true },
  { kind: "check", label: "Precio fundador para siempre", esencial: true, completo: true, pro: true },
];

const ctas: Record<Plan, { label: string; href: string }> = {
  esencial: { label: "Empezar Esencial", href: "/beta" },
  completo: { label: "Empezar Completo", href: "/beta" },
  pro: { label: "Hablar con ventas", href: "/beta" },
};

// Verde militar de la franja de Diana en Packs.tsx
const CHECK = "#14B8A6";

function CheckCell({ on }: { on: boolean }) {
  return on ? (
    <span className="font-bold text-lg" style={{ color: CHECK }} aria-label="incluido">✓</span>
  ) : (
    <span className="text-black/25" aria-label="no incluido">—</span>
  );
}

function PlanColHeader({ name, founder, regular, featured }: { name: string; founder: string; regular: string; featured?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center ${featured ? "bg-[color:var(--mustard)]" : ""}`}>
      <div className="font-stencil text-2xl md:text-3xl">{name}</div>
      <div className="font-stencil text-3xl md:text-4xl mt-1">{founder}</div>
      <div className="text-xs text-black/50 line-through">{regular}</div>
    </div>
  );
}

export default function PlansComparisonTable() {
  return (
    <section id="comparativa" className="py-20 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center gap-2 mb-4 text-[10px] font-mono tracking-[0.2em]">
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold">COMPARATIVA DETALLADA</span>
        </div>
        <h2 className="font-stencil text-4xl md:text-5xl mb-3">
          Compara los 3 planes
        </h2>
        <p className="text-base text-black/60 mb-10">
          Cancelas cuando quieras. Precio fundador para siempre.
        </p>

        {/* DESKTOP / TABLET — tabla horizontal con scroll si hace falta */}
        <div className="hidden md:block">
          <div className="overflow-x-auto card-hard bg-white">
            <table className="w-full text-sm border-collapse min-w-[720px]">
              {/* Header con badge MÁS VENDIDO sobre Completo */}
              <thead>
                <tr>
                  <th className="text-left p-4 border-b-4 border-black align-bottom font-mono text-[10px] tracking-widest text-black/50">
                    CARACTERÍSTICA
                  </th>
                  <th className="p-4 border-b-4 border-l-2 border-black align-bottom">
                    <PlanColHeader name="Esencial" founder="89€/mes" regular="189€" />
                  </th>
                  <th className="p-4 border-b-4 border-l-2 border-black align-bottom relative bg-[color:var(--mustard)]">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[color:var(--red)] text-white text-[10px] font-bold tracking-widest px-3 py-1 border-2 border-black whitespace-nowrap">
                      ★ MÁS VENDIDO
                    </div>
                    <PlanColHeader name="Completo" founder="189€/mes" regular="389€" featured />
                  </th>
                  <th className="p-4 border-b-4 border-l-2 border-black align-bottom">
                    <PlanColHeader name="Pro" founder="389€/mes" regular="789€" />
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, i) => {
                  if (r.kind === "group") {
                    return (
                      <tr key={`g-${i}`} className="bg-black text-[color:var(--mustard)]">
                        <td colSpan={4} className="px-4 py-2 font-mono text-[11px] font-bold tracking-[0.25em]">
                          {r.label.toUpperCase()}
                        </td>
                      </tr>
                    );
                  }
                  if (r.kind === "value") {
                    return (
                      <tr key={`v-${i}`} className="border-t border-black/15">
                        <td className="px-4 py-3 text-black/80">{r.label}</td>
                        <td className="px-4 py-3 text-center border-l-2 border-black/15">
                          <span className={r.emphasize ? "font-stencil text-xl" : "text-xs text-black/50 line-through"}>{r.esencial}</span>
                        </td>
                        <td className="px-4 py-3 text-center border-l-2 border-black/15 bg-[color:var(--mustard)]/30">
                          <span className={r.emphasize ? "font-stencil text-xl" : "text-xs text-black/50 line-through"}>{r.completo}</span>
                        </td>
                        <td className="px-4 py-3 text-center border-l-2 border-black/15">
                          <span className={r.emphasize ? "font-stencil text-xl" : "text-xs text-black/50 line-through"}>{r.pro}</span>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={`c-${i}`} className="border-t border-black/15">
                      <td className="px-4 py-3 text-black/80">{r.label}</td>
                      <td className="px-4 py-3 text-center border-l-2 border-black/15"><CheckCell on={r.esencial} /></td>
                      <td className="px-4 py-3 text-center border-l-2 border-black/15 bg-[color:var(--mustard)]/30"><CheckCell on={r.completo} /></td>
                      <td className="px-4 py-3 text-center border-l-2 border-black/15"><CheckCell on={r.pro} /></td>
                    </tr>
                  );
                })}

                {/* Fila CTA */}
                <tr className="border-t-4 border-black">
                  <td className="px-4 py-5"></td>
                  {(["esencial", "completo", "pro"] as Plan[]).map((p) => (
                    <td key={p} className={`px-3 py-5 text-center border-l-2 border-black/15 ${p === "completo" ? "bg-[color:var(--mustard)]/30" : ""}`}>
                      <a
                        href={ctas[p].href}
                        className={`inline-block w-full text-center px-3 py-3 border-2 border-black font-bold text-xs tracking-widest uppercase ${
                          p === "completo"
                            ? "bg-black text-[color:var(--mustard)] hover:bg-[color:var(--red)] hover:text-white"
                            : "bg-white text-black hover:bg-black hover:text-[color:var(--mustard)]"
                        } transition-colors`}
                      >
                        {ctas[p].label} →
                      </a>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* MÓVIL — 3 bloques apilados */}
        <div className="md:hidden space-y-6">
          {(["esencial", "completo", "pro"] as Plan[]).map((p) => {
            const isFeatured = p === "completo";
            return (
              <article
                key={p}
                className={`card-hard p-5 relative ${isFeatured ? "bg-[color:var(--mustard)]" : "bg-white"}`}
              >
                {isFeatured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[color:var(--red)] text-white text-[10px] font-bold tracking-widest px-3 py-1 border-2 border-black whitespace-nowrap">
                    ★ MÁS VENDIDO
                  </div>
                )}
                <div className="font-stencil text-3xl mb-1 capitalize">{p}</div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-stencil text-4xl">
                    {rows[0].kind === "value" && rows[0][p]}
                  </span>
                </div>
                <div className="text-xs text-black/50 line-through mb-5">
                  {rows[1].kind === "value" && rows[1][p]}
                </div>

                <div className="space-y-3 mb-5">
                  {rows.slice(2).map((r, i) => {
                    if (r.kind === "group") {
                      return (
                        <div key={`mg-${i}`} className="pt-3 pb-1 border-t-2 border-black/30 font-mono text-[10px] font-bold tracking-[0.25em] text-black/70">
                          {r.label.toUpperCase()}
                        </div>
                      );
                    }
                    if (r.kind === "check") {
                      return (
                        <div key={`mc-${i}`} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-black/80">{r.label}</span>
                          <CheckCell on={r[p]} />
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>

                <a
                  href={ctas[p].href}
                  className={`block w-full text-center px-3 py-3 border-2 border-black font-bold text-xs tracking-widest uppercase ${
                    isFeatured
                      ? "bg-black text-[color:var(--mustard)] hover:bg-[color:var(--red)] hover:text-white"
                      : "bg-white text-black hover:bg-black hover:text-[color:var(--mustard)]"
                  } transition-colors`}
                >
                  {ctas[p].label} →
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
