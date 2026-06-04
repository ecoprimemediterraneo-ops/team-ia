"use client";

import { useActionState } from "react";
import { arranqueAction } from "./actions";
import { IDLE_STATE, type ArranqueState } from "./types";

export default function ArranqueForm({ tenantId }: { tenantId: string }) {
  const [state, formAction, pending] = useActionState<ArranqueState, FormData>(
    arranqueAction,
    IDLE_STATE,
  );

  return (
    <div className="space-y-6">
      <form action={formAction} className="card-hard bg-white p-6 flex flex-wrap items-end gap-3">
        <input type="hidden" name="tenantId" value={tenantId} />
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
            Nº de posts
          </label>
          <input
            type="number"
            name="count"
            defaultValue={6}
            min={1}
            max={12}
            className="border-2 border-black px-3 py-2 text-sm w-24 font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="btn-mustard text-sm px-6 py-3 disabled:opacity-50"
        >
          {pending ? "Generando…" : "Generar BIO + posts"}
        </button>
        <p className="text-[11px] text-black/50 ml-auto max-w-md">
          Tarda 10-60s. Cada draft = caption por Haiku + imagen stock pasada por
          el estilo de la ficha (sharp + Nano Banana si está configurado).
        </p>
      </form>

      {state.variant === "error" && (
        <div className="card-hard p-4 bg-[color:var(--red)] text-white">
          <div className="font-stencil text-xl">{state.title}</div>
          {state.detail && <p className="text-sm mt-1 whitespace-pre-wrap">{state.detail}</p>}
        </div>
      )}

      {state.variant === "ok" && (
        <>
          <div className="card-hard bg-white p-6">
            <div className="text-[10px] font-mono uppercase tracking-widest text-black/55 mb-2">
              Bio propuesta para Instagram
            </div>
            <pre className="whitespace-pre-wrap text-base font-sans leading-snug bg-[color:var(--cream)] p-4 border-2 border-black/15">
              {state.bio}
            </pre>
          </div>

          {state.warnings && state.warnings.length > 0 && (
            <div className="card-hard bg-white p-4 border-[3px] border-[color:var(--mustard)]">
              <div className="font-mono uppercase tracking-widest text-[10px] mb-2">
                Avisos durante la generación
              </div>
              <ul className="text-xs space-y-1">
                {state.warnings.map((w, i) => (
                  <li key={i} className="text-black/70">• {w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {state.drafts?.map((d) => (
              <article key={d.id} className="card-hard bg-white overflow-hidden">
                <div className="aspect-square bg-black/5 border-b-2 border-black/15 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.imageUrl}
                    alt={d.tema}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest bg-[color:var(--mustard)] text-black px-2 py-0.5">
                      {d.styleApplied.preset}{d.aiUsed ? " + IA" : ""}
                    </span>
                    <span className="text-[10px] font-mono text-black/40 truncate">{d.tema}</span>
                  </div>
                  <p className="text-xs text-black/80 leading-relaxed whitespace-pre-wrap line-clamp-8">
                    {d.caption}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
