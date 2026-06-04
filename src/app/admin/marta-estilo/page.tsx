// Página protegida (solo fundador) para elegir el estilo visual de las fotos de Marta.
// PENDIENTE: persistir StyleConfig en la ficha del tenant. De momento -> style-config-temp.ts.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStyleConfig } from "@/lib/style-config-temp";
import MartaEstiloForm from "./MartaEstiloForm";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export const dynamic = "force-dynamic";

export default async function MartaEstiloPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") redirect("/admin");

  const current = getStyleConfig();

  return (
    <main className="min-h-screen bg-[color:var(--cream)] py-10 px-5">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <a
            href="/admin"
            className="font-mono uppercase tracking-widest text-black/60 hover:text-black underline"
          >
            ← Admin
          </a>
          <span className="text-black/30">·</span>
          <span className="font-mono uppercase tracking-widest text-black/40">
            Marta · estilo visual
          </span>
        </div>

        <header>
          <div className="text-[10px] font-mono tracking-[0.25em] text-black/60 mb-2">
            MOTOR DE ESTILO · TODAS LAS FOTOS PASAN POR ESTE FILTRO
          </div>
          <h1 className="font-stencil text-3xl md:text-5xl leading-tight">
            Estilo visual de Marta
          </h1>
          <p className="text-sm text-black/60 mt-3 max-w-xl">
            Cada cliente tiene un estilo coherente. Elige un preset de color y, opcionalmente,
            un logo que se compone en la esquina. Toda foto que publique Marta pasará por este
            filtro antes de subirse.
          </p>
        </header>

        <MartaEstiloForm
          initialPreset={current.preset}
          initialLogo={current.logoUrl}
          initialAI={current.aiStyle}
        />
      </div>
    </main>
  );
}
