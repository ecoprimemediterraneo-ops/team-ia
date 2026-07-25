"use client";

// X de borrar, arriba a la derecha de la tarjeta del post. Al pulsarla pide
// confirmación (Aceptar / Cancelar) en un popover dentro de la tarjeta. Solo si
// se acepta se llama a eliminarPostAction y, con router.refresh(), la tarjeta
// desaparece sin recargar.
//   · scheduled (y demás no publicados) → se BORRAN de verdad.
//   · published → no se borra el registro: la acción lo OCULTA del calendario.
// La X es blanca con borde (hover rojo), distinta de mostaza (hacer cambios),
// blanca-a-negro (regenerar) y del publicar, para no confundirse.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarPostAction } from "./actions";

export default function BorrarPost({
  entryId,
  tenantId,
  estado,
}: {
  entryId: string;
  tenantId: string;
  estado: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicada = estado === "published";

  function ejecutar() {
    setError(null);
    start(async () => {
      const r = await eliminarPostAction(tenantId, entryId);
      if (r.variant === "ok") {
        router.refresh(); // la tarjeta desaparece del listado
      } else {
        setError(r.mensaje || "No se pudo borrar.");
        setConfirmando(false);
      }
    });
  }

  return (
    <div className="absolute top-1.5 right-1.5 z-10">
      {!confirmando ? (
        <button
          type="button"
          onClick={() => { setError(null); setConfirmando(true); }}
          title={publicada ? "Ocultar del calendario (mantiene el registro de publicado)" : "Borrar este post del calendario"}
          aria-label={publicada ? "Ocultar post" : "Borrar post"}
          className="w-6 h-6 grid place-items-center border-2 border-black bg-white text-black leading-none font-bold hover:bg-[color:var(--red)] hover:text-white"
        >
          ×
        </button>
      ) : (
        <div className="card-hard bg-white p-2.5 w-56 space-y-2 shadow-[3px_3px_0_0_rgba(0,0,0,0.9)]">
          <p className="text-[10px] leading-tight text-black/80">
            {publicada
              ? "Este post ya se publicó. Se ocultará del calendario, pero seguirá en el registro. ¿Continuar?"
              : "¿Seguro que quieres borrar este post? Esta acción no se puede deshacer."}
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={ejecutar}
              disabled={pending}
              className="flex-1 text-[10px] font-bold uppercase tracking-widest border-2 border-black bg-[color:var(--red)] text-white px-2 py-1.5 hover:brightness-110 disabled:opacity-40"
            >
              {pending ? "…" : publicada ? "Ocultar" : "Borrar"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={pending}
              className="flex-1 text-[10px] font-bold uppercase tracking-widest border-2 border-black bg-white px-2 py-1.5 hover:bg-black/5 disabled:opacity-40"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="mt-1 text-[9px] leading-tight text-[color:var(--red)] bg-white border-2 border-black px-1.5 py-1 w-56 text-right">
          {error}
        </p>
      )}
    </div>
  );
}
