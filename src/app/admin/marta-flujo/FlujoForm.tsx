"use client";

import { useActionState } from "react";
import { generarYEnviarPropuestaAction } from "./actions";
import { IDLE_STATE, type FlujoState } from "./types";

export default function FlujoForm({ tenantId }: { tenantId: string }) {
  const [state, formAction, pending] = useActionState<FlujoState, FormData>(
    generarYEnviarPropuestaAction,
    IDLE_STATE,
  );

  return (
    <div className="space-y-6">
      <form action={formAction} className="card-hard bg-white p-6 space-y-4">
        <input type="hidden" name="tenantId" value={tenantId} />

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
            Tipo de publicación
          </label>
          <select
            name="mediaType"
            defaultValue="IMAGE"
            className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
          >
            <option value="IMAGE">📷 Post estático (imagen al feed)</option>
            <option value="REELS">🎬 Reel (vídeo vertical 9:16, ≤ 90 s)</option>
            <option value="STORIES_IMAGE">📸 Story · imagen (caduca en 24 h)</option>
            <option value="STORIES_VIDEO">🎞 Story · vídeo (caduca en 24 h)</option>
          </select>
          <p className="text-[11px] text-black/50 mt-1">
            Reels: pega URL de vídeo MP4 público (≤ 16 MB para WhatsApp). El estilo del cliente se mantiene.
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
            Número de WhatsApp del cliente *
          </label>
          <input
            type="text"
            name="recipient"
            required
            placeholder="34600111222 (con prefijo, sin +)"
            className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
          />
          <p className="text-[11px] text-black/50 mt-1">
            Tiene que ser un número autorizado en Meta (modo dev) o cualquiera si la app está aprobada.
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
            URL pública del media *
          </label>
          <input
            type="url"
            name="imageUrl"
            required
            placeholder="https://… .jpg/.png (post) o https://… .mp4 (reel)"
            className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
          />
          <p className="text-[11px] text-black/50 mt-1">
            Post: JPG/PNG ≤ 5 MB. Reel: MP4 vertical 9:16 ≤ 90 s. URL accesible públicamente.
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
            Tema (opcional)
          </label>
          <input
            type="text"
            name="tema"
            placeholder="Promo de blanqueamiento · día del padre · …"
            className="border-2 border-black px-3 py-2 text-sm w-full"
          />
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
            Contexto extra para el caption (opcional)
          </label>
          <textarea
            name="contexto"
            rows={3}
            placeholder="Cosas concretas a destacar, fechas, precios, etc."
            className="border-2 border-black px-3 py-2 text-sm w-full font-mono leading-relaxed"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="btn-mustard text-sm px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Generando y enviando…" : "Generar y enviar propuesta →"}
        </button>
      </form>

      {state.variant !== "idle" && (
        <div
          className={`card-hard p-5 ${
            state.variant === "ok" ? "bg-[#14B8A6] text-white" : "bg-[color:var(--red)] text-white"
          }`}
        >
          <div className="font-stencil text-xl mb-1">{state.title}</div>
          {state.detail && <p className="text-sm leading-relaxed whitespace-pre-wrap">{state.detail}</p>}

          {state.caption && (
            <div className="mt-4 bg-white/20 p-3 border border-white/30">
              <div className="text-[10px] font-mono uppercase tracking-widest mb-1 opacity-70">
                Caption generado
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{state.caption}</p>
            </div>
          )}

          {state.proposalId && (
            <p className="text-[11px] font-mono mt-3 opacity-70">
              proposalId: {state.proposalId}
              {state.recipient ? ` · destinatario: ${state.recipient}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
