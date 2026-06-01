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
    <div className="mt-8">
      {flash && (
        <div className={`mb-4 px-3 py-2 border-2 border-black text-sm font-bold ${flash.ok ? "bg-green-200" : "bg-red-200"}`}>
          {flash.ok ? "✓" : "⚠"} {flash.msg}
          <button onClick={() => setFlash(null)} className="ml-2 text-xs">×</button>
        </div>
      )}

      <div className="card-hard p-5">
        <div className="mb-4">
          <h3 className="font-stencil text-2xl">Responde WhatsApps en 10 segundos</h3>
          <p className="text-sm text-black/60 mt-1">
            Pega el mensaje que recibiste, elige qué quieres conseguir, Pablo te genera la respuesta. Tú la copias y la pegas en WhatsApp.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">Mensaje del cliente</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder='Ej: "Hola, ¿tenéis hueco esta semana para una limpieza?"'
              className="w-full border-2 border-black p-3 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/10"
            />

            <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1 mt-3">Qué queremos conseguir</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {INTENTS.map((i) => (
                <button
                  key={i.value}
                  type="button"
                  onClick={() => setIntent(i.value)}
                  className={`border-2 border-black px-2 py-2 text-[11px] font-bold tracking-widest text-left ${intent === i.value ? "bg-black text-white" : "bg-white hover:bg-[color:var(--mustard)]/30"}`}
                >
                  {i.emoji} {i.label.toUpperCase()}
                </button>
              ))}
            </div>

            <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1 mt-3">Nombre del cliente (opcional)</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Marta, Juan…"
              className="w-full border-2 border-black px-3 py-2 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
            />

            <button onClick={generate} disabled={loading} className="btn-mustard text-sm mt-4 w-full">
              {loading ? "REDACTANDO…" : "✨ GENERAR RESPUESTA"}
            </button>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">Respuesta de Pablo</label>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={10}
              placeholder="Aquí aparecerá la respuesta lista para pegar en WhatsApp…"
              className="w-full border-2 border-black p-3 text-sm bg-[color:var(--cream)] focus:outline-none focus:bg-white whitespace-pre-wrap"
            />
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button onClick={copy} disabled={!reply} className="btn-mustard text-sm">
                {copied ? "✓ COPIADO" : "📋 COPIAR"}
              </button>
              <button onClick={generate} disabled={loading || !message.trim()} className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white disabled:opacity-40">
                🔄 REGENERAR
              </button>
              <a
                href="https://web.whatsapp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold underline ml-auto"
              >
                Abrir WhatsApp Web →
              </a>
            </div>
            <p className="text-xs text-green-700 mt-3 font-mono">
              ✓ Pablo está conectado a WhatsApp Business y responde automáticamente. Usa esta herramienta para generar respuestas manuales si quieres intervenir tú.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
