// Vista previa del informe mensual UNIFICADO.
//
// Query params:
//   ?tenant=tenant_aiteam&mes=2026-07        → informe del tenant (coge su primer negocio)
//   ?slug=bendito-arte&mes=2026-07           → informe de un negocio concreto
//   &force=1                                 → veredicto ignorando el anti-duplicado
//
// Por defecto se previsualiza el MES ANTERIOR, que es el que manda el cron.
// Además del email, la página enseña QUÉ HARÍA el cron con él (destinatario,
// datos encontrados, interruptor) usando `prepararInforme`, la misma función que
// decide el envío. Aquí NUNCA se envía nada.
//
// IMPORTANTE — una sola fuente: esta página NO maqueta nada. Pide el HTML a
// `construirInformeUnificado()` (informe-unificado.ts), exactamente el mismo que
// se envía por email desde /api/cron/informe-mensual, y lo pinta dentro de un
// iframe. Así lo que se revisa aquí es literalmente el correo que le llega al
// cliente: si alguien toca el renderer, cambian los dos a la vez.
//
// Antes esta página tenía su propio JSX (el informe "B" de valor generado) que no
// se enviaba a nadie y que se fue separando del email. Ese JSX ya no existe.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { DEFAULT_TENANT_ID, getTenant } from "@/lib/tenants";
import {
  periodoMes,
  construirInformeUnificado,
  primerNegocioDelTenant,
  prepararInforme,
  type DestinoInforme,
} from "@/lib/informe-unificado";
import { getBusinessBySlug } from "@/lib/booking";

export const dynamic = "force-dynamic";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

/**
 * Mes que se previsualiza por defecto: el ANTERIOR, el mismo que manda el cron.
 * Antes salía el mes en curso, que es un informe que nunca se enviará — se
 * revisaba una cosa y se mandaba otra.
 */
function mesPorDefecto(): string {
  return periodoMes(null)!.periodoKey;
}

export default async function InformePage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; mes?: string; slug?: string; force?: string }>;
}) {
  // getSessionLocal (no getSession): en producción es idéntico, y en local levanta
  // el bypass de desarrollo para poder revisar el informe sin magic link. Mismo
  // criterio que el panel de Marta.
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") redirect("/admin");

  const sp = await searchParams;
  const tenantId = sp.tenant || DEFAULT_TENANT_ID;
  const mes = sp.mes || mesPorDefecto();
  const periodo = periodoMes(mes);

  if (!periodo) {
    return (
      <Marco>
        <h1 className="font-stencil text-3xl mb-3">Mes inválido</h1>
        <p className="text-sm text-black/70">
          Usa el formato <code className="bg-black/5 px-1">YYYY-MM</code> (por ejemplo <code className="bg-black/5 px-1">2026-07</code>).
        </p>
      </Marco>
    );
  }

  // Negocio: el del ?slug= si viene; si no, el primero del tenant. Sin negocio el
  // informe sigue saliendo, pero sin la sección de reservas.
  const business = sp.slug
    ? await getBusinessBySlug(sp.slug)
    : await primerNegocioDelTenant(tenantId);

  const { subject, html, informe } = await construirInformeUnificado({
    business,
    tenantId,
    periodo,
  });

  // Veredicto de envío: lo calcula `prepararInforme`, la MISMA función que usa el
  // cron para decidir. Así esta página no dice "se enviaría" por su cuenta: dice
  // lo que el cron haría de verdad, sin enviar nada.
  const tenant = await getTenant(tenantId);
  const destino: DestinoInforme | null = business
    ? { tipo: "negocio", business }
    : tenant
      ? { tipo: "tenant", tenant }
      : null;
  // ?force=1 salta el anti-duplicado SOLO para el veredicto: si este mes ya se
  // envió, sin esto el motivo sería siempre "duplicado" y no se vería lo que de
  // verdad decidiría el cron (flag, datos, destinatario). Sigue sin enviar nada.
  const force = sp.force === "1";
  const decision = destino ? await prepararInforme(destino, periodo, { force }) : null;

  const MOTIVOS: Record<string, string> = {
    ok: "Se enviaría ahora mismo.",
    duplicado: "Ya se envió este mes (usa force para repetirlo).",
    sin_email_dueno: "No hay email de dueño al que mandarlo.",
    sin_datos: "Sin datos suficientes: no se manda para no enviar un informe vacío.",
    flag_off: "INFORME_MENSUAL_SEND_ENABLED está apagado: se calcula y se registra, pero no sale.",
  };

  return (
    <main className="min-h-screen px-4 md:px-6 py-8 bg-[color:var(--cream)]">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Barra de control */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <a href="/admin" className="font-mono uppercase tracking-widest text-black/60 hover:text-black underline">
            ← Admin
          </a>
          <form className="flex flex-wrap items-center gap-2 ml-auto">
            <input
              type="text"
              name="tenant"
              defaultValue={tenantId}
              className="border-2 border-black px-2 py-1 text-xs font-mono"
              placeholder="tenant_id"
            />
            <input
              type="text"
              name="slug"
              defaultValue={business?.slug || ""}
              className="border-2 border-black px-2 py-1 text-xs font-mono w-32"
              placeholder="slug negocio"
            />
            <input
              type="text"
              name="mes"
              defaultValue={periodo.periodoKey}
              className="border-2 border-black px-2 py-1 text-xs font-mono w-24"
              placeholder="YYYY-MM"
            />
            <button type="submit" className="btn-mustard text-xs px-3 py-1">
              Ver
            </button>
          </form>
        </div>

        {/* Ficha de lo que se está viendo */}
        <div className="card-hard bg-white p-4 text-xs font-mono space-y-1">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span><b>ASUNTO:</b> {subject}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-black/60">
            <span>tenant: {informe.tenantId}</span>
            <span>negocio: {business?.slug ?? "— (sin reservas)"}</span>
            <span>periodo: {periodo.from} → {periodo.to}</span>
            <span>posts: {informe.contenido.length}</span>
          </div>
          <div className="text-black/50 pt-1">
            Esto es EXACTAMENTE el email que se envía desde /api/cron/informe-mensual (mismo renderer).
          </div>
        </div>

        {/* Veredicto: qué haría el cron con este informe. No envía nada. */}
        {decision && (
          <div
            className={`card-hard p-4 text-xs font-mono space-y-1 ${
              decision.enviaria ? "bg-[color:var(--mustard)]" : "bg-white"
            }`}
          >
            <div>
              <b>{decision.enviaria ? "SE ENVIARÍA" : "NO SE ENVIARÍA"}</b> — {MOTIVOS[decision.motivo] ?? decision.motivo}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-black/60">
              <span>destinatario: {decision.destinatario ?? "—"}</span>
              <span>destino: {decision.ref}</span>
            </div>
            <div className="text-black/60">
              datos encontrados: {decision.sustancia.senales.length ? decision.sustancia.senales.join(" · ") : "ninguno"}
            </div>
            <div className="text-black/50 pt-1">
              Esta página NUNCA envía. Para mandarlo de verdad hace falta el cron con CRON_SECRET y
              INFORME_MENSUAL_SEND_ENABLED=true.
            </div>
          </div>
        )}

        {/* El email, tal cual */}
        <div className="card-hard bg-white overflow-hidden">
          <iframe
            title="Informe mensual (vista previa del email)"
            srcDoc={html}
            className="w-full block"
            style={{ height: "1400px", border: "none" }}
          />
        </div>

        <footer className="text-[10px] font-mono tracking-widest text-black/40 text-center">
          AI-TEAM · INFORME GENERADO {new Date(informe.generadoEn).toLocaleString("es-ES")}
        </footer>
      </div>
    </main>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-5 py-10 bg-[color:var(--cream)]">
      <div className="max-w-3xl mx-auto card-hard bg-white p-8">{children}</div>
    </main>
  );
}
