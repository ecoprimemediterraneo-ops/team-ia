"use client";

import { useActionState } from "react";
import { publishAction } from "./actions";
import { IDLE_STATE, type PublishActionState } from "./types";

export default function MartaPublishForm({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState<PublishActionState, FormData>(
    publishAction,
    IDLE_STATE,
  );

  return (
    <div className="space-y-6">
      {/* Estado del flag */}
      <div
        className={`card-hard p-4 text-sm ${
          enabled ? "bg-[color:var(--mustard)]" : "bg-white border-[3px] border-[color:var(--red)]"
        }`}
      >
        <div className="font-mono uppercase tracking-widest text-[10px] mb-1">
          MARTA_PUBLISH_ENABLED
        </div>
        <div className="font-bold">
          {enabled ? "ACTIVO — publicaciones llegarán a Instagram" : "DESACTIVADO — pondré el flag a true para publicar"}
        </div>
        {!enabled && (
          <p className="text-xs text-black/70 mt-2 leading-snug">
            Pon <code className="bg-black/5 px-1">MARTA_PUBLISH_ENABLED=true</code> en
            <code className="bg-black/5 px-1 ml-1">.env.local</code> (local) o en Vercel
            (prod) y reinicia/redeploya. Si publicas con el flag desactivado, recibirás un
            aviso pero no llegará nada a Meta.
          </p>
        )}
      </div>

      {/* Form */}
      <form action={formAction} className="card-hard bg-white p-6 space-y-4">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
            Tipo de media
          </label>
          <select
            name="mediaType"
            defaultValue="IMAGE"
            className="border-2 border-black px-3 py-2 font-mono text-sm w-full"
          >
            <option value="IMAGE">Imagen (post estático)</option>
            <option value="VIDEO">Vídeo (post de feed)</option>
            <option value="REELS">Reel</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
            URL del media (pública)
          </label>
          <input
            type="url"
            name="mediaUrl"
            required
            placeholder="https://… .jpg / .mp4"
            className="border-2 border-black px-3 py-2 font-mono text-sm w-full"
          />
          <p className="text-[11px] text-black/50 mt-1">
            Debe ser accesible públicamente por Meta (no localhost, no detrás de auth).
            Para Reel: vídeo vertical 9:16, ≤ 90 s.
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
            Cover URL (opcional, solo Reel)
          </label>
          <input
            type="url"
            name="coverUrl"
            placeholder="https://…thumbnail.jpg"
            className="border-2 border-black px-3 py-2 font-mono text-sm w-full"
          />
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
            Caption
          </label>
          <textarea
            name="caption"
            rows={6}
            maxLength={2200}
            placeholder="Texto del post (máx. 2200 caracteres, ≤ 30 hashtags)…"
            className="border-2 border-black px-3 py-2 font-mono text-sm w-full leading-relaxed"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="btn-mustard text-sm px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Publicando…" : "Publicar en Instagram →"}
        </button>
      </form>

      {/* Resultado */}
      {state.variant !== "idle" && (
        <div
          className={`card-hard p-5 ${
            state.variant === "ok"
              ? "bg-[#14B8A6] text-white"
              : state.variant === "skipped"
                ? "bg-white border-[3px] border-[color:var(--mustard)]"
                : "bg-[color:var(--red)] text-white"
          }`}
        >
          <div className="font-stencil text-xl mb-1">{state.title}</div>
          {state.detail && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{state.detail}</p>
          )}
          {state.metaCode !== undefined && (
            <p className="text-xs font-mono mt-2 opacity-80">Código Meta: #{state.metaCode}</p>
          )}
          {state.permalink && (
            <p className="text-sm mt-3">
              <a
                href={state.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-bold"
              >
                Ver post publicado →
              </a>
            </p>
          )}
          {state.igMediaId && !state.permalink && (
            <p className="text-xs font-mono mt-2 opacity-80">igMediaId: {state.igMediaId}</p>
          )}
        </div>
      )}
    </div>
  );
}
