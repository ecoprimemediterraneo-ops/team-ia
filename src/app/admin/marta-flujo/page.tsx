// Página para probar el ciclo completo de Marta:
//   1. Generar propuesta (imagen + caption).
//   2. Enviar al WhatsApp del cliente con pregunta de aprobación.
//   3. Cliente responde por WhatsApp:
//        - OK → publica en Instagram (interceptado por el webhook de Pablo).
//        - Otro → respondemos "Vale, lo ajusto" (interceptado igual).
// Acceso: solo fundador.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID, getTenant } from "@/lib/tenants";
import { listProposalsByTenant } from "@/lib/marta-proposals";
import { isPublishEnabled } from "@/lib/marta-publish";
import FlujoForm from "./FlujoForm";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export const dynamic = "force-dynamic";

export default async function MartaFlujoPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") redirect("/admin");

  const sp = await searchParams;
  const tenantId = sp.tenant || DEFAULT_TENANT_ID;
  const tenant = await getTenant(tenantId);
  const enabled = isPublishEnabled();
  const proposals = await listProposalsByTenant(tenantId);

  return (
    <main className="min-h-screen bg-[color:var(--cream)] py-10 px-5">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <a href="/admin" className="font-mono uppercase tracking-widest text-black/60 hover:text-black underline">
            ← Admin
          </a>
          <span className="text-black/30">·</span>
          <span className="font-mono uppercase tracking-widest text-black/40">
            Marta · ciclo aprobación → publicación
          </span>
        </div>

        <header>
          <div className="text-[10px] font-mono tracking-[0.25em] text-black/60 mb-2">
            MARTA · BLOQUE 4
          </div>
          <h1 className="font-stencil text-3xl md:text-5xl leading-tight">
            Propuesta → WhatsApp → Publicar
          </h1>
          <p className="text-sm text-black/60 mt-3 max-w-2xl">
            Genera una propuesta (imagen + caption), la envía al WhatsApp del cliente y queda
            pendiente de aprobación. Cuando el cliente responde <strong>OK</strong>, Marta
            publica automáticamente en Instagram. Si responde otra cosa, Marta acusa recibo
            y la propuesta queda pendiente.
          </p>
        </header>

        {/* Estado de las dos piezas críticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Pill
            label="Tenant"
            value={tenant ? `${tenant.name} (${tenant.id})` : `NO ENCONTRADO (${tenantId})`}
            ok={!!tenant}
          />
          <Pill
            label="MARTA_PUBLISH_ENABLED"
            value={enabled ? "ACTIVO" : "DESACTIVADO"}
            ok={enabled}
            hint={!enabled ? "Sin esto, la publicación quedará en 'skipped'. Pon el flag a true." : undefined}
          />
        </div>

        <FlujoForm tenantId={tenantId} />

        {/* Listado de propuestas del tenant */}
        <section className="card-hard bg-white p-6">
          <h2 className="font-stencil text-2xl mb-3">Propuestas recientes</h2>
          {proposals.length === 0 ? (
            <p className="text-sm text-black/55">Aún no hay propuestas para este tenant.</p>
          ) : (
            <ul className="space-y-3">
              {proposals.slice(0, 10).map((p) => (
                <li key={p.id} className="border-2 border-black/15 p-3 text-sm">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <StatusChip status={p.status} />
                    <span className="font-mono text-[11px] text-black/55">{p.id}</span>
                    <span className="text-black/40">·</span>
                    <span className="text-[11px] text-black/55">
                      → +{p.recipientWhatsapp}
                    </span>
                    <span className="text-black/40">·</span>
                    <span className="text-[11px] text-black/45">
                      {new Date(p.createdAt).toLocaleString("es-ES")}
                    </span>
                  </div>
                  <p className="text-xs text-black/70 whitespace-pre-wrap line-clamp-4">{p.caption}</p>
                  {p.igPermalink && (
                    <a
                      href={p.igPermalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-xs font-bold underline"
                    >
                      Ver post →
                    </a>
                  )}
                  {p.lastClientReply && p.status === "pending" && (
                    <p className="text-[11px] text-black/55 mt-2 italic">
                      Última respuesta del cliente: &ldquo;{p.lastClientReply}&rdquo;
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-[11px] text-black/45 text-center font-mono">
          Para probar otro tenant: <code>?tenant=tenant_xxxx</code>
        </p>
      </div>
    </main>
  );
}

function Pill({ label, value, ok, hint }: { label: string; value: string; ok: boolean; hint?: string }) {
  return (
    <div className={`card-hard p-3 text-xs ${ok ? "bg-[color:var(--mustard)]" : "bg-white border-[3px] border-[color:var(--red)]"}`}>
      <div className="font-mono uppercase tracking-widest text-[10px] opacity-70 mb-0.5">{label}</div>
      <div className="font-bold">{value}</div>
      {hint && <div className="text-[11px] mt-1 text-black/70">{hint}</div>}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const color =
    status === "published"
      ? "bg-[#14B8A6] text-white"
      : status === "pending"
        ? "bg-[color:var(--mustard)] text-black"
        : status === "expired"
          ? "bg-black/20 text-black"
          : "bg-black/40 text-white";
  return (
    <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 font-bold ${color}`}>
      {status}
    </span>
  );
}
