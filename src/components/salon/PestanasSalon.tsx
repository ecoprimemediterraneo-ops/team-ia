"use client";

// La barra de pestañas del salón, fija — mismo mecanismo que
// `PestanasDental.tsx` y `PestanasSalon.tsx` (enlaces normales, viven dentro
// del layout así que no se desmontan al navegar entre ellas).
//
// LAS RUTAS SON PROPIAS (`agenda-salon`, `clientas-salon`, `lista-espera`,
// `redes-salon`): las de las clínicas rechazan cualquier perfil que no sea el
// suyo, y meterles una segunda rama habría hecho que dos sectores se pisaran el
// mismo fichero. La única URL compartida es `/dashboard`, que ya resuelve por
// perfil desde el principio.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useDatosCambiados } from "@/components/LatidoPanel";

const PESTANAS = [
  { href: "/dashboard", texto: "Hoy" },
  { href: "/dashboard/agenda-salon", texto: "Agenda" },
  { href: "/dashboard/clientas-salon", texto: "Clientas" },
  { href: "/dashboard/lista-espera", texto: "Lista de espera" },
  { href: "/dashboard/redes-salon", texto: "Redes" },
] as const;

export default function PestanasSalon({ etiquetaClientas = "Clientas", refreshKey = 0 }: { etiquetaClientas?: string; refreshKey?: number }) {
  const pathname = usePathname() || "/dashboard";

  // Los números de las pestañas: cuántas esperan hueco y cuántas clientas
  // dormidas hay. Se piden en el navegador, como en dental, para no retrasar el
  // resto del panel por ellos.
  const [numeros, setNumeros] = useState<{ espera: number; dormidas: number } | null>(null);
  // Y en vivo: cuando cambia algo por cualquier canal, se vuelven a pedir.
  const [latido, setLatido] = useState(0);
  useDatosCambiados(() => setLatido((x) => x + 1));
  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await fetch("/api/salon/portada").catch(() => null);
      const j = r ? await r.json().catch(() => null) : null;
      if (vivo && j?.ok) setNumeros({ espera: j.espera ?? 0, dormidas: j.dormidas ?? 0 });
    })();
    return () => { vivo = false; };
    // `refreshKey` cambia tras confirmar una acción del chat: los números de las
    // pestañas (cuántas esperan, cuántas dormidas) se vuelven a pedir.
  }, [refreshKey, latido]);

  return (
    <nav className="flex items-center gap-x-5 gap-y-1 flex-wrap border-b-2 border-black/10 pb-2">
      {PESTANAS.map((p) => {
        const activa = pathname === p.href;
        const n = p.href === "/dashboard/lista-espera" ? numeros?.espera : p.href === "/dashboard/clientas-salon" ? numeros?.dormidas : null;
        const texto = p.href === "/dashboard/clientas-salon" ? etiquetaClientas : p.texto;
        return (
          <Link
            key={p.href}
            href={p.href}
            // SIN PREFETCH, a propósito — mismo bug real que cazó dental (ver
            // `PestanasDental.tsx`): Next guarda en el Router Cache el RSC de
            // cada pestaña prefetcheada o visitada, y `router.refresh()` (en
            // `PanelSalonShell`, tras confirmar una acción) SOLO invalida la
            // pestaña en la que estás. Sin prefetch, cada clic pide el RSC al
            // servidor de cero, así que la agenda y la lista de espera siempre
            // enseñan lo que el chat acaba de escribir, vengas de donde vengas.
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
