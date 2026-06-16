"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  arranqueClientAction,
  nuevaPropuestaClientAction,
  aprobarYPublicarAction,
  pedirCambiosAction,
  descartarAction,
  guardarProgramacionAction,
  ejecutarProgramacionAhoraAction,
  guardarReglaComentarioAction,
  toggleReglaComentarioAction,
  eliminarReglaComentarioAction,
  probarComentarioAction,
  type ProbarComentarioResult,
} from "./actions";
import {
  IDLE_ARRANQUE,
  IDLE_PROPOSAL,
  type ArranqueState,
  type ProposalState,
} from "./types";
import type { MartaProposal } from "@/lib/marta-proposals";
import type { MartaSchedule } from "@/lib/marta-schedule";
import type { CommentRule, MatchMode } from "@/lib/marta-comment-rules";
import { MARTA_TOPICS } from "@/lib/marta-topics";

type Tab = "nuevo" | "arranque" | "historial" | "programacion" | "comentarios";

export default function MartaLivePanel({
  initialProposals,
  enabled,
  defaultRecipient,
  initialSchedule,
  directPublishEnabled,
  cronDaily,
  initialCommentRules,
  commentDmEnabled,
}: {
  initialProposals: MartaProposal[];
  enabled: boolean;
  defaultRecipient?: string;
  initialSchedule: MartaSchedule;
  directPublishEnabled: boolean;
  cronDaily: boolean;
  initialCommentRules: CommentRule[];
  commentDmEnabled: boolean;
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

      <div className="card-hard bg-white p-1 flex gap-1 text-xs font-mono uppercase tracking-widest flex-wrap">
        <TabBtn id="nuevo" active={tab} setTab={setTab}>Nuevo post</TabBtn>
        <TabBtn id="programacion" active={tab} setTab={setTab}>Programación</TabBtn>
        <TabBtn id="comentarios" active={tab} setTab={setTab}>Comentarios → DM</TabBtn>
        <TabBtn id="arranque" active={tab} setTab={setTab}>Arranque</TabBtn>
        <TabBtn id="historial" active={tab} setTab={setTab}>Historial</TabBtn>
      </div>

      {tab === "nuevo" && (
        <NuevoPostBlock
          defaultRecipient={defaultRecipient}
          onReviewInApp={() => setTab("historial")}
        />
      )}
      {tab === "programacion" && (
        <ProgramacionBlock
          initialSchedule={initialSchedule}
          directPublishEnabled={directPublishEnabled}
          cronDaily={cronDaily}
          onGenerated={() => setTab("historial")}
        />
      )}
      {tab === "comentarios" && (
        <ComentariosBlock
          initialRules={initialCommentRules}
          commentDmEnabled={commentDmEnabled}
        />
      )}
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

function NuevoPostBlock({
  defaultRecipient,
  onReviewInApp,
}: {
  defaultRecipient?: string;
  onReviewInApp?: () => void;
}) {
  const [state, formAction, pending] = useActionState<ProposalState, FormData>(
    nuevaPropuestaClientAction,
    IDLE_PROPOSAL,
  );
  const [canal, setCanal] = useState<"app" | "whatsapp">("app");

  // Cuando la propuesta se genera para revisar en la app, saltar al Historial,
  // donde aparece arriba con su imagen + caption + botones de acción.
  useEffect(() => {
    if (state.variant === "ok" && state.reviewInApp) onReviewInApp?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts]);

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
        <div className="text-[10px] font-mono uppercase tracking-widest text-black/55 mb-2">
          ¿Cómo quieres revisar la propuesta?
        </div>
        <select
          name="canal"
          value={canal}
          onChange={(e) => setCanal(e.target.value as "app" | "whatsapp")}
          className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
        >
          <option value="app">🖥 Revisar aquí en la app (recomendado)</option>
          <option value="whatsapp">📲 Enviar a mi WhatsApp</option>
        </select>
        <p className="text-[11px] text-black/50 mt-1">
          {canal === "app"
            ? "Marta crea el post y aparece abajo con botones para Publicar, Pedir cambios o Descartar. No necesitas WhatsApp."
            : "Marta te enviará la propuesta a tu WhatsApp y la apruebas respondiendo ahí."}
        </p>
      </div>

      {canal === "whatsapp" && (
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
            Tu WhatsApp (para aprobar la propuesta) *
          </label>
          <input
            type="text"
            name="recipient"
            required={canal === "whatsapp"}
            defaultValue={defaultRecipient || ""}
            placeholder="34600111222"
            className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
          />
          <p className="text-[11px] text-black/50 mt-1">
            Con prefijo internacional, sin espacios. Marta te enviará ahí la propuesta.
          </p>
        </div>
      )}

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
        {pending
          ? "Generando…"
          : canal === "app"
            ? "Generar y revisar en la app →"
            : "Generar y enviar a mi WhatsApp →"}
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
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <StatusChip status={p.status} />
            <span className="text-[10px] font-mono text-black/40">{p.mediaType}</span>
            <span className="text-black/40">·</span>
            <span className="text-[11px] text-black/55">
              {p.recipientWhatsapp ? `→ +${p.recipientWhatsapp}` : "📲 revisión en la app"}
            </span>
            <span className="text-black/40">·</span>
            <span className="text-[11px] text-black/45">{new Date(p.createdAt).toLocaleString("es-ES")}</span>
          </div>
          {/* Miniatura de la imagen (no para vídeo) */}
          {p.imageUrl && p.mediaType !== "REELS" && p.mediaType !== "STORIES_VIDEO" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imageUrl}
              alt="propuesta"
              className="w-full max-w-[260px] border-2 border-black mb-2 object-cover"
            />
          )}
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
          {p.status === "pending" && <ProposalActions proposalId={p.id} />}
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

// ============================================================================
// Acciones in-app sobre una propuesta pendiente (aprobar / cambios / descartar)
// ============================================================================

function ProposalActions({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showChanges, setShowChanges] = useState(false);
  const [instr, setInstr] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message: string }>) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) {
        setShowChanges(false);
        setInstr("");
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-3 border-t-2 border-black/10 pt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => aprobarYPublicarAction(proposalId))}
          className="text-xs uppercase tracking-widest font-bold border-2 border-black px-3 py-1.5 bg-green-600 text-white disabled:opacity-50"
        >
          ✅ Publicar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setShowChanges((s) => !s)}
          className="text-xs uppercase tracking-widest font-bold border-2 border-black px-3 py-1.5 bg-[color:var(--mustard)] disabled:opacity-50"
        >
          ✏️ Pedir cambios
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => descartarAction(proposalId))}
          className="text-xs uppercase tracking-widest font-bold border-2 border-black px-3 py-1.5 bg-white hover:bg-black/5 disabled:opacity-50"
        >
          🗑 Descartar
        </button>
      </div>

      {showChanges && (
        <div className="space-y-2">
          <textarea
            value={instr}
            onChange={(e) => setInstr(e.target.value)}
            rows={2}
            placeholder="Qué cambias: «la foto más luminosa», «texto más corto sin hashtags», «cambia foto y texto: pon una pareja joven»…"
            className="border-2 border-black px-3 py-2 text-sm w-full font-mono leading-relaxed"
          />
          <button
            type="button"
            disabled={pending || !instr.trim()}
            onClick={() => run(() => pedirCambiosAction(proposalId, instr))}
            className="text-xs uppercase tracking-widest font-bold border-2 border-black px-3 py-1.5 bg-black text-white disabled:opacity-50"
          >
            {pending ? "Rehaciendo…" : "Rehacer propuesta →"}
          </button>
        </div>
      )}

      {pending && <p className="text-[11px] text-black/50">Procesando…</p>}
      {msg && (
        <p className={`text-[11px] ${msg.ok ? "text-green-700" : "text-[color:var(--red)]"} break-words`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Programación automática (días fijos → propuesta pendiente para aprobar)
// ============================================================================

const DOW_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

function ProgramacionBlock({
  initialSchedule,
  directPublishEnabled,
  cronDaily,
  onGenerated,
}: {
  initialSchedule: MartaSchedule;
  directPublishEnabled: boolean;
  cronDaily: boolean;
  onGenerated?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, startRun] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [enabled, setEnabled] = useState(initialSchedule.enabled);
  const [days, setDays] = useState<number[]>(initialSchedule.daysOfWeek ?? []);
  const [hour, setHour] = useState<number>(initialSchedule.hour ?? 10);
  const [postsPerRun, setPostsPerRun] = useState<number>(initialSchedule.postsPerRun ?? 1);
  const [tema, setTema] = useState<string>(initialSchedule.tema ?? "auto");
  // El modo "directo" está desactivado; solo "avisar" operativo.
  const mode = initialSchedule.mode === "directo" && directPublishEnabled ? "directo" : "avisar";

  function toggleDay(d: number) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  function guardar() {
    setMsg(null);
    startTransition(async () => {
      const r = await guardarProgramacionAction({
        enabled,
        daysOfWeek: days,
        hour,
        mode,
        postsPerRun,
        tema,
      });
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) router.refresh();
    });
  }

  function ejecutarAhora() {
    setMsg(null);
    startRun(async () => {
      const r = await ejecutarProgramacionAhoraAction();
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) {
        router.refresh();
        onGenerated?.();
      }
    });
  }

  const diasResumen =
    days.length === 0
      ? "ningún día"
      : DOW_OPTIONS.filter((o) => days.includes(o.value)).map((o) => o.label).join(", ");

  return (
    <div className="card-hard bg-white p-5 space-y-5">
      <div>
        <div className="font-stencil text-2xl leading-none">Publicación automática</div>
        <p className="text-sm text-black/60 mt-1 leading-snug">
          Marta genera un post sola en los días que elijas y te deja una <strong>propuesta pendiente</strong>:
          la apruebas con un clic en <strong>Historial</strong>. No se publica nada sin tu OK.
        </p>
      </div>

      {/* On/off */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="w-5 h-5 accent-black"
        />
        <span className="text-sm font-bold">
          {enabled ? "Programación ACTIVADA" : "Programación desactivada"}
        </span>
      </label>

      {/* Días */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-black/55 mb-2">
          Días de publicación
        </div>
        <div className="flex flex-wrap gap-2">
          {DOW_OPTIONS.map((o) => {
            const on = days.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggleDay(o.value)}
                className={`text-xs font-bold border-2 border-black px-3 py-1.5 uppercase tracking-widest ${
                  on ? "bg-black text-[color:var(--mustard)]" : "bg-white hover:bg-black/5"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hora */}
      <div className="flex flex-wrap gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
            Hora (España)
          </div>
          <select
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="border-2 border-black px-3 py-2 text-sm font-mono"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
            Posts por día
          </div>
          <select
            value={postsPerRun}
            onChange={(e) => setPostsPerRun(Number(e.target.value))}
            className="border-2 border-black px-3 py-2 text-sm font-mono"
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>
      {cronDaily && (
        <p className="text-[11px] text-black/45 -mt-2">
          En el plan actual la publicación se prepara <strong>una vez al día, por la mañana</strong> (≈10:00 España). La hora exacta por cliente se aplicará al pasar a plan Pro.
        </p>
      )}

      {/* Tema */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
          Tema de los posts
        </div>
        <select
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          className="border-2 border-black px-3 py-2 text-sm w-full"
        >
          {MARTA_TOPICS.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Modo de aprobación */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
          Aprobación
        </div>
        <div className="border-2 border-black px-3 py-2 text-sm bg-black/[0.03]">
          <div className="font-bold">✅ Avisar antes y aprobar en la app</div>
          <p className="text-[12px] text-black/60 mt-0.5 leading-snug">
            Marta crea la propuesta y la dejas lista en Historial para publicar con un clic.
          </p>
        </div>
        <p className="text-[11px] text-black/45 mt-1">
          🔒 «Publicar directo» (sin aprobación) está {directPublishEnabled ? "disponible" : "desactivado de momento"} — se habilitará cuando se confirme el permiso de Instagram con Meta.
        </p>
      </div>

      {/* Resumen + acciones */}
      <div className="border-t-2 border-black/10 pt-4 space-y-3">
        <p className="text-[12px] text-black/60">
          Resumen:{" "}
          {enabled ? (
            <span className="font-bold text-black">
              {postsPerRun} post/día · {diasResumen} · {cronDaily ? "por la mañana" : `${String(hour).padStart(2, "0")}:00`} · aprobar en la app
            </span>
          ) : (
            <span className="italic">desactivada (no publicará automáticamente)</span>
          )}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={guardar}
            className="btn-mustard text-sm px-6 py-3 disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar programación"}
          </button>
          <button
            type="button"
            disabled={running}
            onClick={ejecutarAhora}
            className="text-sm font-bold border-2 border-black px-5 py-3 bg-white hover:bg-black/5 disabled:opacity-50"
          >
            {running ? "Generando…" : "▶ Ejecutar ahora (probar)"}
          </button>
        </div>
        <p className="text-[11px] text-black/45">
          «Ejecutar ahora» genera ya mismo el/los post(s) sin esperar al día programado, para que veas el resultado en Historial.
        </p>

        {msg && (
          <p className={`text-[12px] ${msg.ok ? "text-green-700" : "text-[color:var(--red)]"} break-words`}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Comentario → DM (la función estrella de ManyChat)
// ============================================================================

function ComentariosBlock({
  initialRules,
  commentDmEnabled,
}: {
  initialRules: CommentRule[];
  commentDmEnabled: boolean;
}) {
  const [editing, setEditing] = useState<CommentRule | null>(null);
  const [creating, setCreating] = useState(initialRules.length === 0);

  return (
    <div className="space-y-5">
      {!commentDmEnabled && (
        <div className="card-hard bg-white p-4 border-[3px] border-[color:var(--mustard)] text-sm">
          <div className="font-bold mb-1">Envío de DM en pausa (App Review pendiente)</div>
          <p className="text-xs text-black/70 leading-snug">
            Puedes crear y <strong>probar</strong> tus reglas ya mismo. El envío automático
            del DM se activará cuando Meta apruebe los permisos{" "}
            <code className="text-[10px]">instagram_manage_comments</code> y{" "}
            <code className="text-[10px]">instagram_business_manage_messages</code>. Hasta
            entonces, Marta detecta la palabra clave y la registra, pero no manda nada.
          </p>
        </div>
      )}

      <div className="card-hard bg-white p-5 space-y-2">
        <div className="font-stencil text-2xl leading-none">Comentario → DM automático</div>
        <p className="text-sm text-black/60 leading-snug">
          Cuando alguien comenta una <strong>palabra clave</strong> en uno de tus posts,
          Marta le manda al instante un <strong>DM privado</strong> con tu mensaje. Si
          contesta, sigue la conversación con IA. Es la función estrella de ManyChat.
        </p>
        <p className="text-[11px] text-black/45">
          El primer DM es una plantilla fija que tú escribes (control total). Usa{" "}
          <code className="text-[10px] bg-black/5 px-1">{"{usuario}"}</code> para citar a quien comenta.
        </p>
      </div>

      {/* Lista de reglas */}
      {initialRules.length > 0 && (
        <ul className="space-y-3">
          {initialRules.map((r) => (
            <ReglaCard
              key={r.id}
              rule={r}
              onEdit={() => {
                setEditing(r);
                setCreating(false);
              }}
            />
          ))}
        </ul>
      )}

      {/* Editor (crear o editar) */}
      {(creating || editing) && (
        <ReglaEditor
          key={editing?.id ?? "nueva"}
          rule={editing}
          onDone={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      {!creating && !editing && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="btn-mustard text-sm px-6 py-3"
        >
          + Nueva regla
        </button>
      )}

      {/* Probador */}
      <ProbadorComentario commentDmEnabled={commentDmEnabled} />
    </div>
  );
}

function ReglaCard({ rule, onEdit }: { rule: CommentRule; onEdit: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function toggle() {
    setMsg(null);
    startTransition(async () => {
      const r = await toggleReglaComentarioAction(rule.id, !rule.enabled);
      if (r.ok) router.refresh();
      else setMsg(r.message);
    });
  }

  function eliminar() {
    setMsg(null);
    startTransition(async () => {
      const r = await eliminarReglaComentarioAction(rule.id);
      if (r.ok) router.refresh();
      else setMsg(r.message);
    });
  }

  return (
    <li className="card-hard bg-white p-4 text-sm">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span
          className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 font-bold ${
            rule.enabled ? "bg-[#14B8A6] text-white" : "bg-black/30 text-white"
          }`}
        >
          {rule.enabled ? "ACTIVA" : "PAUSADA"}
        </span>
        <span className="text-[10px] font-mono text-black/50">
          {rule.matchMode === "exacto" ? "coincidencia exacta" : "contiene la palabra"}
        </span>
        <span className="text-black/40">·</span>
        <span className="text-[10px] font-mono text-black/50">
          {rule.scope === "all" ? "todos los posts" : `post ${rule.scope.slice(0, 12)}…`}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {rule.keywords.map((k) => (
          <span
            key={k}
            className="text-[11px] font-mono bg-[color:var(--mustard)] text-black border-2 border-black px-2 py-0.5"
          >
            {k}
          </span>
        ))}
      </div>

      <div className="bg-black/[0.03] border-2 border-black/10 p-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-black/45 mb-1">
          Primer DM
        </div>
        <p className="text-xs text-black/80 whitespace-pre-wrap leading-relaxed">{rule.dmMessage}</p>
      </div>

      {rule.replyPublic && (
        <p className="text-[11px] text-black/55 mt-2">
          💬 Respuesta pública al comentario:{" "}
          <span className="italic">
            &ldquo;{rule.publicReplyText || "¡Te acabo de escribir por privado! 📩"}&rdquo;
          </span>
        </p>
      )}

      <div className="mt-3 border-t-2 border-black/10 pt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onEdit}
          className="text-xs uppercase tracking-widest font-bold border-2 border-black px-3 py-1.5 bg-white hover:bg-black/5 disabled:opacity-50"
        >
          ✏️ Editar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={toggle}
          className="text-xs uppercase tracking-widest font-bold border-2 border-black px-3 py-1.5 bg-[color:var(--mustard)] disabled:opacity-50"
        >
          {rule.enabled ? "⏸ Pausar" : "▶ Activar"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={eliminar}
          className="text-xs uppercase tracking-widest font-bold border-2 border-black px-3 py-1.5 bg-white hover:bg-black/5 disabled:opacity-50"
        >
          🗑 Eliminar
        </button>
      </div>
      {msg && <p className="text-[11px] text-[color:var(--red)] mt-2">{msg}</p>}
    </li>
  );
}

function ReglaEditor({ rule, onDone }: { rule: CommentRule | null; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [keywordsRaw, setKeywordsRaw] = useState((rule?.keywords ?? []).join(", "));
  const [matchMode, setMatchMode] = useState<MatchMode>(rule?.matchMode ?? "contiene");
  const [dmMessage, setDmMessage] = useState(
    rule?.dmMessage ??
      "¡Hola {usuario}! 🙌 Gracias por tu interés. Te paso toda la info por aquí: …",
  );
  const [scope, setScope] = useState(rule?.scope ?? "all");
  const [replyPublic, setReplyPublic] = useState(rule?.replyPublic ?? false);
  const [publicReplyText, setPublicReplyText] = useState(rule?.publicReplyText ?? "");

  function guardar() {
    setMsg(null);
    startTransition(async () => {
      const r = await guardarReglaComentarioAction({
        id: rule?.id,
        enabled,
        keywordsRaw,
        matchMode,
        dmMessage,
        scope: scope.trim() || "all",
        replyPublic,
        publicReplyText,
      });
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) {
        router.refresh();
        onDone();
      }
    });
  }

  return (
    <div className="card-hard bg-white p-5 space-y-4 border-[3px] border-black">
      <div className="font-stencil text-xl leading-none">
        {rule ? "Editar regla" : "Nueva regla Comentario → DM"}
      </div>

      {/* Palabras clave */}
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
          Palabras clave (separadas por coma)
        </label>
        <input
          type="text"
          value={keywordsRaw}
          onChange={(e) => setKeywordsRaw(e.target.value)}
          placeholder="QUIERO, INFO, PRECIO"
          className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
        />
        <p className="text-[11px] text-black/50 mt-1">
          Si el comentario casa con cualquiera de ellas, salta el DM. No distingue mayúsculas ni tildes.
        </p>
      </div>

      {/* Modo */}
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
          Cómo casar
        </label>
        <select
          value={matchMode}
          onChange={(e) => setMatchMode(e.target.value as MatchMode)}
          className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
        >
          <option value="contiene">El comentario CONTIENE la palabra</option>
          <option value="exacto">El comentario es EXACTAMENTE la palabra</option>
        </select>
      </div>

      {/* DM */}
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
          Primer DM (plantilla fija) *
        </label>
        <textarea
          value={dmMessage}
          onChange={(e) => setDmMessage(e.target.value)}
          rows={3}
          className="border-2 border-black px-3 py-2 text-sm w-full font-mono leading-relaxed"
        />
        <p className="text-[11px] text-black/50 mt-1">
          Usa <code className="text-[10px] bg-black/5 px-1">{"{usuario}"}</code> para citar a quien comenta.
          La conversación posterior la lleva la IA.
        </p>
      </div>

      {/* Scope */}
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
          ¿En qué posts aplica?
        </label>
        <select
          value={scope === "all" ? "all" : "media"}
          onChange={(e) => setScope(e.target.value === "all" ? "all" : "")}
          className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
        >
          <option value="all">Todos los posts</option>
          <option value="media">Un post concreto (por media id)</option>
        </select>
        {scope !== "all" && (
          <input
            type="text"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="media id de Instagram (ej. 17912345678901234)"
            className="border-2 border-black px-3 py-2 text-sm w-full font-mono mt-2"
          />
        )}
      </div>

      {/* Respuesta pública */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={replyPublic}
            onChange={(e) => setReplyPublic(e.target.checked)}
            className="w-5 h-5 accent-black"
          />
          <span className="text-sm font-bold">También responder públicamente al comentario</span>
        </label>
        {replyPublic && (
          <input
            type="text"
            value={publicReplyText}
            onChange={(e) => setPublicReplyText(e.target.value)}
            placeholder="¡Te acabo de escribir por privado! 📩"
            className="border-2 border-black px-3 py-2 text-sm w-full font-mono mt-2"
          />
        )}
      </div>

      {/* On/off */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="w-5 h-5 accent-black"
        />
        <span className="text-sm font-bold">
          {enabled ? "Regla ACTIVADA" : "Regla desactivada"}
        </span>
      </label>

      <div className="border-t-2 border-black/10 pt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={guardar}
          className="btn-mustard text-sm px-6 py-3 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar regla"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onDone}
          className="text-sm font-bold border-2 border-black px-5 py-3 bg-white hover:bg-black/5 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
      {msg && (
        <p className={`text-[12px] ${msg.ok ? "text-green-700" : "text-[color:var(--red)]"} break-words`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

function ProbadorComentario({ commentDmEnabled }: { commentDmEnabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [res, setRes] = useState<ProbarComentarioResult | null>(null);

  function probar() {
    setRes(null);
    startTransition(async () => {
      const r = await probarComentarioAction({ text, mediaId: mediaId.trim() || undefined });
      setRes(r);
    });
  }

  return (
    <div className="card-hard bg-white p-5 space-y-3">
      <div className="font-stencil text-xl leading-none">Probar una regla</div>
      <p className="text-[12px] text-black/55 leading-snug">
        Escribe un comentario de ejemplo y comprueba qué regla saltaría y qué DM mandaría Marta.
        Es una simulación: <strong>no envía nada</strong>.
      </p>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='Ej. "Quiero info del precio"'
        className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
      />
      <input
        type="text"
        value={mediaId}
        onChange={(e) => setMediaId(e.target.value)}
        placeholder="(opcional) media id del post — vacío = simula un post cualquiera"
        className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
      />
      <button
        type="button"
        disabled={pending || !text.trim()}
        onClick={probar}
        className="text-sm font-bold border-2 border-black px-5 py-2.5 bg-white hover:bg-black/5 disabled:opacity-50"
      >
        {pending ? "Probando…" : "▶ Probar coincidencia"}
      </button>

      {res && (
        <div
          className={`p-4 border-2 border-black ${
            res.matched ? "bg-[#14B8A6] text-white" : "bg-black/[0.04] text-black"
          }`}
        >
          <p className="text-sm font-bold">{res.message}</p>
          {res.matched && res.dm && (
            <div className="mt-2 bg-white/20 border border-white/30 p-3">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{res.dm}</p>
            </div>
          )}
          {res.matched && res.replyPublic && (
            <p className="text-[11px] mt-2 opacity-90">
              + respuesta pública: &ldquo;{res.publicReplyText || "¡Te acabo de escribir por privado! 📩"}&rdquo;
            </p>
          )}
          {res.matched && !commentDmEnabled && (
            <p className="text-[11px] mt-2 opacity-90">
              (El envío real está en pausa hasta el App Review de Meta.)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
