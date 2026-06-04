"use client";

import { useActionState, useState, useEffect } from "react";
import { generateAction, type CaptionState } from "./actions";

const initial: CaptionState = {
  ts: 0,
  ok: false,
  caption: "",
  tema: "",
  tenantId: "",
};

export default function MartaCaptionForm({
  tenants,
  defaultTenantId,
}: {
  tenants: { id: string; name: string }[];
  defaultTenantId: string;
}) {
  const [state, action, pending] = useActionState(generateAction, initial);
  const [tenantId, setTenantId] = useState(defaultTenantId);
  const [tema, setTema] = useState("");
  const [contexto, setContexto] = useState("");
  const [editedCaption, setEditedCaption] = useState("");

  useEffect(() => {
    if (state.ok && state.ts > 0) setEditedCaption(state.caption);
  }, [state.ok, state.ts, state.caption]);

  const counter = editedCaption.length;
  const overLimit = counter > 2200;

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-[10px] font-mono tracking-[0.25em] text-black/60 mb-1">
              TENANT
            </div>
            <select
              name="tenantId"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="w-full bg-white border-2 border-black px-3 py-2 text-sm font-mono"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.id})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-[10px] font-mono tracking-[0.25em] text-black/60 mb-1">
              TEMA (opcional)
            </div>
            <input
              type="text"
              name="tema"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Ej: promoción limpieza dental, horario de verano…"
              className="w-full bg-white border-2 border-black px-3 py-2 text-sm font-mono"
            />
          </label>
        </div>

        <label className="block">
          <div className="text-[10px] font-mono tracking-[0.25em] text-black/60 mb-1">
            CONTEXTO EXTRA (opcional)
          </div>
          <textarea
            name="contexto"
            value={contexto}
            onChange={(e) => setContexto(e.target.value)}
            rows={2}
            placeholder="Ej: evento del sábado, novedad de un servicio, dato de temporada…"
            className="w-full bg-white border-2 border-black px-3 py-2 text-sm font-mono"
          />
        </label>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="submit"
            disabled={pending}
            className="px-6 py-3 bg-black text-white font-stencil text-lg disabled:opacity-50"
          >
            {pending
              ? "Marta escribiendo…"
              : state.ok && state.ts > 0
                ? "Regenerar"
                : "Generar caption"}
          </button>
          {state.ok && state.ts > 0 && (
            <span className="text-xs font-mono text-black/60">
              Tema: <strong>{state.tema}</strong>
            </span>
          )}
          {!state.ok && state.error && (
            <span className="text-sm font-mono text-red-700">{state.error}</span>
          )}
        </div>
      </form>

      {state.ok && state.ts > 0 && (
        <section className="space-y-2">
          <div className="text-[10px] font-mono tracking-[0.25em] text-black/60">
            CAPTION GENERADO (editable)
          </div>
          <textarea
            value={editedCaption}
            onChange={(e) => setEditedCaption(e.target.value)}
            rows={14}
            className="w-full bg-white border-2 border-black px-3 py-3 text-sm font-mono whitespace-pre-wrap"
          />
          <div className="flex items-center justify-between text-xs font-mono">
            <span className={overLimit ? "text-red-700" : "text-black/60"}>
              {counter} / 2200
            </span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(editedCaption)}
              className="px-3 py-1 border-2 border-black bg-white hover:bg-black hover:text-white"
            >
              Copiar
            </button>
          </div>
          <div className="text-[11px] font-mono text-black/50 border-2 border-dashed border-black/30 p-3 bg-yellow-50">
            PENDIENTE: punto de unión con motor de imagen + aprobación por WhatsApp.
            Ver src/lib/marta-caption.ts → función prepararPublicacion (comentada).
          </div>
        </section>
      )}
    </div>
  );
}
