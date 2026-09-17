"use client";

// La barra de pestañas de dental, fija — mismo mecanismo que
// `PestanasGestoria.tsx` (enlaces normales, viven dentro del layout así que no
// se desmontan al navegar entre ellas), con las cinco pantallas que pidió la
// auditoría: nada de "Correo importante" ni "Facturas", eso es de gestoría.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const PESTANAS = [
  { href: "/dashboard", texto: "Hoy" },
  { href: "/dashboard/citas", texto: "Agenda" },
  { href: "/dashboard/pacientes", texto: "Pacientes" },
  { href: "/dashboard/presupuestos-revisiones", texto: "Presupuestos y revisiones" },
  { href: "/dashboard/resenas", texto: "Reseñas" },
] as const;

export default function PestanasDental() {
  const pathname = usePathname() || "/dashboard";

  // El número de la pestaña de "Presupuestos y revisiones": revisiones sin
  // avisar + presupuestos pendientes. Se pide en el navegador, como en
  // gestoría, para no retrasar el resto del panel por él.
  const [numero, setNumero] = useState<number | null>(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await fetch("/api/dental/seguimiento-resumen").catch(() => null);
      const j = r ? await r.json().catch(() => null) : null;
      if (vivo && j?.ok) setNumero((j.revisionesSinAvisar ?? 0) + (j.presupuestosPendientes ?? 0));
    })();
    return () => { vivo = false; };
  }, []);

  return (
    <nav className="flex items-center gap-x-5 gap-y-1 flex-wrap border-b-2 border-black/10 pb-2">
      {PESTANAS.map((p) => {
        const activa = pathname === p.href;
        const n = p.href === "/dashboard/presupuestos-revisiones" ? numero : null;
        return (
          <Link
            key={p.href}
            href={p.href}
            // SIN PREFETCH, a propósito. Next guarda en el Router Cache del
            // navegador el RSC de cada pestaña que se ha prefetcheado o
            // visitado, y `router.refresh()` (en `PanelDentalShell`, tras
            // confirmar una acción) SOLO invalida la pestaña en la que estás
            // en ese momento — las demás se quedan con su copia vieja en
            // caché. Resultado real: confirmas un presupuesto estando en
            // HOY, navegas a "Presupuestos y revisiones", y ves la lista de
            // ANTES de confirmar hasta que recargas a mano. Sin prefetch,
            // cada clic en una pestaña pide el RSC al servidor de cero, así
            // que siempre ve el dato que acaba de escribir el chat, vengas
            // de donde vengas.
            prefetch={false}
            aria-current={activa ? "page" : undefined}
            className={`text-[11px] font-mono uppercase tracking-widest flex items-center gap-1.5 hover:text-black hover:underline ${
              activa ? "text-black font-bold underline" : "text-black/40"
            }`}
          >
            {p.texto}
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
