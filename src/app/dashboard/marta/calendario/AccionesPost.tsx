"use client";

// Acciones de una entrada YA guardada del calendario:
//   · Fecha y hora editables (Europe/Madrid) → "Programar" reprograma el
//     scheduledAt y la deja "scheduled" (dueNow la recogerá a la nueva hora).
//   · "Publicar ahora" publica ya, ignorando la fecha (respeta los flags/dry-run).
// Una entrada "published" queda con todo deshabilitado (idempotencia).

import { useActionState } from "react";
import { reprogramarAction } from "./actions";
import PublicarAhora from "./PublicarAhora";
import { PUBLICAR_STATE_INICIAL, type PublicarState } from "./types";

export default function AccionesPost({
  entryId,
  tenantId,
  defaultFecha,
  defaultHora,
  estado,
}: {
  entryId: string;
  tenantId: string;
  defaultFecha: string;
  defaultHora: string;
  estado: string;
}) {
  const [state, formAction, pending] = useActionState<PublicarState, FormData>(
    reprogramarAction,
    PUBLICAR_STATE_INICIAL,
  );

  const publicada = estado === "published";

  return (
    <div className="pt-1.5 mt-1 border-t-2 border-black/10 space-y-2">
      {/* Reprogramar */}
      <form action={formAction} className="flex flex-wrap items-end gap-1.5">
        <input type="hidden" name="entryId" value={entryId} />
        <input type="hidden" name="tenantId" value={tenantId} />
        <label className="block">
          <span className="block text-[9px] font-mono uppercase tracking-widest text-black/45">Fecha</span>
          <input
            type="date"
            name="fecha"
            defaultValue={defaultFecha}
            disabled={publicada}
            className="border-2 border-black px-1.5 py-1 text-xs bg-white disabled:opacity-40"
          />
        </label>
        <label className="block">
          <span className="block text-[9px] font-mono uppercase tracking-widest text-black/45">Hora</span>
          <input
            type="time"
            name="hora"
            defaultValue={defaultHora}
            disabled={publicada}
            className="border-2 border-black px-1.5 py-1 text-xs bg-white disabled:opacity-40"
          />
        </label>
        <button
          type="submit"
          disabled={pending || publicada}
          title={publicada ? "Ya publicada" : "Guarda la nueva fecha y hora de este post"}
          className="text-[10px] font-bold uppercase tracking-widest border-2 border-black bg-[color:var(--mustard)] px-2 py-1.5 hover:brightness-95 disabled:opacity-35"
        >
          {pending ? "Guardando…" : "Hacer cambios"}
        </button>
      </form>
      {state.ts > 0 && state.mensaje && (
        <p className={`text-[10px] leading-tight ${state.variant === "ok" ? "text-green-700" : "text-[color:var(--red)]"}`}>
          {state.mensaje}
        </p>
      )}

      {/* Publicar ahora (reutiliza el componente existente) */}
      <PublicarAhora entryId={entryId} tenantId={tenantId} disabled={publicada} />
    </div>
  );
}
