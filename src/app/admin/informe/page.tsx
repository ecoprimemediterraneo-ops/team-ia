// Página del informe mensual por tenant.
//
// Query params:
//   ?tenant=tenant_aiteam&mes=2026-06
//
// Renderiza el informe a partir de bloques. Hoy solo existe el bloque "esencial"
// (valor económico + tiempo ahorrado + 5 KPIs + narrativa redactada por IA).
// Cuando se añadan bloques "completo" y "pro", se renderizan después sin cambiar
// el layout base.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { generarInformeEsencial, type BloqueEsencial } from "@/lib/informe-mensual";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function eur(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

// -----------------------------------------------------------------------------
// Bloque ESENCIAL
// -----------------------------------------------------------------------------

function BloqueEsencialView({ b }: { b: BloqueEsencial }) {
  const m = b.metricas;

  return (
    <section className="card-hard bg-white p-8 md:p-12 print:p-6 print:shadow-none print:border-2">
      {/* Cabecera del bloque */}
      <header className="mb-8 pb-6 border-b-2 border-black/10">
        <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.25em] mb-3 text-black/60">
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold">INFORME MENSUAL</span>
          <span>·</span>
          <span>{b.periodo.etiqueta.toUpperCase()}</span>
          <span>·</span>
          <span>{b.tenant.name.toUpperCase()}</span>
        </div>
        <h1 className="font-stencil text-3xl md:text-5xl leading-tight">
          Tu mes con AI-Team
        </h1>
      </header>

      {b.hayDatos ? (
        <>
          {/* Dos métricas grandes: valor económico + tiempo ahorrado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            <div className="card-hard bg-[color:var(--mustard)] p-6">
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-black/70 mb-2">
                Valor económico generado
              </div>
              <div className="font-stencil text-6xl md:text-7xl leading-none">{eur(m.valorEconomicoEUR)}</div>
              <div className="text-xs text-black/60 mt-2">
                Estimado a partir de {m.ventas} venta{m.ventas === 1 ? "" : "s"} × {eur(b.tenant.conversionValueEUR)} de valor medio.
              </div>
            </div>
            <div className="card-hard bg-white p-6 border-[3px]">
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-black/70 mb-2">
                Tiempo ahorrado
              </div>
              <div className="font-stencil text-6xl md:text-7xl leading-none">
                {m.tiempoAhorradoHoras}<span className="text-3xl ml-2">h</span>
              </div>
              <div className="text-xs text-black/60 mt-2">
                {m.mensajesAtendidos} mensaje{m.mensajesAtendidos === 1 ? "" : "s"} atendido{m.mensajesAtendidos === 1 ? "" : "s"} × {b.tenant.minutesPerInteraction} min de media.
              </div>
            </div>
          </div>

          {/* Banda con los 5 KPIs del mes */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            <Kpi label="Conversaciones" value={m.conversacionesUnicas} />
            <Kpi label="Mensajes" value={m.mensajesAtendidos} />
            <Kpi label="Leads" value={m.leads} />
            <Kpi label="Citas" value={m.citas} />
            <Kpi label="Ventas" value={m.ventas} sub={`Conversión ${pct(m.tasaConversion)}`} />
          </div>

          {/* Narrativa */}
          <article className="text-base md:text-lg leading-relaxed text-black/80 max-w-2xl whitespace-pre-line">
            {b.narrativa}
          </article>
        </>
      ) : (
        <article className="text-base md:text-lg leading-relaxed text-black/80 max-w-2xl">
          {b.narrativa}
        </article>
      )}
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card-hard bg-[color:var(--cream)] p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/55 mb-1">{label}</div>
      <div className="font-stencil text-3xl md:text-4xl leading-none">{value}</div>
      {sub && <div className="text-[10px] text-black/50 mt-1 font-mono">{sub}</div>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Página
// -----------------------------------------------------------------------------

export default async function InformePage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; mes?: string }>;
}) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") redirect("/admin");

  const sp = await searchParams;
  const tenantId = sp.tenant || DEFAULT_TENANT_ID;
  const mes = sp.mes || currentMonth();

  const informe = await generarInformeEsencial(tenantId, mes);

  if (!informe) {
    return (
      <main className="min-h-screen px-5 py-10 bg-[color:var(--cream)]">
        <div className="max-w-3xl mx-auto card-hard bg-white p-8">
          <h1 className="font-stencil text-3xl mb-3">Informe no disponible</h1>
          <p className="text-sm text-black/70">
            El tenant <code className="bg-black/5 px-1">{tenantId}</code> no existe. Comprueba el ID o crea el tenant en <code>src/lib/tenants.ts</code>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 md:px-6 py-8 bg-[color:var(--cream)] print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Toolbar de navegación (no impresa) */}
        <div className="flex flex-wrap items-center gap-3 text-xs print:hidden">
          <a href="/admin" className="font-mono uppercase tracking-widest text-black/60 hover:text-black underline">
            ← Admin
          </a>
          <form className="flex items-center gap-2 ml-auto">
            <input
              type="text"
              name="tenant"
              defaultValue={tenantId}
              className="border-2 border-black px-2 py-1 text-xs font-mono"
              placeholder="tenant_id"
            />
            <input
              type="text"
              name="mes"
              defaultValue={mes}
              className="border-2 border-black px-2 py-1 text-xs font-mono w-24"
              placeholder="YYYY-MM"
            />
            <button type="submit" className="btn-mustard text-xs px-3 py-1">
              Ver
            </button>
            <button
              type="button"
              onClick={undefined}
              className="border-2 border-black px-3 py-1 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-[color:var(--mustard)]"
            >
              {/* La impresión la dispara el usuario con Cmd+P; este botón solo invita */}
              ⌘P para imprimir
            </button>
          </form>
        </div>

        {informe.bloques.map((b) => {
          if (b.kind === "esencial") return <BloqueEsencialView key="esencial" b={b} />;
          return null;
        })}

        {/* Pie del informe (impreso) */}
        <footer className="text-[10px] font-mono tracking-widest text-black/40 text-center pt-2 print:pt-0">
          AI-TEAM · INFORME GENERADO {new Date(informe.generadoEn).toLocaleString("es-ES")}
        </footer>
      </div>
    </main>
  );
}
