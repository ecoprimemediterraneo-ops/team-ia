"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const WELCOME: Msg = {
  role: "assistant",
  content: "Hola, soy Tomás, soporte de AI-Team. ¿En qué te puedo ayudar?",
};

export default function TomasWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/tomas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Mandamos sin el mensaje de bienvenida (es local, no contexto real)
          messages: next.filter((m, i) => !(i === 0 && m === WELCOME)),
        }),
      });
      const data = await res.json().catch(() => ({}));
      const reply: string =
        data?.reply ||
        "No te he podido responder ahora. Escríbenos a hola@aiteam.marketing y te contesto yo en cuanto pueda.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sin conexión. Inténtalo en un momento o escribe a hola@aiteam.marketing.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Botón flotante Tomás — encima del de WhatsApp */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir chat con Tomás"
          className="fixed right-5 z-50 w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-lg shadow-black/30 transition-transform duration-200 hover:scale-105 bg-black border-[3px] border-[color:var(--mustard)]"
          style={{ bottom: "92px" }}
        >
          <span className="font-stencil text-[color:var(--mustard)] text-2xl leading-none">T</span>
          <span className="absolute -top-1 -right-1 bg-[color:var(--red)] text-white text-[10px] font-bold tracking-widest px-1.5 py-0.5 border-2 border-black">
            24/7
          </span>
        </button>
      )}

      {/* Panel de chat */}
      {open && (
        <div
          className="fixed right-5 z-50 w-[92vw] sm:w-[360px] h-[480px] max-h-[80vh] flex flex-col bg-[color:var(--cream)] border-[3px] border-black shadow-2xl"
          style={{ bottom: "92px" }}
          role="dialog"
          aria-label="Chat con Tomás"
        >
          {/* Header */}
          <header className="bg-black text-[color:var(--mustard)] px-4 py-3 flex items-center justify-between border-b-[3px] border-black">
            <div className="flex items-center gap-2">
              <span className="font-stencil text-xl">Tomás</span>
              <span className="text-[10px] font-mono tracking-widest text-white/60">SOPORTE · 24/7</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar chat"
              className="text-[color:var(--mustard)] hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </header>

          {/* Mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] px-3 py-2 text-sm leading-snug border-2 border-black ${
                  m.role === "user"
                    ? "ml-auto bg-[color:var(--mustard)] text-black"
                    : "mr-auto bg-white text-black"
                }`}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="mr-auto bg-white border-2 border-black px-3 py-2 text-sm text-black/50 italic">
                escribiendo…
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="border-t-[3px] border-black bg-white p-2 flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta…"
              maxLength={500}
              className="flex-1 border-2 border-black px-3 py-2 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-black text-[color:var(--mustard)] font-bold text-xs tracking-widest uppercase px-3 py-2 border-2 border-black hover:bg-[color:var(--red)] hover:text-white transition-colors disabled:opacity-50"
            >
              →
            </button>
          </form>
        </div>
      )}
    </>
  );
}
