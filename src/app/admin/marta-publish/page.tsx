// Página protegida para probar la publicación de Marta en Instagram.
// Solo accesible para el fundador. Llama al módulo src/lib/marta-publish.ts.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isPublishEnabled } from "@/lib/marta-publish";
import MartaPublishForm from "./MartaPublishForm";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export const dynamic = "force-dynamic";

export default async function MartaPublishPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") redirect("/admin");

  const enabled = isPublishEnabled();

  return (
    <main className="min-h-screen bg-[color:var(--cream)] py-10 px-5">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3 text-xs">
          <a href="/admin" className="font-mono uppercase tracking-widest text-black/60 hover:text-black underline">
            ← Admin
          </a>
          <span className="text-black/30">·</span>
          <span className="font-mono uppercase tracking-widest text-black/40">
            Marta · publish test
          </span>
        </div>

        <header>
          <div className="text-[10px] font-mono tracking-[0.25em] text-black/60 mb-2">
            INSTAGRAM CONTENT PUBLISHING
          </div>
          <h1 className="font-stencil text-3xl md:text-5xl leading-tight">
            Publicar en Instagram como Marta
          </h1>
          <p className="text-sm text-black/60 mt-3 max-w-xl">
            Prueba de publicación contra Graph API. Usa el mismo token y la misma cuenta
            que Marta usa para los DMs. Si el flag está desactivado, no llega nada a Meta.
          </p>
        </header>

        <MartaPublishForm enabled={enabled} />
      </div>
    </main>
  );
}
