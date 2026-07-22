"use client";

// Botón "Publicar ahora" de UNA entrada del calendario (prueba manual y
// controlada). Respeta MARTA_PUBLISH_ENABLED: si está apagado, informa de que
// no ha publicado en vez de publicar.

import { useActionState } from "react";
import { publicarAhoraAction } from "./actions";
import { PUBLICAR_STATE_INICIAL, type PublicarState } from "./types";

export default function PublicarAhora({
  entryId,
  tenantId,
  disabled,
}: {
  entryId: string;
  tenantId: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<PublicarState, FormData>(
    publicarAhoraAction,
    PUBLICAR_STATE_INICIAL,
  );

  const color =
    state.variant === "ok"
      ? "text-green-700"
      : state.variant === "error"
        ? "text-[color:var(--red)]"
        : "text-black/55";

  return (
    <form action={formAction} className="pt-1">
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="tenantId" value={tenantId} />
      <button
        type="submit"
        disabled={pending || disabled}
        title={disabled ? "Solo se puede publicar una entrada programada" : "Publica esta entrada ahora"}
        className="text-[10px] font-bold uppercase tracking-widest border-2 border-black px-2 py-1 hover:bg-black hover:text-[color:var(--mustard)] disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-black"
      >
        {pending ? "Publicando…" : "Publicar ahora"}
      </button>
      {state.ts > 0 && state.mensaje && (
        <p className={`text-[10px] mt-1 leading-tight ${color}`}>{state.mensaje}</p>
      )}
    </form>
  );
}
