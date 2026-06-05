"use client";
import { useState } from "react";

type Intent = "responder" | "agendar" | "captar_lead" | "seguimiento" | "info";

const INTENTS: { value: Intent; label: string; emoji: string }[] = [
  { value: "responder", label: "Responder duda", emoji: "💬" },
  { value: "agendar", label: "Agendar cita", emoji: "📅" },
  { value: "captar_lead", label: "Captar lead", emoji: "🎯" },
  { value: "seguimiento", label: "Seguimiento", emoji: "🔁" },
  { value: "info", label: "Dar info", emoji: "ℹ️" },
];

export default function PabloTools() {
  const [message, setMessage] = useState("");
  const [intent, setIntent] = useState<Intent>("responder");
  const [customerName, setCustomerName] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  async function generate() {
    if (!message.trim()) {
      setFlash({ ok: false, msg: "Pega primero el mensaje del cliente" });
      return;
    }
    setLoading(true);
    setReply("");
    setCopied(false);
    try {
      const res = await fetch("/api/pablo/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, intent, customerName: customerName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setReply(data.reply);
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(reply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      {flash && (
        <div className={`mb-3 px-3 py-2 border-2 border-black text-sm font-bold ${flash.ok ? "bg-green-200" : "bg-red-200"}`}>
          {flash.ok ? "✓" : "⚠"} {flash.msg}
          <button onClick={() => setFlash(null)} className="ml-2 text-xs">×</button>
        </div>
      )}

      <div className="card-hard p-4 overflow-hidden">
        <div className="mb-3">
          <h3 className="font-stencil text-xl sm:text-2xl leading-tight break-words">
            Responde WhatsApps en 10 segundos
          </h3>
          <p className="text-xs sm:text-sm text-black/60 mt-1 leading-snug">
            Pega el mensaje, elige qué quieres conseguir y Pablo genera la respuesta. Tú copias y pegas.
          </p>
        </div>

        {/* Se mantiene en columna única dentro del dashboard de 2 col;
            solo se divide en pantallas muy anchas. */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-black/60 mb-1">Mensaje del cliente</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder='Ej: "Hola, ¿tenéis hueco esta semana?"'
              className="w-full border-2 border-black p-2 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/10"
            />

            <label className="block text-[10px] font-mono uppercase tracking-wider text-black/60 mb-1 mt-3">Qué queremos conseguir</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {INTENTS.map((i) => (
                <button
                  key={i.value}
                  type="button"
                  onClick={() => setIntent(i.value)}
                  className={`border-2 border-black px-1.5 py-1.5 text-[10px] font-bold tracking-normal text-center leading-tight break-words min-w-0 ${intent === i.value ? "bg-black text-white" : "bg-white hover:bg-[color:var(--mustard)]/30"}`}
                >
                  <span className="block">{i.emoji}</span>
                  <span className="block">{i.label.toUpperCase()}</span>
                </button>
              ))}
            </div>

            <label className="block text-[10px] font-mono uppercase tracking-wider text-black/60 mb-1 mt-3">Nombre del cliente (opcional)</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Marta, Juan…"
              className="w-full border-2 border-black px-2 py-1.5 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
            />

            <button onClick={generate} disabled={loading} className="btn-mustard text-sm mt-3 w-full">
              {loading ? "REDACTANDO…" : "✨ GENERAR RESPUESTA"}
            </button>
          </div>

          <div className="min-w-0">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-black/60 mb-1">Respuesta de Pablo</label>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              placeholder="Aquí aparecerá la respuesta lista para pegar en WhatsApp…"
              className="w-full border-2 border-black p-2 text-sm bg-[color:var(--cream)] focus:outline-none focus:bg-white whitespace-pre-wrap"
            />
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <button onClick={copy} disabled={!reply} className="btn-mustard text-xs px-3 py-1.5">
                {copied ? "✓ COPIADO" : "📋 COPIAR"}
              </button>
              <button onClick={generate} disabled={loading || !message.trim()} className="text-[11px] font-mono border-2 border-black px-2 py-1.5 hover:bg-black hover:text-white disabled:opacity-40">
                🔄 REGENERAR
              </button>
              <a
                href="https://web.whatsapp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold underline ml-auto"
              >
                Abrir WhatsApp Web →
              </a>
            </div>
            <p className="text-[11px] text-green-700 mt-2 font-mono leading-snug">
              ✓ Pablo responde solo en WhatsApp. Usa esto para redactar manualmente si quieres intervenir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
