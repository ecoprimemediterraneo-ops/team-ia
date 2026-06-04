// Página protegida (solo fundador) — Marta genera el caption del próximo post
// leyendo la ficha del tenant.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID, listTenants } from "@/lib/tenants";
import MartaCaptionForm from "./MartaCaptionForm";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export const dynamic = "force-dynamic";

export default async function MartaCaptionPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") redirect("/admin");

  const tenants = await listTenants();
  const tenantOptions = tenants.map((t) => ({ id: t.id, name: t.name }));

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
            Marta · caption del post
          </span>
        </div>

        <header>
          <div className="text-[10px] font-mono tracking-[0.25em] text-black/60 mb-2">
            CEREBRO DE PUBLICACIÓN · LEE LA FICHA DEL CLIENTE
          </div>
          <h1 className="font-stencil text-3xl md:text-5xl leading-tight">
            Caption del próximo post
          </h1>
          <p className="text-sm text-black/60 mt-3 max-w-xl">
            Marta lee la ficha del tenant, elige (o usa) un tema y escribe el caption listo
            para Instagram. Sin asteriscos, con CTA y hashtags locales.
          </p>
        </header>

        <MartaCaptionForm tenants={tenantOptions} defaultTenantId={DEFAULT_TENANT_ID} />
      </div>
    </main>
  );
}
