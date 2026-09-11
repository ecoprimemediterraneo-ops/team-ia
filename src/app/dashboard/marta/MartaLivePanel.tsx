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
import { traductor, type Idioma, type ClaveTexto } from "@/lib/idioma";
import { useHrefIdioma, useIdiomaPanel } from "@/components/TextoIdioma";
import type { CommentRule, MatchMode } from "@/lib/marta-comment-rules";
import type { FilaHistorial } from "@/lib/marta-comment-historial";
import { MARTA_TOPICS } from "@/lib/marta-topics";

type Tab = "nuevo" | "arranque" | "mensajes" | "historial" | "calendario" | "comentarios";

export default function MartaLivePanel({
  initialProposals,
  enabled,
  initialCommentRules,
  historialComentarios = [],
  commentDmEnabled,
  calendario,
  conectar,
  mensajes,
  initialTab,
  idioma = "es",
}: {
  initialProposals: MartaProposal[];
  enabled: boolean;
  // defaultRecipient: lo usaba el NuevoPostBlock (hoy legacy, no montado). Se sigue
  // aceptando por compatibilidad pero ya no se destructura aquí.
  defaultRecipient?: string;
  // Del sistema antiguo (ProgramacionBlock, hoy comentado). Se siguen recibiendo del
  // servidor pero ya no se usan en la interfaz; se dejan por compatibilidad.
  initialSchedule?: MartaSchedule;
  directPublishEnabled?: boolean;
  cronDaily?: boolean;
  initialCommentRules: CommentRule[];
  /** Lo que YA ha pasado: se calcula en el servidor y baja pintado. */
  historialComentarios?: FilaHistorial[];
  commentDmEnabled: boolean;
  /** Calendario del mes (server component) montado como slot en la pestaña "Calendario". */
  calendario: React.ReactNode;
  /**
   * Conectar Instagram (server component) montado como slot arriba del todo de
   * "Empezar cuenta". Va de slot y no de componente normal por lo mismo que el
   * calendario: este panel es de cliente y no puede leer el token del tenant ni
   * llamar a la acción de desconectar.
   */
  conectar: React.ReactNode;
  /** Bandeja de DMs (server component) montada como slot en "Mensajes". */
  mensajes: React.ReactNode;
  /** Pestaña abierta al entrar (p. ej. "calendario" desde la ruta redirigida). */
  initialTab?: Tab;
  /** Solo los rótulos de las pestañas. El resto del panel no se traduce. */
  idioma?: Idioma;
}) {
  const t = traductor(idioma);
  // Por defecto abre por "Empezar cuenta": es el paso cero —sin cuenta conectada
  // el resto del panel no puede hacer nada— y hasta ahora se entraba por el
  // calendario, que es justo lo que no sirve si aún no has conectado.
  const [tab, setTabEstado] = useState<Tab>(initialTab ?? "arranque");

  /**
   * Cambiar de pestaña APUNTA LA PESTAÑA EN LA URL.
   *
   * Antes era estado de React y nada más, así que la dirección seguía diciendo
   * `tab=arranque` estuvieras donde estuvieras. Eso no se notaba... hasta que se
   * cambiaba de cuenta: el selector se lleva puesta la dirección actual, y la
   * dirección mentía. Enseñando "History" y cambiando de cuenta aterrizabas en
   * "Get started", en mitad de la grabación.
   *
   * Es `replaceState` y no `router.push`: solo hay que dejar la URL diciendo la
   * verdad, no navegar. Navegar volvería a pedir la página entera al servidor
   * por pulsar una pestaña, y llenaría el botón Atrás de pasos falsos.
   */
  function setTab(id: Tab) {
    setTabEstado(id);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("tab", id);
      window.history.replaceState(null, "", `${u.pathname}${u.search}`);
    } catch { /* sin URL utilizable se cambia de pestaña igual */ }
  }

  return (
    <div className="space-y-5">
      {!enabled && (
        <div className="card-hard bg-white p-4 border-[3px] border-[color:var(--mustard)] text-sm">
          <div className="font-bold mb-1">{t("pausa_titulo")}</div>
          <p className="text-xs text-black/70 leading-snug">{t("pausa_texto")}</p>
        </div>
      )}

      {/* Una sola fila de pestañas, todas del mismo tamaño y estilo. Comentarios → DM
          (interacción) es un botón más de la fila, no un bloque aparte. */}
      {/* "Nuevo post" se fusionó en "Subir un post propio" (dentro de Calendario de
          posts) → ya no aparece en la barra. NuevoPostBlock queda como legacy abajo. */}
      <div className="card-hard bg-white p-1 flex gap-1 text-xs font-mono uppercase tracking-widest flex-wrap">
        {/* ORDEN = EL CAMINO QUE RECORRE UN CLIENTE NUEVO: conecta la cuenta,
            programa lo que se publica, monta el comentario→DM y, al final, mira
            lo que ya pasó. El historial es lo único que no sirve para hacer
            nada, así que va el último. */}
        {/* Las pestañas no navegan —son estado de React, así que `?lang=en`
            sobrevive solo—, pero sí dejan escrito en la URL en cuál estás. Ver
            `setTab` arriba: el selector de cuenta se lleva puesta la dirección
            actual y necesita que diga la verdad. */}
        <TabBtn id="arranque" active={tab} setTab={setTab}>{t("tab_arranque")}</TabBtn>
        <TabBtn id="mensajes" active={tab} setTab={setTab}>{t("tab_mensajes")}</TabBtn>
        <TabBtn id="calendario" active={tab} setTab={setTab}>{t("tab_calendario")}</TabBtn>
        <TabBtn id="comentarios" active={tab} setTab={setTab}>{t("tab_comentarios")}</TabBtn>
        <TabBtn id="historial" active={tab} setTab={setTab}>{t("tab_historial")}</TabBtn>
      </div>

      {/* Pestaña "Calendario": el calendario del mes nuevo, montado como slot
          (server component) desde la página. La creación de posts (antes "Nuevo
          post") vive ahora dentro, en "Subir un post propio". */}
      {tab === "calendario" && calendario}
      {tab === "comentarios" && (
        <ComentariosBlock
          initialRules={initialCommentRules}
          commentDmEnabled={commentDmEnabled}
          historial={historialComentarios}
        />
      )}
      {tab === "arranque" && (
        <div className="space-y-5">
          {conectar}
          <ArranqueBlock />
        </div>
      )}
      {tab === "mensajes" && mensajes}
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
// [LEGACY] Nuevo post / reel / story — YA NO SE RENDERIZA.
// Su función se fusionó en "Subir un post propio" (SubirPost.tsx), dentro de
// Calendario de posts, con las mismas opciones (tipo, URL externa, tema, detalles,
// describe la foto). Se conserva exportado, sin montarse en ninguna pestaña.
// ============================================================================

export function NuevoPostBlock({
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
  // Esta pestaña es la que se graba para el App Review de Meta, así que va
  // entera en el idioma de la URL. El idioma se lee aquí y no se recibe como
  // prop porque el bloque se monta sin ninguna.
  const idioma = useIdiomaPanel();
  const t = traductor(idioma);

  return (
    <div className="space-y-5">
      <form action={formAction} className="card-hard bg-white p-5 flex items-end gap-3 flex-wrap">
        {/* El idioma viaja con el formulario: la server action corre en el
            servidor y no ve la URL del navegador, así que sin esto sus mensajes
            de error saldrían en castellano sobre un panel en inglés. */}
        <input type="hidden" name="lang" value={idioma} />
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
            {t("arr_num_posts")}
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
          {pending ? t("arr_generando") : t("arr_generar")}
        </button>
        <p className="text-[11px] text-black/55 max-w-md">{t("arr_explica")}</p>
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
              {t("arr_bio")}
            </div>
            <pre className="whitespace-pre-wrap text-sm font-sans leading-snug bg-[color:var(--cream)] p-4 border-2 border-black/15">
              {state.bio}
            </pre>
          </div>

          {state.warnings && state.warnings.length > 0 && (
            <div className="card-hard bg-white p-4 border-[3px] border-[color:var(--mustard)] text-xs">
              <div className="font-mono uppercase tracking-widest text-[10px] mb-1">{t("arr_avisos")}</div>
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
                      {d.styleApplied.preset}{d.aiUsed ? t("arr_ia") : ""}
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
// [LEGACY] Programación automática (sistema ANTIGUO) — YA NO SE RENDERIZA.
// Sustituido por la pestaña "Calendario" (calendario del mes nuevo). Se conserva
// exportado, sin montarse en ninguna pestaña, por si hubiera que consultarlo o
// reactivarlo; sus server actions siguen en ./actions. No aparece en la interfaz.
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

export function ProgramacionBlock({
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
  // El idioma se lee de la URL en vez de recibirse como prop: este bloque es el
  // sistema de programación viejo y hoy no lo monta nadie, así que añadirle una
  // prop obligaría a tocar a quien lo resucite. El hook no pide nada a cambio.
  const hrefIdioma = useHrefIdioma();
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

  // ── CONGELADO (Paso 1 de la unificación) ──────────────────────────────────
  // Esta Programación es el SISTEMA ANTIGUO. Se sustituye por el calendario nuevo
  // (/dashboard/marta/calendario). Se deja el código intacto pero SIN poder
  // guardar ni ejecutar, para que no se pueda reactivar. Reversible: CONGELADO = false.
  const CONGELADO = true;

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
    <div className={`card-hard bg-white p-5 space-y-5 ${CONGELADO ? "opacity-95" : ""}`}>
      {CONGELADO && (
        <div className="border-[3px] border-black bg-[color:var(--mustard)] p-4">
          <div className="font-stencil text-xl leading-none uppercase">⚠ Sistema antiguo — congelado</div>
          <p className="text-sm text-black/80 mt-2 leading-snug">
            Esta programación se ha <strong>sustituido por el calendario nuevo</strong>, que además elige la hora por
            día, sube posts propios y da identidad visual a cada negocio. Aquí ya <strong>no se puede guardar ni
            ejecutar</strong> (queda solo como referencia).
          </p>
          <a
            href={hrefIdioma("/dashboard/marta/calendario")}
            className="inline-block mt-3 text-sm font-bold uppercase tracking-widest border-2 border-black bg-black text-[color:var(--mustard)] px-4 py-2 hover:bg-black/80"
          >
            Ir al calendario nuevo →
          </a>
        </div>
      )}

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
            disabled={pending || CONGELADO}
            onClick={guardar}
            title={CONGELADO ? "Sistema antiguo congelado — usa el calendario nuevo" : undefined}
            className="btn-mustard text-sm px-6 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? "Guardando…" : "Guardar programación"}
          </button>
          <button
            type="button"
            disabled={running || CONGELADO}
            onClick={ejecutarAhora}
            title={CONGELADO ? "Sistema antiguo congelado — usa el calendario nuevo" : undefined}
            className="text-sm font-bold border-2 border-black px-5 py-3 bg-white hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running ? "Generando…" : "▶ Ejecutar ahora (probar)"}
          </button>
        </div>
        <p className="text-[11px] text-black/45">
          {CONGELADO
            ? "Estos botones están desactivados: la programación automática vive ahora en el calendario nuevo."
            : "«Ejecutar ahora» genera ya mismo el/los post(s) sin esperar al día programado, para que veas el resultado en Historial."}
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
  historial,
}: {
  initialRules: CommentRule[];
  commentDmEnabled: boolean;
  historial: FilaHistorial[];
}) {
  const [editing, setEditing] = useState<CommentRule | null>(null);
  const [creating, setCreating] = useState(initialRules.length === 0);
  // TODA la pestaña habla el idioma de la URL. Hasta ahora solo lo hacía el
  // historial: el resto era castellano escrito a mano, y esta pestaña se graba
  // para el App Review de Meta, que exige la interfaz en inglés.
  const t = traductor(useIdiomaPanel());

  return (
    <div className="space-y-5">
      {commentDmEnabled ? (
        <div className="card-hard bg-white p-4 border-[3px] border-[#14B8A6] text-sm">
          <div className="font-bold mb-1">{t("cdm_on_titulo")}</div>
          <p className="text-xs text-black/70 leading-snug">
            {t("cdm_on_1")} <code className="text-[10px]">comments</code> {t("cdm_on_2")}
          </p>
        </div>
      ) : (
        <div className="card-hard bg-white p-4 border-[3px] border-[color:var(--mustard)] text-sm">
          <div className="font-bold mb-1">{t("cdm_off_titulo")}</div>
          <p className="text-xs text-black/70 leading-snug">
            {t("cdm_off_1")} <strong>{t("cdm_off_probar")}</strong> {t("cdm_off_2")}{" "}
            <code className="text-[10px]">instagram_manage_comments</code> {t("cdm_y")}{" "}
            <code className="text-[10px]">instagram_business_manage_messages</code>
            {/* Sin punto ni espacio aquí: los pone la frase, porque en inglés
                antes del punto va "permissions" y en castellano no. */}
            {t("cdm_off_3")}
          </p>
        </div>
      )}

      <div className="card-hard bg-white p-5 space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-widest text-black/45">
          {t("cdm_intro_etiqueta")}
        </div>
        <div className="font-stencil text-2xl leading-none">{t("cdm_intro_titulo")}</div>
        <p className="text-sm text-black/60 leading-snug">
          {t("cdm_intro_1")} <strong>{t("cdm_intro_palabra")}</strong> {t("cdm_intro_2")}{" "}
          <strong>{t("cdm_intro_dm")}</strong> {t("cdm_intro_3")}
        </p>
        <p className="text-[11px] text-black/45">
          {t("cdm_intro_plantilla_1")}{" "}
          <code className="text-[10px] bg-black/5 px-1">{"{usuario}"}</code> {t("cdm_intro_plantilla_2")}
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
          {t("cdm_nueva_regla")}
        </button>
      )}

      {/* LO QUE YA HA PASADO. Va antes del probador a propósito: al abrir la
          pestaña, lo primero que se quiere saber es si esto ha funcionado con
          gente de verdad, no cómo se prueba. */}
      <HistorialComentarios filas={historial} />

      {/* Probador */}
      <ProbadorComentario commentDmEnabled={commentDmEnabled} />
    </div>
  );
}

/**
 * ACTIVIDAD RECIENTE: los últimos comentarios que dispararon una regla.
 *
 * Sale de eventos REALES del registro (`marta-comment-historial.ts`), no de
 * datos de ejemplo: si está vacío es que no ha entrado ningún comentario con
 * las palabras clave, y eso se dice con esas palabras en vez de dejar un hueco.
 *
 * En móvil no es una tabla sino una tarjeta por fila: seis columnas en 375 px
 * no se leen, y esto se mira desde el teléfono tanto como desde el escritorio.
 */
function HistorialComentarios({ filas }: { filas: FilaHistorial[] }) {
  const idioma = useIdiomaPanel();
  const t = traductor(idioma);

  const hora = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    // Fecha corta + hora: el día importa —un comentario de hace una semana no
    // es el de esta mañana— y la hora sola no lo dice.
    return d.toLocaleString(idioma === "en" ? "en-GB" : "es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const ESTADOS: Record<FilaHistorial["estado"], { k: ClaveTexto; clase: string }> = {
    enviado: { k: "hist_estado_enviado", clase: "bg-[#14B8A6] text-white border-black" },
    error: { k: "hist_estado_error", clase: "bg-[color:var(--red)] text-white border-black" },
    en_pausa: { k: "hist_estado_pausa", clase: "bg-[color:var(--mustard)] text-black border-black" },
    solo_detectado: { k: "hist_estado_detectado", clase: "bg-white text-black/60 border-black/30" },
    // Gris y no rojo: un comentario que no casa con ninguna regla no es un fallo.
    ignorado: { k: "hist_estado_ignorado", clase: "bg-black/5 text-black/55 border-black/25" },
  };

  const MOTIVOS: Record<NonNullable<FilaHistorial["motivo"]>, ClaveTexto> = {
    sin_regla: "hist_motivo_sin_regla",
    comentario_propio: "hist_motivo_propio",
    sin_id_o_texto: "hist_motivo_vacio",
  };

  const Estado = ({ f }: { f: FilaHistorial }) => {
    const e = ESTADOS[f.estado];
    return (
      <span
        title={f.estado === "en_pausa" ? t("hist_pausa_ayuda") : f.error || undefined}
        className={`inline-block text-[10px] font-mono uppercase tracking-widest border-2 px-1.5 py-0.5 whitespace-nowrap ${e.clase}`}
      >
        {t(e.k)}
      </span>
    );
  };

  /** El @ de quien comentó; si Meta no lo mandó, su identificador. */
  const quien = (f: FilaHistorial) =>
    f.username ? `@${f.username}` : f.senderId ? f.senderId.slice(0, 12) : t("hist_sin_texto");

  return (
    <div className="card-hard bg-white p-5">
      <div className="font-stencil text-2xl leading-none">{t("hist_titulo")}</div>
      <p className="text-sm text-black/60 leading-snug mt-1 mb-4">{t("hist_sub")}</p>

      {filas.length === 0 ? (
        <p className="text-sm text-black/45 border-2 border-black/10 px-3 py-4 text-center leading-snug">
          {t("hist_vacio")}
        </p>
      ) : (
        <>
          {/* ESCRITORIO */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-mono uppercase tracking-widest text-black/45">
                  <th className="pb-2 pr-3 font-normal whitespace-nowrap">{t("hist_col_hora")}</th>
                  <th className="pb-2 pr-3 font-normal">{t("hist_col_usuario")}</th>
                  <th className="pb-2 pr-3 font-normal">{t("hist_col_comentario")}</th>
                  <th className="pb-2 pr-3 font-normal">{t("hist_col_keyword")}</th>
                  <th className="pb-2 pr-3 font-normal">{t("hist_col_respuesta")}</th>
                  <th className="pb-2 font-normal">{t("hist_col_estado")}</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.commentId} className="border-t-2 border-black/10 align-top">
                    <td className="py-2 pr-3 text-[11px] font-mono text-black/55 whitespace-nowrap">{hora(f.ts)}</td>
                    <td className="py-2 pr-3 text-xs font-bold">{quien(f)}</td>
                    <td className="py-2 pr-3 text-xs text-black/80 max-w-[16rem]">
                      {f.comentario || t("hist_sin_texto")}
                    </td>
                    <td className="py-2 pr-3">
                      {f.origen === "dm" ? (
                        // Un DM no tiene palabra clave: lo que se dice aquí es de
                        // dónde viene, para no confundirlo con un comentario.
                        <span className="text-[10px] font-mono uppercase tracking-widest bg-black text-[color:var(--mustard)] px-1.5 py-0.5 whitespace-nowrap">
                          {t("hist_origen_dm")}
                        </span>
                      ) : f.keyword ? (
                        <span className="text-[10px] font-mono bg-black/5 border border-black/15 px-1.5 py-0.5">
                          {f.keyword}
                        </span>
                      ) : (
                        <span className="text-xs text-black/30">{t("hist_sin_texto")}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs text-black/80 max-w-[18rem] space-y-1">
                      {f.dm && (
                        <div>
                          <span className="text-[9px] font-mono uppercase tracking-widest text-black/40 mr-1">
                            {t("hist_dm")}
                          </span>
                          {f.dm}
                        </div>
                      )}
                      {f.respuestaPublica && (
                        <div className="text-black/55">
                          <span className="text-[9px] font-mono uppercase tracking-widest text-black/40 mr-1">
                            {t("hist_publica")}
                          </span>
                          {f.respuestaPublica}
                        </div>
                      )}
                      {!f.dm && !f.respuestaPublica && (
                        f.motivo ? (
                          // Ignorado: en vez de un guion, por qué no salió nada.
                          <span className="text-black/55 italic">{t(MOTIVOS[f.motivo])}</span>
                        ) : (
                          <span className="text-black/30">{t("hist_sin_texto")}</span>
                        )
                      )}
                    </td>
                    <td className="py-2"><Estado f={f} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MÓVIL */}
          <ul className="md:hidden space-y-3">
            {filas.map((f) => (
              <li key={f.commentId} className="border-2 border-black/10 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold">{quien(f)}</span>
                  <Estado f={f} />
                </div>
                <div className="text-[11px] font-mono text-black/45">{hora(f.ts)}</div>
                {f.comentario && <p className="text-xs text-black/80 leading-snug">{f.comentario}</p>}
                {f.origen === "dm" && (
                  <span className="inline-block text-[10px] font-mono uppercase tracking-widest bg-black text-[color:var(--mustard)] px-1.5 py-0.5">
                    {t("hist_origen_dm")}
                  </span>
                )}
                {f.keyword && (
                  <span className="inline-block text-[10px] font-mono bg-black/5 border border-black/15 px-1.5 py-0.5">
                    {f.keyword}
                  </span>
                )}
                {f.motivo && (
                  <p className="text-xs text-black/55 italic leading-snug">{t(MOTIVOS[f.motivo])}</p>
                )}
                {f.dm && (
                  <p className="text-xs text-black/70 leading-snug">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-black/40 mr-1">
                      {t("hist_dm")}
                    </span>
                    {f.dm}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ReglaCard({ rule, onEdit }: { rule: CommentRule; onEdit: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const idioma = useIdiomaPanel();
  const t = traductor(idioma);

  function toggle() {
    setMsg(null);
    startTransition(async () => {
      const r = await toggleReglaComentarioAction(rule.id, !rule.enabled, idioma);
      if (r.ok) router.refresh();
      else setMsg(r.message);
    });
  }

  function eliminar() {
    setMsg(null);
    startTransition(async () => {
      const r = await eliminarReglaComentarioAction(rule.id, idioma);
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
          {rule.enabled ? t("cdm_activa") : t("cdm_pausada")}
        </span>
        <span className="text-[10px] font-mono text-black/50">
          {rule.matchMode === "exacto" ? t("cdm_exacto") : t("cdm_contiene")}
        </span>
        <span className="text-black/40">·</span>
        <span className="text-[10px] font-mono text-black/50">
          {rule.scope === "all" ? t("cdm_todos") : `${t("cdm_post")} ${rule.scope.slice(0, 12)}…`}
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
          {t("cdm_primer_dm")}
        </div>
        <p className="text-xs text-black/80 whitespace-pre-wrap leading-relaxed">{rule.dmMessage}</p>
      </div>

      {rule.replyPublic && (
        <p className="text-[11px] text-black/55 mt-2">
          {t("cdm_resp_publica")}{" "}
          {/* El texto entrecomillado NO se traduce: es lo que Marta publica de
              verdad en Instagram, y la pantalla tiene que enseñar eso mismo. */}
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
          {t("cdm_editar")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={toggle}
          className="text-xs uppercase tracking-widest font-bold border-2 border-black px-3 py-1.5 bg-[color:var(--mustard)] disabled:opacity-50"
        >
          {rule.enabled ? t("cdm_pausar") : t("cdm_activar")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={eliminar}
          className="text-xs uppercase tracking-widest font-bold border-2 border-black px-3 py-1.5 bg-white hover:bg-black/5 disabled:opacity-50"
        >
          {t("cdm_eliminar")}
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
  const idioma = useIdiomaPanel();
  const t = traductor(idioma);

  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [keywordsRaw, setKeywordsRaw] = useState((rule?.keywords ?? []).join(", "));
  const [matchMode, setMatchMode] = useState<MatchMode>(rule?.matchMode ?? "contiene");
  // Solo la plantilla de una regla NUEVA sale en el idioma del panel. Una regla
  // que ya existe conserva su texto: es lo que se envía, y no se reescribe solo.
  const [dmMessage, setDmMessage] = useState(rule?.dmMessage ?? t("cdm_ed_dm_defecto"));
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
      }, idioma);
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
        {rule ? t("cdm_ed_editar") : t("cdm_ed_nueva")}
      </div>

      {/* Palabras clave */}
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
          {t("cdm_ed_keywords")}
        </label>
        <input
          type="text"
          value={keywordsRaw}
          onChange={(e) => setKeywordsRaw(e.target.value)}
          placeholder={t("cdm_ed_keywords_ph")}
          className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
        />
        <p className="text-[11px] text-black/50 mt-1">
          {t("cdm_ed_keywords_ayuda")}
        </p>
      </div>

      {/* Modo */}
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
          {t("cdm_ed_modo")}
        </label>
        <select
          value={matchMode}
          onChange={(e) => setMatchMode(e.target.value as MatchMode)}
          className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
        >
          <option value="contiene">{t("cdm_ed_modo_contiene")}</option>
          <option value="exacto">{t("cdm_ed_modo_exacto")}</option>
        </select>
      </div>

      {/* DM */}
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
          {t("cdm_ed_dm")}
        </label>
        <textarea
          value={dmMessage}
          onChange={(e) => setDmMessage(e.target.value)}
          rows={3}
          className="border-2 border-black px-3 py-2 text-sm w-full font-mono leading-relaxed"
        />
        <p className="text-[11px] text-black/50 mt-1">
          {t("cdm_ed_dm_ayuda_1")} <code className="text-[10px] bg-black/5 px-1">{"{usuario}"}</code>{" "}
          {t("cdm_ed_dm_ayuda_2")}
        </p>
      </div>

      {/* Scope */}
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
          {t("cdm_ed_scope")}
        </label>
        <select
          value={scope === "all" ? "all" : "media"}
          onChange={(e) => setScope(e.target.value === "all" ? "all" : "")}
          className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
        >
          <option value="all">{t("cdm_ed_scope_todos")}</option>
          <option value="media">{t("cdm_ed_scope_uno")}</option>
        </select>
        {scope !== "all" && (
          <input
            type="text"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder={t("cdm_ed_scope_ph")}
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
          <span className="text-sm font-bold">{t("cdm_ed_publica")}</span>
        </label>
        {replyPublic && (
          <input
            type="text"
            value={publicReplyText}
            onChange={(e) => setPublicReplyText(e.target.value)}
            placeholder={t("cdm_ed_publica_ph")}
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
          {enabled ? t("cdm_ed_activada") : t("cdm_ed_desactivada")}
        </span>
      </label>

      <div className="border-t-2 border-black/10 pt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={guardar}
          className="btn-mustard text-sm px-6 py-3 disabled:opacity-50"
        >
          {pending ? t("cdm_guardando") : t("cdm_guardar")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onDone}
          className="text-sm font-bold border-2 border-black px-5 py-3 bg-white hover:bg-black/5 disabled:opacity-50"
        >
          {t("cdm_cancelar")}
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
  const idioma = useIdiomaPanel();
  const t = traductor(idioma);

  function probar() {
    setRes(null);
    startTransition(async () => {
      const r = await probarComentarioAction({ text, mediaId: mediaId.trim() || undefined, lang: idioma });
      setRes(r);
    });
  }

  return (
    <div className="card-hard bg-white p-5 space-y-3">
      <div className="font-stencil text-xl leading-none">{t("cdm_pr_titulo")}</div>
      <p className="text-[12px] text-black/55 leading-snug">
        {t("cdm_pr_desc_1")} <strong>{t("cdm_pr_desc_2")}</strong>.
      </p>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("cdm_pr_ph")}
        className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
      />
      <input
        type="text"
        value={mediaId}
        onChange={(e) => setMediaId(e.target.value)}
        placeholder={t("cdm_pr_media_ph")}
        className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
      />
      <button
        type="button"
        disabled={pending || !text.trim()}
        onClick={probar}
        className="text-sm font-bold border-2 border-black px-5 py-2.5 bg-white hover:bg-black/5 disabled:opacity-50"
      >
        {pending ? t("cdm_pr_probando") : t("cdm_pr_boton")}
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
              {t("cdm_pr_publica")} &ldquo;{res.publicReplyText || "¡Te acabo de escribir por privado! 📩"}&rdquo;
            </p>
          )}
          {res.matched && !commentDmEnabled && (
            <p className="text-[11px] mt-2 opacity-90">
              {t("cdm_pr_pausa")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
