"use client";

// El botón "Desconectar", con su mensaje de error a la vista.
//
// Es de cliente por lo mismo que `BotonConfirmar`: para poder pintar lo que
// devuelve la acción. Con `action={desconectarInstagramAction}` a secas no hay
// dónde enseñar un fallo, y un botón que no dice nada al pulsarlo es
// indistinguible de un botón roto — que es exactamente lo que parecía.

import { useActionState } from "react";
import { desconectarInstagramAction } from "./actions";
import { DESCONECTAR_QUIETO } from "./estado";
import { traductor, type Idioma, type ClaveTexto } from "@/lib/idioma";

const MOTIVO: Record<string, ClaveTexto> = {
  sesion: "desc_error_sesion",
  no_borra: "desc_error_no_borra",
};

export default function BotonDesconectar({
  texto,
  tip,
  idioma,
}: {
  texto: string;
  tip: string;
  idioma: Idioma;
}) {
  const [estado, formAction, pendiente] = useActionState(
    desconectarInstagramAction,
    DESCONECTAR_QUIETO,
  );
  const t = traductor(idioma);

  return (
    <form action={formAction} className="space-y-2">
      <button
        type="submit"
        disabled={pendiente}
        title={tip}
        className="text-xs uppercase tracking-widest font-bold border-2 border-black px-4 py-2.5 hover:bg-[color:var(--red)] hover:text-white hover:border-[color:var(--red)] disabled:opacity-50"
      >
        {pendiente ? t("desc_desconectando") : texto}
      </button>
      {estado.estado === "error" && (
        <p className="text-sm bg-[color:var(--red)] text-white border-2 border-black px-3 py-2">
          {t(MOTIVO[estado.motivo ?? ""] ?? "desc_error_no_borra")}
        </p>
      )}
    </form>
  );
}
