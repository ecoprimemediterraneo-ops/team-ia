"use client";

import { useActionState } from "react";
import { scanReviewsAction } from "./actions";
import { IDLE_PROCESS, type ProcessState } from "./types";
import type { RocioReviewProposal } from "@/lib/rocio-proposals";

export default function RocioLivePanel({
  proposals,
  defaultRecipient,
  mockMode,
  autoReplyEnabled,
}: {
  proposals: RocioReviewProposal[];
  defaultRecipient?: string;
  mockMode: boolean;
  autoReplyEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<ProcessState, FormData>(
    scanReviewsAction,
    IDLE_PROCESS,
  );

  return (
    <div className="space-y-5">
      {mockMode && (
        <div className="card-hard bg-white p-3 border-[3px] border-[color:var(--mustard)] text-xs">
          <span className="font-bold">Modo demo activo</span> — se usan reseñas de ejemplo mientras
          Google nos aprueba el acceso al API real. Al desactivar <code className="bg-black/5 px-1">ROCIO_USE_MOCK</code>,
          el panel pasa solo a tu Google Business.
        </div>
      )}

      <form action={formAction} className="card-hard bg-white p-5 space-y-3">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
            Tu WhatsApp (para aprobar las respuestas)
          </label>
          <input
            type="text"
            name="recipient"
            defaultValue={defaultRecipient || ""}
            placeholder="34600111222"
            className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
          />
          <p className="text-[11px] text-black/50 mt-1">
            Con prefijo internacional, sin espacios. Rocío te enviará ahí cada propuesta de respuesta antes de publicar.
            {autoReplyEnabled
              ? " · Auto-publica 5★ sin texto."
              : " · Auto-publicación desactivada (todas las respuestas pasan por ti)."}
          </p>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="btn-mustard text-sm px-6 py-3 disabled:opacity-50"
        >
          {pending ? "Escaneando…" : "Escanear reseñas nuevas →"}
        </button>
      </form>

      {state.variant === "error" && (
        <div className="card-hard p-4 bg-[color:var(--red)] text-white">
          <div className="font-stencil text-xl">{state.title}</div>
          {state.detail && <p className="text-sm mt-1 whitespace-pre-wrap">{state.detail}</p>}
        </div>
      )}

      {state.variant === "ok" && state.result && (
        <div className="card-hard bg-white p-5">
          <div className="font-stencil text-xl mb-1">{state.title}</div>
          <p className="text-sm text-black/70 mb-3">{state.detail}</p>

          {state.result.errors.length > 0 && (
            <ul className="text-xs text-[color:var(--red)] space-y-1 mb-3">
              {state.result.errors.map((er, i) => (<li key={i}>• {er}</li>))}
            </ul>
          )}

          <ul className="space-y-2 text-sm">
            {state.result.details.map((d) => (
              <li key={d.reviewId} className="border-2 border-black/15 p-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-widest bg-[color:var(--mustard)] text-black px-2 py-0.5">
                    {actionLabel(d.action)}
                  </span>
                  <span className="text-[10px] font-mono text-black/45">★{d.rating} · {d.reviewer}</span>
                </div>
                {d.detail && <p className="text-xs text-black/80 whitespace-pre-wrap leading-relaxed">{d.detail}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card-hard bg-white p-5">
        <h3 className="font-stencil text-2xl mb-3">Historial de propuestas</h3>
        {proposals.length === 0 ? (
          <p className="text-sm text-black/55">Aún no hay propuestas. Pulsa "Escanear reseñas nuevas".</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {proposals.slice(0, 10).map((p) => (
              <li key={p.id} className="border-2 border-black/15 p-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <ProposalChip status={p.status} />
                  <span className="text-[11px] font-mono text-black/45">
                    ★{p.rating} · {p.reviewerName}
                  </span>
                  <span className="text-black/30">·</span>
                  <span className="text-[11px] text-black/45">
                    {new Date(p.createdAt).toLocaleString("es-ES")}
                  </span>
                </div>
                {p.reviewText && (
                  <p className="text-xs text-black/55 italic mb-1 line-clamp-2">"{p.reviewText}"</p>
                )}
                <p className="text-xs text-black/85 whitespace-pre-wrap leading-relaxed">{p.draftReply}</p>
                {p.lastClientReply && p.status === "pending" && (
                  <p className="text-[11px] text-black/55 mt-2 italic">
                    Tu última respuesta: &ldquo;{p.lastClientReply}&rdquo;
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function actionLabel(a: string): string {
  switch (a) {
    case "auto_replied": return "AUTO PUBLICADA";
    case "proposed": return "ENVIADA A TI";
    case "skipped_already_answered": return "YA RESPONDIDA";
    case "error": return "ERROR";
    default: return a.toUpperCase();
  }
}

function ProposalChip({ status }: { status: string }) {
  const map: Record<string, { c: string; t: string }> = {
    pending:   { c: "bg-[color:var(--mustard)] text-black", t: "PENDIENTE" },
    published: { c: "bg-[#14B8A6] text-white",              t: "PUBLICADA" },
    cancelled: { c: "bg-black/40 text-white",               t: "DESCARTADA" },
    expired:   { c: "bg-black/20 text-black",               t: "CADUCADA" },
  };
  const m = map[status] || { c: "bg-black/15 text-black", t: status.toUpperCase() };
  return (
    <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 font-bold ${m.c}`}>
      {m.t}
    </span>
  );
}
