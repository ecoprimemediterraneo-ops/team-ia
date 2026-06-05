"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

type InboxMessage = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
};

type State =
  | { kind: "loading" }
  | { kind: "disconnected" }
  | { kind: "connected"; connectedEmail: string; messages: InboxMessage[] }
  | { kind: "error"; msg: string };

type DraftEditor = {
  messageId: string;
  to: string;
  subject: string;
  body: string;
  instruction: string;
  saving: boolean;
  saved: boolean;
};

export default function LuciaTools({ initialFlash }: { initialFlash?: { ok?: string; error?: string } }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(() => {
    if (initialFlash?.ok === "connected") return { ok: true, msg: "Gmail conectado correctamente ✓" };
    if (initialFlash?.error) return { ok: false, msg: `Error conectando Gmail: ${initialFlash.error}` };
    return null;
  });
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [editor, setEditor] = useState<DraftEditor | null>(null);
  const [filter, setFilter] = useState<"todos" | "no_leidos">("todos");
  const [expanded, setExpanded] = useState<Record<string, { loading: boolean; body?: string }>>({});
  const [cleaning, setCleaning] = useState(false);

  async function load() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/lucia/inbox");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      if (!data.connected) setState({ kind: "disconnected" });
      else setState({ kind: "connected", connectedEmail: data.connectedEmail, messages: data.messages });
    } catch (e) {
      setState({ kind: "error", msg: e instanceof Error ? e.message : "Error" });
    }
  }

  useEffect(() => { load(); }, []);

  // Auto-resumen al cargar bandeja la primera vez
  useEffect(() => {
    if (state.kind === "connected" && !summary && !summarizing && state.messages.length > 0) {
      summarize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 8000);
    return () => clearTimeout(t);
  }, [flash]);

  async function disconnect() {
    if (!confirm("¿Desconectar Gmail de Lucía?")) return;
    await fetch("/api/lucia/inbox", { method: "DELETE" });
    setState({ kind: "disconnected" });
    setSummary(null);
    setEditor(null);
    setFlash({ ok: true, msg: "Gmail desconectado" });
  }

  async function summarize() {
    setSummarizing(true);
    setSummary(null);
    try {
      const res = await fetch("/api/lucia/summarize", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setSummary(data.summary);
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    } finally {
      setSummarizing(false);
    }
  }

  async function startDraft(messageId: string, instruction = "") {
    setDraftFor(messageId);
    setEditor(null);
    try {
      const res = await fetch("/api/lucia/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, instruction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setEditor({
        messageId,
        to: data.to,
        subject: data.subject,
        body: data.preview,
        instruction,
        saving: false,
        saved: false,
      });
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    } finally {
      setDraftFor(null);
    }
  }

  async function regenerateDraft() {
    if (!editor) return;
    setEditor({ ...editor, saving: true });
    try {
      const res = await fetch("/api/lucia/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: editor.messageId, instruction: editor.instruction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setEditor({ ...editor, body: data.preview, saving: false, saved: false });
    } catch (e) {
      setEditor({ ...editor, saving: false });
      setFlash({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    }
  }

  async function toggleExpand(id: string) {
    if (expanded[id]?.body) {
      setExpanded({ ...expanded, [id]: { loading: false } });
      const next = { ...expanded };
      delete next[id];
      setExpanded(next);
      return;
    }
    setExpanded({ ...expanded, [id]: { loading: true } });
    try {
      const res = await fetch(`/api/lucia/message/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setExpanded((prev) => ({ ...prev, [id]: { loading: false, body: data.body } }));
    } catch (e) {
      setExpanded((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
      setFlash({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    }
  }

  async function cleanPromos() {
    if (!confirm("Lucía buscará promociones/newsletters y las archivará en una etiqueta llamada 'Lucía-Promos'. ¿Seguir?")) return;
    setCleaning(true);
    try {
      const res = await fetch("/api/lucia/clean-promos", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      if (data.archived === 0) {
        setFlash({ ok: true, msg: "No encontró promociones que archivar 🎉" });
      } else {
        setFlash({ ok: true, msg: `${data.archived} correo(s) archivado(s) en 'Lucía-Promos' ✓` });
        await load();
      }
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    } finally {
      setCleaning(false);
    }
  }

  async function saveDraft() {
    if (!editor) return;
    setEditor({ ...editor, saving: true });
    try {
      const res = await fetch("/api/lucia/draft/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: editor.to, subject: editor.subject, body: editor.body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setEditor({ ...editor, saving: false, saved: true });
      setFlash({ ok: true, msg: "Borrador guardado en tu Gmail ✓" });
    } catch (e) {
      setEditor({ ...editor, saving: false });
      setFlash({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    }
  }

  const summaryProseClass = "text-sm leading-relaxed max-w-none [&_h1]:font-stencil [&_h1]:text-xl [&_h1]:mt-3 [&_h2]:font-stencil [&_h2]:text-lg [&_h2]:mt-3 [&_h2]:mb-1 [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-1 [&_ol]:pl-5 [&_ol]:list-decimal [&_strong]:font-bold [&_li]:my-0.5";

  return (
    <div className="mt-0">
      {flash && (
        <div className={`mb-4 px-3 py-2 border-2 border-black text-sm font-bold ${flash.ok ? "bg-green-200" : "bg-red-200"}`}>
          {flash.ok ? "✓" : "⚠"} {flash.msg}
        </div>
      )}

      <div className="card-hard p-4">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-stencil text-xl">Tu bandeja, leída por Lucía</h3>
            <p className="text-sm text-black/60 mt-1">
              Lucía se conecta a tu Gmail, te lo resume con IA y te genera borradores listos.
            </p>
          </div>
          {state.kind === "connected" && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono bg-green-200 border-2 border-black px-2 py-1">
                ✓ {state.connectedEmail}
              </span>
              <button onClick={load} className="text-xs font-mono border-2 border-black px-2 py-1 hover:bg-black hover:text-white">⟳</button>
              <button onClick={disconnect} className="text-xs font-mono border-2 border-black px-2 py-1 hover:bg-[color:var(--red)] hover:text-white">DESCONECTAR</button>
            </div>
          )}
        </div>

        {state.kind === "loading" && <p className="text-sm text-black/50">Cargando…</p>}

        {state.kind === "disconnected" && (
          <div className="border-2 border-dashed border-black/40 p-6 text-center">
            <p className="text-sm mb-4">Lucía aún no tiene acceso a tu Gmail.</p>
            <a href="/api/lucia/auth" className="btn-mustard text-sm inline-block">📬 CONECTAR GMAIL</a>
            <p className="text-xs text-black/50 mt-3">
              Lectura + crear borradores. Nunca envía nada sin tu OK.
            </p>
          </div>
        )}

        {state.kind === "error" && (
          <div className="bg-red-100 border-2 border-[color:var(--red)] p-3 text-sm">
            ⚠ {state.msg}
            <button onClick={load} className="ml-3 underline font-bold">Reintentar</button>
          </div>
        )}

        {state.kind === "connected" && (
          <>
            {summarizing && (
              <div className="mb-5 border-[3px] border-black bg-[color:var(--cream)] p-4 text-sm font-mono text-black/60">
                🧠 Lucía está leyendo tu bandeja…
              </div>
            )}

            {summary && !summarizing && (
              <div className="mb-5 border-[3px] border-black bg-[color:var(--cream)] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold tracking-widest">📋 INFORME DE LUCÍA</span>
                  <div className="flex items-center gap-2">
                    <button onClick={summarize} className="text-xs font-mono border-2 border-black px-2 py-0.5 hover:bg-black hover:text-white">REHACER</button>
                    <button onClick={() => setSummary(null)} className="text-xs hover:text-[color:var(--red)]">×</button>
                  </div>
                </div>
                <div className={summaryProseClass}>
                  <ReactMarkdown>{summary}</ReactMarkdown>
                </div>
              </div>
            )}

            {!summary && !summarizing && (
              <div className="mb-5">
                <button onClick={summarize} className="btn-mustard text-sm">🧠 RESUMIR BANDEJA CON IA</button>
              </div>
            )}

            {editor && (
              <div className="mb-5 border-[3px] border-green-700 bg-green-50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold tracking-widest text-green-800">
                    ✍ BORRADOR · {editor.saved ? "GUARDADO ✓" : "EDITAR Y GUARDAR"}
                  </span>
                  <button onClick={() => setEditor(null)} className="text-xs hover:text-[color:var(--red)]">×</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[60px_1fr] gap-2 text-xs mb-2">
                  <span className="font-mono text-black/60">Para:</span>
                  <span className="font-mono">{editor.to}</span>
                  <span className="font-mono text-black/60">Asunto:</span>
                  <input
                    value={editor.subject}
                    onChange={(e) => setEditor({ ...editor, subject: e.target.value, saved: false })}
                    className="border border-black/30 px-2 py-1 text-xs font-mono"
                  />
                </div>
                <textarea
                  value={editor.body}
                  onChange={(e) => setEditor({ ...editor, body: e.target.value, saved: false })}
                  rows={4}
                  className="w-full border-2 border-black/40 p-3 text-sm font-sans bg-white"
                />
                <div className="mt-2">
                  <input
                    value={editor.instruction}
                    onChange={(e) => setEditor({ ...editor, instruction: e.target.value })}
                    placeholder='Instrucción para Lucía (ej: "responde diciendo que sí, pero el martes 17:00")'
                    className="w-full border border-black/30 px-2 py-1.5 text-xs"
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={saveDraft}
                    disabled={editor.saving}
                    className="btn-mustard text-sm"
                  >
                    {editor.saving ? "GUARDANDO…" : editor.saved ? "✓ GUARDADO" : "💾 GUARDAR EN GMAIL"}
                  </button>
                  <button
                    onClick={regenerateDraft}
                    disabled={editor.saving}
                    className="text-xs font-mono border-2 border-black px-3 py-1.5 hover:bg-black hover:text-white"
                  >
                    🔄 REGENERAR CON INSTRUCCIÓN
                  </button>
                  {editor.saved && (
                    <a
                      href="https://mail.google.com/mail/u/0/#drafts"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold underline"
                    >
                      Abrir Borradores en Gmail →
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  onClick={() => setFilter("todos")}
                  className={`border-2 border-black px-2 py-1 font-bold tracking-wider ${filter === "todos" ? "bg-black text-white" : "hover:bg-[color:var(--mustard)]"}`}
                >TODOS ({state.messages.length})</button>
                <button
                  onClick={() => setFilter("no_leidos")}
                  className={`border-2 border-black px-2 py-1 font-bold tracking-wider ${filter === "no_leidos" ? "bg-black text-white" : "hover:bg-[color:var(--mustard)]"}`}
                >NO LEÍDOS ({state.messages.filter((m) => m.unread).length})</button>
              </div>
              <button
                onClick={cleanPromos}
                disabled={cleaning}
                className="text-[10px] font-bold tracking-wider border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 hover:bg-[color:var(--red)] hover:text-white disabled:opacity-50 break-words text-center max-w-[180px] leading-tight"
              >
                {cleaning ? "LIMPIANDO…" : "🧹 LIMPIAR PROMOS"}
              </button>
            </div>

            <ul className="divide-y divide-black/10">
              {state.messages.length === 0 && (
                <li className="text-sm text-black/50 italic py-4">Bandeja vacía 🎉</li>
              )}
              {state.messages.filter((m) => filter === "todos" || m.unread).map((m) => {
                const exp = expanded[m.id];
                return (
                <li key={m.id} className={`py-3 ${m.unread ? "font-bold" : ""}`}>
                  <div className="flex items-start gap-3">
                    {m.unread && <span className="text-[color:var(--red)] mt-1">●</span>}
                    <div className="flex-1 min-w-0">
                      <button onClick={() => toggleExpand(m.id)} className="text-left w-full">
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <span className="text-sm truncate">{m.from}</span>
                          <span className="text-xs font-mono text-black/50 shrink-0">{shortDate(m.date)}</span>
                        </div>
                        <p className="text-sm truncate">{m.subject || "(sin asunto)"}</p>
                        {!exp && (
                          <p className="text-xs text-black/60 mt-1 line-clamp-2 font-normal">{m.snippet}</p>
                        )}
                      </button>
                      {exp?.loading && <p className="text-xs italic text-black/40 mt-2">Cargando correo…</p>}
                      {exp?.body && (
                        <div className="mt-2 bg-white border-2 border-black/20 p-3 text-xs whitespace-pre-wrap font-normal max-h-80 overflow-y-auto">
                          {exp.body}
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => startDraft(m.id)}
                          disabled={draftFor === m.id}
                          className="text-[10px] font-bold tracking-widest border-2 border-black px-2 py-0.5 hover:bg-[color:var(--mustard)] disabled:opacity-50"
                        >
                          {draftFor === m.id ? "GENERANDO…" : "✍ REDACTAR RESPUESTA"}
                        </button>
                        <button
                          onClick={() => toggleExpand(m.id)}
                          className="text-[10px] font-bold tracking-widest border-2 border-black/40 px-2 py-0.5 hover:bg-black hover:text-white"
                        >
                          {exp ? "OCULTAR" : "VER COMPLETO"}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function shortDate(s: string): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 16);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}
