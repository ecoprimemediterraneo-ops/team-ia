"use client";

// El botón "Usar esta cuenta", con su mensaje de error a la vista.
//
// Es de cliente por una sola razón: para poder enseñar en pantalla lo que
// devuelve la acción. Con `action={confirmarCuentaAction}` a secas no hay dónde
// pintar un fallo, y un fallo sin sitio donde salir es una página que no hace
// nada al pulsar — o, si la acción revienta, una página en blanco.

import { useActionState } from "react";
import { confirmarCuentaAction } from "./actions";
import { CONFIRMAR_QUIETO } from "./estado";

export default function BotonConfirmar({
  userId,
  texto,
  tip,
}: {
  userId: string;
  texto: string;
  tip: string;
}) {
  const [estado, formAction, pendiente] = useActionState(confirmarCuentaAction, CONFIRMAR_QUIETO);

  return (
    <form action={formAction} className="mt-4 space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={pendiente}
        title={tip}
        className="btn-mustard text-base px-8 py-3.5 font-bold disabled:opacity-50"
      >
        {texto}
      </button>
      {estado.estado === "error" && (
        <p className="text-sm bg-[color:var(--red)] text-white border-2 border-black px-3 py-2">
          {estado.motivo}
        </p>
      )}
    </form>
  );
}
