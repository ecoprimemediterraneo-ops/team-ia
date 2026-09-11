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
import { traductor, type ClaveTexto } from "@/lib/idioma";
import { useIdiomaPanel } from "@/components/TextoIdioma";

/**
 * El error se traduce por su código, igual que en la bandeja de mensajes. La
 * acción devuelve el texto en castellano, y esta pantalla se graba en inglés
 * para el App Review de Meta.
 */
const MOTIVO: Record<string, ClaveTexto> = {
  sesion: "conf_err_sesion",
  otra_cuenta: "conf_err_otra_cuenta",
  sin_token: "conf_err_sin_token",
  sin_almacen: "conf_err_sin_almacen",
  no_guarda: "conf_err_no_guarda",
};

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
  const t = traductor(useIdiomaPanel());
  const clave = estado.codigo ? MOTIVO[estado.codigo] : undefined;

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
          {clave ? t(clave) : estado.motivo}
        </p>
      )}
    </form>
  );
}
