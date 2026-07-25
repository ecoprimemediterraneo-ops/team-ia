"use client";

// Acciones de una entrada YA guardada del calendario:
//   · Fecha y hora editables (Europe/Madrid) → "Hacer cambios" reprograma.
//   · "Regenerar texto" / "Regenerar imagen" → rehace el contenido (por separado),
//     manteniendo la MISMA fecha y estado "scheduled". La imagen nueva es durable.
//   · "Publicar ahora" publica ya (respeta los flags/dry-run).
// Una entrada "published" queda con todo deshabilitado (idempotencia). En posts
// subidos a mano la imagen es del usuario → solo se ofrece regenerar el texto.

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reprogramarAction, regenerarTextoAction, regenerarImagenAction } from "./actions";
import PublicarAhora from "./PublicarAhora";
import { PUBLICAR_STATE_INICIAL, type PublicarState } from "./types";

export default function AccionesPost({
  entryId,
  tenantId,
  defaultFecha,
  defaultHora,
  estado,
  esManual,
}: {
  entryId: string;
  tenantId: string;
  defaultFecha: string;
  defaultHora: string;
  estado: string;
  esManual: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<PublicarState, FormData>(
    reprogramarAction,
    PUBLICAR_STATE_INICIAL,
  );
  const [regen, startRegen] = useTransition();
  const [regenMsg, setRegenMsg] = useState<{ ok: boolean; s: string } | null>(null);

  const publicada = estado === "published";

  function correr(fn: () => Promise<PublicarState>) {
    setRegenMsg(null);
    startRegen(async () => {
      const r = await fn();
      setRegenMsg({ ok: r.variant === "ok", s: r.mensaje || "" });
      if (r.variant === "ok") router.refresh();
    });
  }

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

      {/* Regenerar contenido (texto / imagen por separado) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[9px] font-mono uppercase tracking-widest text-black/45">Regenerar:</span>
        <button
          type="button"
          disabled={regen || publicada}
          onClick={() => correr(() => regenerarTextoAction(tenantId, entryId))}
          title={esManual ? "Marta pule tu texto (mantiene tu imagen y fecha)" : "Nuevo texto para el mismo tema (mantiene imagen y fecha)"}
          className="text-[10px] font-bold uppercase tracking-widest border-2 border-black bg-white px-2 py-1.5 hover:bg-black hover:text-[color:var(--mustard)] disabled:opacity-35 disabled:hover:bg-white disabled:hover:text-black"
        >
          {regen ? "…" : esManual ? "✍ Mejorar texto" : "✍ Texto"}
        </button>
        {!esManual && (
          <button
            type="button"
            disabled={regen || publicada}
            onClick={() => correr(() => regenerarImagenAction(tenantId, entryId))}
            title="Nueva imagen con tu marca y plantilla (mantiene texto y fecha)"
            className="text-[10px] font-bold uppercase tracking-widest border-2 border-black bg-white px-2 py-1.5 hover:bg-black hover:text-[color:var(--mustard)] disabled:opacity-35 disabled:hover:bg-white disabled:hover:text-black"
          >
            {regen ? "…" : "🖼 Imagen"}
          </button>
        )}
      </div>
      {esManual && (
        <p className="text-[9px] text-black/40 leading-tight">La imagen de este post es tuya (la subiste); solo se regenera el texto.</p>
      )}
      {regenMsg && (
        <p className={`text-[10px] leading-tight ${regenMsg.ok ? "text-green-700" : "text-[color:var(--red)]"}`}>{regenMsg.s}</p>
      )}

      {/* Publicar ahora (reutiliza el componente existente) */}
      <PublicarAhora entryId={entryId} tenantId={tenantId} disabled={publicada} />
    </div>
  );
}
