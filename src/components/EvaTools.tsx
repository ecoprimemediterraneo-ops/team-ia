"use client";
import { useEffect, useState } from "react";
import type { Contact, EmailTemplate } from "@/lib/store";

export default function EvaTools({ initialContacts }: { initialContacts: Contact[] }) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [tplName, setTplName] = useState("");
  const [showSaveTpl, setShowSaveTpl] = useState(false);

  useEffect(() => {
    fetch("/api/eva/templates").then((r) => r.json()).then((d) => setTemplates(d.templates || []));
  }, []);

  async function saveTemplate() {
    if (!tplName.trim() || !subject.trim() || !body.trim()) {
      setFeedback({ ok: false, msg: "Plantilla necesita nombre, asunto y cuerpo" });
      return;
    }
    const res = await fetch("/api/eva/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tplName, subject, body }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFeedback({ ok: false, msg: data.error || "Error" });
      return;
    }
    setTemplates([data.template, ...templates]);
    setTplName("");
    setShowSaveTpl(false);
    setFeedback({ ok: true, msg: "Plantilla guardada ✓" });
  }

  function loadTemplate(t: EmailTemplate) {
    setSubject(t.subject);
    setBody(t.body);
    setFeedback({ ok: true, msg: `Plantilla "${t.name}" cargada` });
  }

  async function delTemplate(id: string) {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    await fetch(`/api/eva/templates?id=${id}`, { method: "DELETE" });
    setTemplates(templates.filter((t) => t.id !== id));
  }

  useEffect(() => {
    const t = feedback ? setTimeout(() => setFeedback(null), 6000) : null;
    return () => { if (t) clearTimeout(t); };
  }, [feedback]);

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    const res = await fetch("/api/eva/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail.trim(), name: newName.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFeedback({ ok: false, msg: data.error || "Error" });
      return;
    }
    setContacts(data.contacts);
    setNewEmail("");
    setNewName("");
  }

  async function delContact(emailToDel: string) {
    if (!confirm(`¿Eliminar ${emailToDel}?`)) return;
    const res = await fetch(`/api/eva/contacts?email=${encodeURIComponent(emailToDel)}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) setContacts(data.contacts);
  }

  async function send(toAll: boolean) {
    if (!subject.trim() || !body.trim()) {
      setFeedback({ ok: false, msg: "Falta asunto o cuerpo" });
      return;
    }
    if (!toAll) {
      setFeedback({ ok: false, msg: "Solo soportado: enviar a toda la lista" });
      return;
    }
    if (contacts.length === 0) {
      setFeedback({ ok: false, msg: "Tu lista está vacía" });
      return;
    }
    if (!confirm(`¿Enviar a ${contacts.length} contacto(s)?`)) return;
    setSending(true);
    try {
      const res = await fetch("/api/eva/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, to: "all" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setFeedback({ ok: true, msg: `${data.sent} enviado(s) · ${data.failed} fallido(s)` });
      if (data.sent > 0 && data.failed === 0) {
        setSubject("");
        setBody("");
      }
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : "Error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-8 grid lg:grid-cols-[300px_1fr] gap-5">
      {/* Lista de contactos */}
      <div className="card-hard p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-stencil text-lg">Lista</h3>
          <span className="text-xs font-mono text-black/60">{contacts.length} contacto{contacts.length === 1 ? "" : "s"}</span>
        </div>
        <form onSubmit={addContact} className="flex flex-col gap-2 mb-3">
          <input
            type="text"
            placeholder="Nombre (opcional)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="border-2 border-black px-2 py-1.5 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
          />
          <input
            required
            type="email"
            placeholder="email@cliente.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="border-2 border-black px-2 py-1.5 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
          />
          <button className="btn-mustard text-xs">+ AÑADIR</button>
        </form>
        <ul className="text-sm space-y-1 max-h-64 overflow-y-auto">
          {contacts.length === 0 && (
            <li className="text-xs text-black/50 italic">Aún no has añadido nadie</li>
          )}
          {contacts.map((c) => (
            <li key={c.email} className="flex items-center justify-between gap-2 border-b border-black/10 pb-1">
              <span className="truncate">
                {c.name && <span className="font-bold">{c.name} · </span>}
                <span className="text-black/70 text-xs">{c.email}</span>
              </span>
              <button onClick={() => delContact(c.email)} className="text-black/40 hover:text-[color:var(--red)] text-xs px-1">×</button>
            </li>
          ))}
        </ul>
      </div>

      {/* Compositor de envío real */}
      <div className="card-hard p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-stencil text-lg">Enviar de verdad</h3>
          <span className="text-xs font-mono text-[color:var(--red)]">★ ENVÍO REAL</span>
        </div>
        <p className="text-xs text-black/60 mb-3">
          Pídele a Eva el correo en el chat de arriba, copia su salida aquí abajo y le das a enviar.
          Sale desde <code className="bg-black/5 px-1">eva@aiteam.marketing</code> ✓
        </p>

        {/* Plantillas */}
        {templates.length > 0 && (
          <div className="mb-3 border-2 border-black bg-[color:var(--mustard)]/10 p-2">
            <div className="text-[10px] font-bold tracking-widest text-black/60 mb-1">📋 PLANTILLAS GUARDADAS</div>
            <div className="flex flex-wrap gap-1">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center gap-1 bg-white border border-black/30 text-[11px]">
                  <button onClick={() => loadTemplate(t)} className="px-2 py-0.5 hover:bg-[color:var(--mustard)]">{t.name}</button>
                  <button onClick={() => delTemplate(t.id)} className="px-1 text-black/40 hover:text-[color:var(--red)]">×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <input
          type="text"
          placeholder="Asunto del correo"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full border-2 border-black px-3 py-2 text-sm mb-2 focus:outline-none focus:bg-[color:var(--mustard)]/20"
        />
        <textarea
          rows={8}
          placeholder="Cuerpo del correo (texto plano o HTML)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full border-2 border-black px-3 py-2 text-sm font-mono focus:outline-none focus:bg-[color:var(--mustard)]/20"
        />
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button
            disabled={sending}
            onClick={() => send(true)}
            className="btn-mustard text-sm"
          >
            {sending ? "ENVIANDO…" : `📨 ENVIAR A LA LISTA (${contacts.length})`}
          </button>
          <button
            onClick={() => setShowSaveTpl(!showSaveTpl)}
            disabled={!subject.trim() || !body.trim()}
            className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white disabled:opacity-40"
          >
            💾 GUARDAR COMO PLANTILLA
          </button>
          <span className="text-xs font-mono text-black/50">
            Free tier Resend: 100 emails/día · 3.000/mes
          </span>
        </div>

        {showSaveTpl && (
          <div className="mt-3 p-3 border-2 border-black bg-[color:var(--cream)]">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder='Nombre plantilla (ej: "Promo blanqueamiento")'
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                className="flex-1 border-2 border-black px-2 py-1.5 text-sm min-w-[200px]"
              />
              <button onClick={saveTemplate} className="btn-mustard text-xs">✓ GUARDAR</button>
              <button onClick={() => setShowSaveTpl(false)} className="text-xs font-mono border-2 border-black px-2 py-1.5 hover:bg-black hover:text-white">CANCELAR</button>
            </div>
          </div>
        )}
        {feedback && (
          <div className={`mt-3 px-3 py-2 border-2 border-black text-sm font-bold ${feedback.ok ? "bg-green-200" : "bg-red-200"}`}>
            {feedback.ok ? "✓" : "⚠"} {feedback.msg}
          </div>
        )}
      </div>
    </div>
  );
}
