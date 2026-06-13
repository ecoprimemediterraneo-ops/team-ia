"use client";

import { useActionState, useState } from "react";
import { arranqueClientAction, nuevaPropuestaClientAction } from "./actions";
import {
  IDLE_ARRANQUE,
  IDLE_PROPOSAL,
  type ArranqueState,
  type ProposalState,
} from "./types";
import type { MartaProposal } from "@/lib/marta-proposals";
import { MARTA_TOPICS } from "@/lib/marta-topics";

type Tab = "nuevo" | "arranque" | "historial";

export default function MartaLivePanel({
  initialProposals,
  enabled,
  defaultRecipient,
}: {
  initialProposals: MartaProposal[];
  enabled: boolean;
  defaultRecipient?: string;
}) {
  const [tab, setTab] = useState<Tab>("nuevo");

  return (
    <div className="space-y-5">
      {!enabled && (
        <div className="card-hard bg-white p-4 border-[3px] border-[color:var(--mustard)] text-sm">
          <div className="font-bold mb-1">Publicación pausada por configuración</div>
          <p className="text-xs text-black/70 leading-snug">
            El interruptor de publicación de Marta está apagado en producción.
            Las propuestas se generan y llegan a tu WhatsApp, pero al aprobar no
            se publica en Instagram hasta que se reactive.
          </p>
        </div>
      )}

      <div className="card-hard bg-white p-1 flex gap-1 text-xs font-mono uppercase tracking-widest">
        <TabBtn id="nuevo" active={tab} setTab={setTab}>Nuevo post</TabBtn>
        <TabBtn id="arranque" active={tab} setTab={setTab}>Arranque</TabBtn>
        <TabBtn id="historial" active={tab} setTab={setTab}>Historial</TabBtn>
      </div>

      {tab === "nuevo" && <NuevoPostBlock defaultRecipient={defaultRecipient} />}
      {tab === "arranque" && <ArranqueBlock />}
      {tab === "historial" && <HistorialBlock proposals={initialProposals} />}
    </div>
  );
}

function TabBtn({
  id,
  active,
  setTab,
  children,
}: {
  id: Tab;
  active: Tab;
  setTab: (t: Tab) => void;
  children: React.ReactNode;
}) {
  const isOn = id === active;
  return (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 px-3 py-2 font-bold ${
        isOn ? "bg-black text-[color:var(--mustard)]" : "hover:bg-black/5"
      }`}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Nuevo post / reel / story
// ============================================================================

function NuevoPostBlock({ defaultRecipient }: { defaultRecipient?: string }) {
  const [state, formAction, pending] = useActionState<ProposalState, FormData>(
    nuevaPropuestaClientAction,
    IDLE_PROPOSAL,
  );

  return (
    <form action={formAction} className="card-hard bg-white p-5 space-y-4">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-black/55 mb-2">
          Tipo de publicación
        </div>
        <select
          name="mediaType"
          defaultValue="IMAGE"
          className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
        >
          <option value="IMAGE">📷 Post estático (imagen al feed)</option>
          <option value="REELS">🎬 Reel (vídeo vertical 9:16, ≤ 90 s)</option>
          <option value="STORIES_IMAGE">📸 Story · imagen (24 h)</option>
          <option value="STORIES_VIDEO">🎞 Story · vídeo (24 h)</option>
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
          Tu WhatsApp (para aprobar la propuesta) *
        </label>
        <input
          type="text"
          name="recipient"
          required
          defaultValue={defaultRecipient || ""}
          placeholder="34600111222"
          className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
        />
        <p className="text-[11px] text-black/50 mt-1">
          Con prefijo internacional, sin espacios. Marta te enviará ahí la propuesta.
        </p>
      </div>

      <div>
        <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
          URL de la imagen / vídeo
        </label>
        <input
          type="url"
          name="imageUrl"
          placeholder="https://… .jpg/.png · o déjalo VACÍO y Marta crea la imagen"
          className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
        />
        <p className="text-[11px] text-black/50 mt-1">
          <strong>Posts/stories de foto:</strong> pega una URL pública (se le aplica el estilo de tu ficha) o
          <strong> déjalo vacío</strong> y Marta genera la imagen con IA a partir de tu ficha.
          <br />
          <strong>Reels / stories de vídeo:</strong> la URL del MP4 (9:16) es obligatoria — el vídeo no se genera.
        </p>
      </div>

      <div>
        <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
          Tema del post
        </label>
        <select
          name="tema"
          defaultValue="auto"
          className="border-2 border-black px-3 py-2 text-sm w-full"
        >
          {MARTA_TOPICS.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        <p className="text-[11px] text-black/50 mt-1">
          Cada tema lleva un guion visual por detrás; combinado con tu ficha genera imágenes específicas de tu negocio.
        </p>
      </div>

      <div>
        <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
          Detalles del texto (opcional)
        </label>
        <textarea
          name="contextoTexto"
          rows={2}
          placeholder="Para el CAPTION: oferta, fechas, precio, tono, lo que quieras destacar…"
          className="border-2 border-black px-3 py-2 text-sm w-full font-mono leading-relaxed"
        />
      </div>

      <div>
        <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
          Describe la foto a generar (opcional)
        </label>
        <textarea
          name="fotoBrief"
          rows={2}
          placeholder="Para la IMAGEN: «una pareja joven, ambiente navideño, luces cálidas». Se combina con tu sector y estilo de marca."
          className="border-2 border-black px-3 py-2 text-sm w-full font-mono leading-relaxed"
        />
        <p className="text-[11px] text-black/50 mt-1">
          Solo aplica si Marta genera la imagen (campo URL vacío). Si pegaste una foto, no se usa.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn-mustard text-sm px-6 py-3 disabled:opacity-50"
      >
        {pending ? "Generando…" : "Generar y enviar a mi WhatsApp →"}
      </button>

      {state.variant !== "idle" && (
        <div
          className={`p-4 ${
            state.variant === "ok" ? "bg-[#14B8A6] text-white" : "bg-[color:var(--red)] text-white"
          } border-2 border-black`}
        >
          <div className="font-stencil text-xl mb-1">{state.title}</div>
          {state.detail && <p className="text-sm leading-relaxed whitespace-pre-wrap">{state.detail}</p>}
          {state.caption && (
            <div className="mt-3 bg-white/20 border border-white/30 p-3">
              <div className="text-[10px] font-mono uppercase tracking-widest mb-1 opacity-70">
                Caption generado
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{state.caption}</p>
            </div>
          )}
        </div>
      )}
    </form>
  );
}

// ============================================================================
// Modo arranque
// ============================================================================

function ArranqueBlock() {
  const [state, formAction, pending] = useActionState<ArranqueState, FormData>(
    arranqueClientAction,
    IDLE_ARRANQUE,
  );

  return (
    <div className="space-y-5">
      <form action={formAction} className="card-hard bg-white p-5 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
            Nº de posts
          </label>
          <input
            type="number"
            name="count"
            defaultValue={6}
            min={1}
            max={9}
            className="border-2 border-black px-3 py-2 text-sm w-24 font-mono"
          />
        </div>
        <button type="submit" disabled={pending} className="btn-mustard text-sm px-5 py-2 disabled:opacity-50">
          {pending ? "Generando…" : "Generar BIO + posts"}
        </button>
        <p className="text-[11px] text-black/55 max-w-md">
          Marta crea de golpe la bio de Instagram y N posts coherentes con tu estilo,
          listos para que tu cuenta parezca real desde el día 1. Tarda 10-60 s.
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
          <div className="card-hard bg-white p-5">
            <div className="text-[10px] font-mono uppercase tracking-widest text-black/55 mb-2">
              Bio propuesta para Instagram
            </div>
            <pre className="whitespace-pre-wrap text-sm font-sans leading-snug bg-[color:var(--cream)] p-4 border-2 border-black/15">
              {state.bio}
            </pre>
          </div>

          {state.warnings && state.warnings.length > 0 && (
            <div className="card-hard bg-white p-4 border-[3px] border-[color:var(--mustard)] text-xs">
              <div className="font-mono uppercase tracking-widest text-[10px] mb-1">Avisos</div>
              <ul className="space-y-1">
                {state.warnings.map((w, i) => (<li key={i} className="text-black/70">• {w}</li>))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.drafts?.map((d) => (
              <article key={d.id} className="card-hard bg-white overflow-hidden">
                <div className="aspect-square bg-black/5 border-b-2 border-black/15 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.imageUrl} alt={d.tema} className="absolute inset-0 w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest bg-[color:var(--mustard)] text-black px-2 py-0.5">
                      {d.styleApplied.preset}{d.aiUsed ? " + IA" : ""}
                    </span>
                    <span className="text-[10px] font-mono text-black/40 truncate">{d.tema}</span>
                  </div>
                  <p className="text-xs text-black/80 leading-relaxed whitespace-pre-wrap line-clamp-8">{d.caption}</p>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Historial
// ============================================================================

function HistorialBlock({ proposals }: { proposals: MartaProposal[] }) {
  if (proposals.length === 0) {
    return (
      <div className="card-hard bg-white p-5 text-sm text-black/55">
        Todavía no hay propuestas. Genera tu primer post en la pestaña <strong>Nuevo post</strong>.
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {proposals.map((p) => (
        <li key={p.id} className="card-hard bg-white p-4 text-sm">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <StatusChip status={p.status} />
            <span className="text-[10px] font-mono text-black/40">{p.mediaType}</span>
            <span className="text-black/40">·</span>
            <span className="text-[11px] text-black/55">→ +{p.recipientWhatsapp}</span>
            <span className="text-black/40">·</span>
            <span className="text-[11px] text-black/45">{new Date(p.createdAt).toLocaleString("es-ES")}</span>
          </div>
          <p className="text-xs text-black/75 whitespace-pre-wrap line-clamp-4">{p.caption}</p>
          {p.imageSource && (
            <div className="mt-2 text-[10px] font-mono">
              <span className="inline-block bg-black/5 border border-black/15 px-1.5 py-0.5">
                {p.imageSource === "generada_ia"
                  ? "🎨 IMAGEN IA"
                  : p.imageSource === "subida_estilizada"
                    ? "🖼️ FOTO + ESTILO FICHA"
                    : p.imageSource === "video_subido"
                      ? "🎬 VÍDEO SUBIDO"
                      : "🖼️ FOTO SUBIDA"}
              </span>
              {p.imagePrompt && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-black/45 select-none">prompt IA (auditar) ▸</summary>
                  <p className="mt-1 text-black/60 whitespace-pre-wrap break-words">{p.imagePrompt}</p>
                </details>
              )}
            </div>
          )}
          {p.igPermalink && (
            <a href={p.igPermalink} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs font-bold underline">
              Ver post en Instagram →
            </a>
          )}
          {p.lastClientReply && p.status === "pending" && (
            <p className="text-[11px] text-black/55 mt-2 italic">
              Tu última respuesta: &ldquo;{p.lastClientReply}&rdquo;
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { c: string; t: string }> = {
    pending:   { c: "bg-[color:var(--mustard)] text-black", t: "PENDIENTE" },
    published: { c: "bg-[#14B8A6] text-white",              t: "PUBLICADO" },
    cancelled: { c: "bg-black/40 text-white",               t: "DESCARTADO" },
    expired:   { c: "bg-black/20 text-black",               t: "CADUCADO" },
  };
  const m = map[status] || { c: "bg-black/15 text-black", t: status.toUpperCase() };
  return (
    <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 font-bold ${m.c}`}>
      {m.t}
    </span>
  );
}
