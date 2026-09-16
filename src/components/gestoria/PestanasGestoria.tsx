"use client";

// LA BARRA DE PESTAÑAS, FIJA. Antes "Vencimientos / Facturas / Correo" eran
// tres botones que abrían una sección DEBAJO del chat en `/dashboard` — nunca
// salían de esa ruta, así que nunca perdían el chat. "Expedientes" en cambio
// era un enlace normal a `/dashboard/expedientes`: al pincharlo, la pantalla
// entera cambiaba de ruta, `Portada.tsx` se desmontaba y con ella el chat, el
// selector de cliente y los atajos. Esa es la pestaña que de verdad "se
// recargaba" — las otras tres ya no lo hacían, pero para el usuario las cuatro
// se ven igual, así que el fallo se sentía en cualquiera.
//
// Ahora las cuatro son enlaces normales, y funcionan igual de bien: viven
// dentro de `(gestoria)/layout.tsx`, que las envuelve junto al chat y no se
// desmonta al navegar entre ellas — solo cambia `children`, que es exactamente
// lo que pide la tarea.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Pestana = { href: string; texto: string; numero: "vencimientos" | "facturas" | "correo" | null };

const PESTANAS: Pestana[] = [
  { href: "/dashboard", texto: "Hoy", numero: null },
  { href: "/dashboard/vencimientos", texto: "Vencimientos", numero: "vencimientos" },
  { href: "/dashboard/facturas", texto: "Facturas", numero: "facturas" },
  { href: "/dashboard/correo-importante", texto: "Correo importante", numero: "correo" },
  { href: "/dashboard/expedientes", texto: "Expedientes", numero: null },
];

export default function PestanasGestoria({ pagadosSinFactura = 0 }: { pagadosSinFactura?: number }) {
  const pathname = usePathname() || "/dashboard";
  const sp = useSearchParams();
  const cliente = sp?.get("cliente");

  // Los mismos tres números que llevaba `AccesosGestoria`, pedidos igual: en
  // el navegador y no en el servidor, porque uno de los tres va a Gmail y no
  // vale la pena retrasar el panel por él.
  const [venc, setVenc] = useState<number | null>(null);
  const [fact, setFact] = useState<number | null>(null);
  const [correo, setCorreo] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const j = async (u: string) => {
        const r = await fetch(u).catch(() => null);
        return r ? await r.json().catch(() => null) : null;
      };
      const ag = await j("/api/gestoria/agenda");
      if (vivo && ag?.ok) setVenc((ag.resumen?.vencidas ?? 0) + (ag.resumen?.rojas ?? 0));

      const rec = await j("/api/gestoria/facturas?sinAsignar=1");
      if (vivo) {
        const sinId = rec?.recuento?.sinIdentificar;
        if (typeof sinId === "number") setFact(sinId + pagadosSinFactura);
        else if (pagadosSinFactura) setFact(pagadosSinFactura);
      }

      const cr = await j("/api/lucia/criticos");
      if (vivo && cr?.ok && cr.aplica && cr.conectado) setCorreo(cr.total ?? 0);
    })();
    return () => { vivo = false; };
  }, [pagadosSinFactura]);

  const numero = (n: Pestana["numero"]) => (n === "vencimientos" ? venc : n === "facturas" ? fact : n === "correo" ? correo : null);

  return (
    <nav className="flex items-center gap-x-5 gap-y-1 flex-wrap border-b-2 border-black/10 pb-2">
      {PESTANAS.map((p) => {
        // El cliente elegido viaja con la pestaña: cambiar de pantalla no
        // puede hacer que "se te olvide" qué cliente estabas mirando.
        const href = cliente ? `${p.href}?cliente=${encodeURIComponent(cliente)}` : p.href;
        const activa = pathname === p.href;
        const n = numero(p.numero);
        return (
          <Link
            key={p.href}
            href={href}
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
