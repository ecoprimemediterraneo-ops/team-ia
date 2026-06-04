// Página protegida para ver/editar la ficha de marca de un tenant.
// La ficha es la base que alimenta a todos los agentes (Marta, Pablo, etc).

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID, getTenant } from "@/lib/tenants";
import { getFichaOrEmpty } from "@/lib/ficha";
import FichaForm from "./FichaForm";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export const dynamic = "force-dynamic";

export default async function FichaClientePage({
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

  if (!tenant) {
    return (
      <main className="min-h-screen bg-[color:var(--cream)] py-10 px-5">
        <div className="max-w-2xl mx-auto card-hard bg-white p-8">
          <h1 className="font-stencil text-3xl mb-2">Tenant no encontrado</h1>
          <p className="text-sm text-black/70">
            No existe el tenant <code className="bg-black/5 px-1">{tenantId}</code>. Comprueba el
            id o crea el tenant en <code>src/lib/tenants.ts</code>.
          </p>
        </div>
      </main>
    );
  }

  const ficha = await getFichaOrEmpty(tenantId);

  return (
    <main className="min-h-screen bg-[color:var(--cream)] py-10 px-5">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <a
            href="/admin"
            className="font-mono uppercase tracking-widest text-black/60 hover:text-black underline"
          >
            ← Admin
          </a>
          <span className="text-black/30">·</span>
          <span className="font-mono uppercase tracking-widest text-black/40">
            Ficha de cliente
          </span>
        </div>

        <header>
          <div className="text-[10px] font-mono tracking-[0.25em] text-black/60 mb-2">
            FICHA DE MARCA · ALIMENTA A TODOS LOS AGENTES
          </div>
          <h1 className="font-stencil text-3xl md:text-5xl leading-tight">
            Ficha de cliente
          </h1>
          <p className="text-sm text-black/60 mt-3 max-w-xl">
            Una sola ficha por cliente. La leen Marta para escribir captions,
            Pablo para vender por WhatsApp y el resto del equipo. Cuanto mejor
            esté esta ficha, mejor escriben los agentes.
          </p>
        </header>

        <FichaForm tenantId={tenantId} tenantName={tenant.name} initial={ficha} />

        <p className="text-[11px] text-black/45 text-center font-mono">
          Para editar otro tenant: <code>?tenant=tenant_xxxx</code>
        </p>
      </div>
    </main>
  );
}
