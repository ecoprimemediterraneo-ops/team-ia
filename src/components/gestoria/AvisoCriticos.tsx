"use client";

// Contador de correos críticos sin abrir de hoy, para la portada del panel.
//
// Se pinta en cliente para que la portada no espere a Gmail: si Google tarda o
// no está conectado, el panel carga igual y aquí no aparece nada. Callar cuando
// no hay nada que decir es parte del diseño — un cartel rojo permanente deja de
// leerse a la semana.

import { useEffect, useState } from "react";

export default function AvisoCriticos() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/lucia/criticos");
        const json = await res.json();
        if (vivo && json.aplica) setTotal(json.total ?? 0);
      } catch {
        // Sin contador, la portada sigue igual de útil.
      }
    })();
    return () => { vivo = false; };
  }, []);

  if (total < 1) return null;

  return (
    <a
      href="/dashboard/lucia"
      className="card-hard flex items-center gap-3 p-4 bg-[color:var(--red)] text-white hover:-translate-y-0.5 transition"
    >
      <span className="text-3xl shrink-0" aria-hidden>🔴</span>
      <span className="flex-1 min-w-0">
        <span className="block font-stencil text-2xl leading-none">
          {total} {total === 1 ? "correo crítico sin abrir" : "correos críticos sin abrir"}
        </span>
        <span className="block text-[11px] uppercase tracking-widest opacity-90 mt-0.5">
          Han entrado hoy · Hacienda, Seguridad Social, juzgados y demás remitentes de tu lista
        </span>
      </span>
      <span className="text-xs font-mono uppercase tracking-widest border-2 border-white px-2 py-1 whitespace-nowrap shrink-0">
        Ver bandeja
      </span>
    </a>
  );
}
