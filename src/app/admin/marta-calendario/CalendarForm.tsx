"use client";

import { useActionState } from "react";
import { scheduleArranqueAction } from "./actions";
import { IDLE_STATE, type CalendarState } from "./types";

export default function CalendarForm({ tenantId }: { tenantId: string }) {
  const [state, formAction, pending] = useActionState<CalendarState, FormData>(
    scheduleArranqueAction,
    IDLE_STATE,
  );

  return (
    <div className="space-y-6">
      <form action={formAction} className="card-hard bg-white p-6 grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <input type="hidden" name="tenantId" value={tenantId} />
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">Nº posts</label>
          <input type="number" name="count" defaultValue={6} min={1} max={12} className="border-2 border-black px-2 py-1 text-sm w-full font-mono" />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">Días</label>
          <input type="number" name="daySpan" defaultValue={7} min={1} max={30} className="border-2 border-black px-2 py-1 text-sm w-full font-mono" />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">Posts/día</label>
          <input type="number" name="postsPerDay" defaultValue={2} min={1} max={3} className="border-2 border-black px-2 py-1 text-sm w-full font-mono" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-mono uppercase tracking-widest text-black/55">
            <input type="checkbox" name="startsTomorrow" value="1" defaultChecked className="mr-1 align-middle" />
            Empieza mañana
          </label>
          <button type="submit" disabled={pending} className="btn-mustard text-xs px-4 py-2 disabled:opacity-50">
            {pending ? "Programando…" : "Generar + programar"}
          </button>
        </div>
      </form>

      {state.variant === "error" && (
        <div className="card-hard p-4 bg-[color:var(--red)] text-white">
          <div className="font-stencil text-xl">{state.title}</div>
          {state.detail && <p className="text-sm mt-1 whitespace-pre-wrap">{state.detail}</p>}
        </div>
      )}

      {state.variant === "ok" && (
        <>
          <div className="card-hard p-4 bg-[#14B8A6] text-white">
            <div className="font-stencil text-xl">{state.title}</div>
            {state.detail && <p className="text-sm mt-1">{state.detail}</p>}
          </div>

          {state.warnings && state.warnings.length > 0 && (
            <div className="card-hard bg-white p-4 border-[3px] border-[color:var(--mustard)]">
              <div className="font-mono uppercase tracking-widest text-[10px] mb-2">Avisos</div>
              <ul className="text-xs space-y-1">
                {state.warnings.map((w, i) => (<li key={i} className="text-black/70">• {w}</li>))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
