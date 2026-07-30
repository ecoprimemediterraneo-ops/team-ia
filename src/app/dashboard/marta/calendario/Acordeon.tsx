"use client";

// Sección plegable (acordeón) para ordenar el cuerpo del calendario. SOLO
// presentación: la barra mostaza es el título/toggle y debajo va el contenido
// EXACTO que ya existía (formularios, listado…), sin tocar nada.
//
// El cuerpo se muestra/oculta con CSS (hidden/block), NO se desmonta, para que
// el estado interno de los formularios (pauta, marca, subir post) se conserve
// al plegar y volver a desplegar. Tokens de marca: card-hard + mostaza + Anton.

import { useState, type ReactNode } from "react";

export default function Acordeon({
  titulo,
  badge,
  defaultOpen = false,
  children,
}: {
  titulo: string;
  /** Texto opcional a la derecha del título (p. ej. "3 posts"). */
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full card-hard bg-[color:var(--mustard)] px-4 py-3 flex items-center gap-3 text-left hover:brightness-95"
      >
        <span className="flex-1 min-w-0 font-stencil text-lg md:text-xl uppercase leading-none truncate">
          {titulo}
        </span>
        {badge && (
          <span className="text-[10px] font-mono uppercase tracking-widest text-black/60 shrink-0">
            {badge}
          </span>
        )}
        <span
          aria-hidden
          className="grid place-items-center w-6 h-6 border-2 border-black bg-white font-bold text-sm leading-none shrink-0"
        >
          {open ? "–" : "+"}
        </span>
      </button>

      {/* hidden en vez de desmontar → conserva el estado de los formularios */}
      <div className={open ? "block mt-3" : "hidden"}>{children}</div>
    </div>
  );
}
