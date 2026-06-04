import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID, getTenant } from "@/lib/tenants";
import ArranqueForm from "./ArranqueForm";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
export const dynamic = "force-dynamic";

export default async function MartaArranquePage({
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

  return (
    <main className="min-h-screen bg-[color:var(--cream)] py-10 px-5">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3 text-xs">
          <a href="/admin" className="font-mono uppercase tracking-widest text-black/60 hover:text-black underline">
            ← Admin
          </a>
          <span className="text-black/30">·</span>
          <span className="font-mono uppercase tracking-widest text-black/40">
            Marta · arranque (BIO + posts iniciales)
          </span>
        </div>

        <header>
          <div className="text-[10px] font-mono tracking-[0.25em] text-black/60 mb-2">
            MARTA · BLOQUE 5 · MODO ARRANQUE
          </div>
          <h1 className="font-stencil text-3xl md:text-5xl leading-tight">
            Perfil de Instagram desde el día 1
          </h1>
          <p className="text-sm text-black/60 mt-3 max-w-2xl">
            Genera de golpe la BIO del cliente y 6-9 posts coherentes (caption +
            imagen pasada por su estilo). El objetivo es que la cuenta no parezca
            recién abierta.
          </p>
          {tenant && (
            <p className="text-xs font-mono mt-2 text-black/50">
              Tenant: {tenant.name} · {tenant.id}
            </p>
          )}
        </header>

        <ArranqueForm tenantId={tenantId} />
      </div>
    </main>
  );
}
