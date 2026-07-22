"use client";

// Disparador manual del mes de Marta + resultado de la previsualización.
// "Previsualizar" NO guarda nada (seguro con MARTA_AUTO_ENABLED apagado).

import { useActionState } from "react";
import { ejecutarMesAction } from "./actions";
import { MES_STATE_INICIAL, type MesState } from "./types";
import PostCard from "./PostCard";

export default function MesForm({ tenantId, autoEnabled }: { tenantId: string; autoEnabled: boolean }) {
  const [state, formAction, pending] = useActionState<MesState, FormData>(
    ejecutarMesAction,
    MES_STATE_INICIAL,
  );

  return (
    <div className="space-y-5">
      <form action={formAction} className="card-hard bg-white p-5 space-y-4">
        <input type="hidden" name="tenantId" value={tenantId} />

        <div className="flex items-end gap-3 flex-wrap">
          <label className="block">
            <span className="block text-[11px] font-mono uppercase tracking-widest text-black/50 mb-1">
              Posts a generar
            </span>
            <input
              type="number"
              name="max"
              defaultValue={6}
              min={1}
              max={20}
              className="border-2 border-black px-2 py-1.5 text-sm bg-white w-28"
            />
          </label>

          <button
            type="submit"
            name="modo"
            value="preview"
            disabled={pending}
            className="border-[3px] border-black bg-[color:var(--mustard)] px-4 py-2 text-sm font-bold uppercase tracking-widest hover:brightness-95 disabled:opacity-50"
          >
            {pending ? "Generando…" : "Previsualizar"}
          </button>

          <button
            type="submit"
            name="modo"
            value="programar"
            disabled={pending}
            title="Genera y deja los posts programados (no publica nada)"
            className="border-[3px] border-black bg-black text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-black/80 disabled:opacity-40"
          >
            Generar y programar
          </button>
        </div>

        <p className="text-[11px] text-black/50 leading-relaxed">
          <strong>Previsualizar</strong> genera imagen + texto y te los enseña aquí, pero{" "}
          <strong>no guarda ni publica nada</strong>. <strong>Generar y programar</strong> los deja como
          <code className="mx-1 bg-black/5 px-1">scheduled</code> en el calendario de Marta para que el flujo
          de publicación existente los recoja a su hora. Ninguno de los dos publica en Instagram.
          {!autoEnabled && (
            <>
              {" "}La generación <strong>automática mensual</strong> (n8n) sí está bloqueada:{" "}
              <code className="bg-black/5 px-1">MARTA_AUTO_ENABLED</code> no está a{" "}
              <code className="bg-black/5 px-1">true</code>.
            </>
          )}
        </p>
      </form>

      {state.ts > 0 && state.title && (
        <div
          className={`card-hard p-4 ${
            state.variant === "error"
              ? "bg-[color:var(--red)] text-white"
              : "bg-[color:var(--mustard)] text-black"
          }`}
        >
          <p className="font-bold text-sm">{state.title}</p>
          {state.detail && <p className="text-xs mt-1 opacity-90">{state.detail}</p>}
          {state.warnings && state.warnings.length > 0 && (
            <ul className="text-[11px] mt-2 space-y-0.5 opacity-90 list-disc pl-4">
              {state.warnings.slice(0, 6).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}

      {state.posts && state.posts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="font-stencil text-2xl uppercase">
              {state.persistido ? "Mes programado" : "Previsualización"}
            </h2>
            <span className="text-[11px] font-mono uppercase tracking-widest text-black/45">
              {state.posts.length} posts
              {!state.persistido && " · no guardados"}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.posts.map((p, i) => (
              <PostCard
                key={`${p.scheduledAt}_${i}`}
                scheduledAt={p.scheduledAt}
                imageUrl={p.imageUrl}
                texto={p.texto}
                hashtags={p.hashtags}
                temaLabel={p.temaLabel}
                estado={state.persistido ? "scheduled" : "preview"}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
