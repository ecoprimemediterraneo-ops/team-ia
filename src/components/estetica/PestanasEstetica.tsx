"use client";

// La barra de pestañas de estética, fija — mismo mecanismo que
// `PestanasDental.tsx` (enlaces normales, viven dentro del layout así que no
// se desmontan al navegar entre ellas).
//
// LAS RUTAS NO SON LAS DE DENTAL, a propósito. `/dashboard/citas`,
// `/dashboard/pacientes` y `/dashboard/resenas` ya existen en el disco y su
// `page.tsx` rechaza cualquier perfil que no sea "dental". Reutilizarlas
// habría obligado a meterles una segunda rama dentro y a que dos sectores se
// pisaran el mismo fichero; estética estrena las suyas
// (`agenda-estetica`, `leads-valoraciones`, `clientas`, `redes-estetica`) y
// dental se queda intacto. La única URL compartida es `/dashboard`, la
// portada, que ya resuelve por perfil desde el principio.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useDatosCambiados } from "@/components/LatidoPanel";

const PESTANAS = [
  { href: "/dashboard", texto: "Hoy" },
  { href: "/dashboard/agenda-estetica", texto: "Agenda" },
  { href: "/dashboard/leads-valoraciones", texto: "Leads y valoraciones" },
  { href: "/dashboard/clientas", texto: "Clientas" },
  { href: "/dashboard/redes-estetica", texto: "Redes" },
] as const;

export default function PestanasEstetica({ etiquetaClientas = "Clientas", refreshKey = 0 }: { etiquetaClientas?: string; refreshKey?: number }) {
  const pathname = usePathname() || "/dashboard";

  // El número de la pestaña de leads: calientes sin contestar. Se pide en el
  // navegador, como en dental, para no retrasar el resto del panel por él.
  const [numero, setNumero] = useState<number | null>(null);
  // Y en vivo: cuando cambia algo por cualquier canal, se vuelven a pedir.
  const [latido, setLatido] = useState(0);
  useDatosCambiados(() => setLatido((x) => x + 1));
  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await fetch("/api/estetica/portada").catch(() => null);
      const j = r ? await r.json().catch(() => null) : null;
      if (vivo && j?.ok) setNumero(j.calientes ?? 0);
    })();
    return () => { vivo = false; };
    // `refreshKey` cambia tras confirmar una acción del chat: el número se vuelve a pedir.
  }, [refreshKey, latido]);

  return (
    <nav className="flex items-center gap-x-5 gap-y-1 flex-wrap border-b-2 border-black/10 pb-2">
      {PESTANAS.map((p) => {
        const activa = pathname === p.href;
        const n = p.href === "/dashboard/leads-valoraciones" ? numero : null;
        const texto = p.href === "/dashboard/clientas" ? etiquetaClientas : p.texto;
        return (
          <Link
            key={p.href}
            href={p.href}
            // SIN PREFETCH, a propósito — mismo bug real que cazó dental (ver
            // `PestanasDental.tsx`): Next guarda en el Router Cache el RSC de
            // cada pestaña prefetcheada o visitada, y `router.refresh()` (en
            // `PanelEsteticaShell`, tras confirmar una acción) SOLO invalida
            // la pestaña en la que estás. Sin prefetch, cada clic pide el RSC
            // al servidor de cero, así que la cola de leads siempre enseña lo
            // que el chat acaba de escribir, vengas de donde vengas.
            prefetch={false}
            aria-current={activa ? "page" : undefined}
            className={`text-[11px] font-mono uppercase tracking-widest flex items-center gap-1.5 hover:text-black hover:underline ${
              activa ? "text-black font-bold underline" : "text-black/40"
            }`}
          >
            {texto}
            {!!n && (
              <span className="text-[11px] font-mono font-bold bg-[color:var(--red)] text-white border-2 border-black px-1.5 leading-tight">
                {n}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
