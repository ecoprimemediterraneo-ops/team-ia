"use client";

// "Por qué este panel es para ti" — panel lateral que explica al dueño por qué
// su cuenta está montada así.
//
// TODO el texto sale del perfil de sector (`sectores.ts`). Aquí no hay ni una
// frase escrita a mano sobre ningún sector: si mañana cambia el perfil, cambia
// esta explicación sola. Por eso recibe el perfil entero y no cadenas sueltas.

import { useEffect, useState } from "react";
import type { PerfilSector } from "@/lib/sectores";

export default function PorQueEstePanel({ perfil }: { perfil: PerfilSector }) {
  const [abierto, setAbierto] = useState(false);

  // Cerrar con Escape: es un panel superpuesto, tiene que dejarse cerrar sin ratón.
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto]);

  const v = perfil.vocabulario;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs font-mono border-2 border-black px-2.5 py-1.5 hover:bg-black hover:text-white whitespace-nowrap"
      >
        ¿Por qué este panel?
      </button>

      {abierto && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setAbierto(false)}
            aria-hidden="true"
          />
          <aside
            className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[440px] bg-[color:var(--cream)] border-l-[3px] border-black overflow-y-auto"
            role="dialog"
            aria-label="Por qué este panel es para ti"
          >
            <div className="sticky top-0 bg-[color:var(--cream)] border-b-2 border-black px-5 py-3 flex items-center justify-between gap-3">
              <span className="font-stencil text-xl leading-none">Por qué este panel es para ti</span>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="text-xs font-mono border-2 border-black px-2 py-1 hover:bg-black hover:text-white"
              >✕</button>
            </div>

            <div className="px-5 py-5 space-y-6">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-black/50">Tu panel</div>
                <div className="font-stencil text-2xl leading-none mt-1">{perfil.label}</div>
                <p className="text-[15px] leading-relaxed text-black/80 mt-3">{perfil.porQue.resumen}</p>
              </div>

              <div>
                <h3 className="font-stencil text-lg mb-2">Qué hace por ti</h3>
                <ul className="space-y-2">
                  {perfil.porQue.queHacePorTi.map((x, i) => (
                    <li key={i} className="text-[15px] leading-snug text-black/80 flex gap-2">
                      <span className="text-[color:var(--red)] font-bold shrink-0">·</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-stencil text-lg mb-2">Qué no verás, y por qué</h3>
                <ul className="space-y-2">
                  {perfil.porQue.queNoVeras.map((x, i) => (
                    <li key={i} className="text-[15px] leading-snug text-black/70 flex gap-2">
                      <span className="text-black/40 font-bold shrink-0">·</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t-2 border-black/10 pt-4">
                <div className="text-[11px] font-mono uppercase tracking-widest text-black/50 mb-1">
                  Cómo llamamos a las cosas
                </div>
                <p className="text-sm text-black/70">
                  A quien te escribe le decimos <b>{v.cliente}</b>; a un encuentro, <b>{v.cita}</b>; y a lo
                  que ofreces, <b>{v.servicio}</b>.
                </p>
              </div>

              <p className="text-xs text-black/50">
                ¿Tu negocio no funciona así? Se cambia desde Perfil del negocio.
              </p>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
