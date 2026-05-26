"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type Msg = { role: "user" | "assistant"; content: string };

const SALUDO: Msg = {
  role: "assistant",
  content: "¡Hola! Soy Tomás 👋 Estoy aquí 24/7 para resolver dudas sobre AI-Team. ¿En qué te ayudo?",
};

export default function TomasWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([SALUDO]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    const texto = input.trim();
    if (!texto || loading) return;
    const nuevos: Msg[] = [...messages, { role: "user", content: texto }];
    setMessages(nuevos);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/tomas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nuevos.slice(-10) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Error");
      setMessages((m) => [...m, { role: "assistant", content: data.respuesta }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Uy, problema técnico. Prueba de nuevo o escríbenos a hola@aiteam.marketing 🙏" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const SUGERENCIAS = [
    "¿Qué pack me recomiendas?",
    "¿Cómo funciona el diagnóstico?",
    "¿Carmen está incluida?",
    "¿Cuánto tardáis en activar?",
  ];

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Cerrar chat" : "Abrir chat con Tomás"}
        className="fixed bottom-5 right-5 z-50 group"
      >
        {!open && (
          <span className="hidden sm:inline-block absolute right-[100px] top-1/2 -translate-y-1/2 whitespace-nowrap bg-black text-white text-xs font-bold uppercase tracking-widest px-3 py-2 border-[3px] border-black shadow-[3px_3px_0_#000] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            ¿Te ayudo?
          </span>
        )}
        <div
          className="w-[88px] h-[88px] border-[3px] border-black shadow-[4px_4px_0_#000] overflow-hidden bg-[#06B6D4] group-hover:translate-y-[-2px] group-hover:shadow-[6px_6px_0_#000] transition-all"
          style={{ borderRadius: "50%" }}
        >
          <Image
            src="/agentes/tomas/tomas.webp"
            alt="Tomás"
            width={88}
            height={88}
            className="w-full h-full object-cover"
          />
        </div>
        {!open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[color:var(--red)] border-2 border-black rounded-full animate-pulse" />
        )}
      </button>

      {/* Panel chat */}
      {open && (
        <div
          className="fixed bottom-24 right-5 z-50 w-[360px] max-w-[calc(100vw-2.5rem)] card-hard bg-white flex flex-col"
          style={{ height: "560px", maxHeight: "calc(100vh - 8rem)" }}
        >
          {/* Header */}
          <div className="border-b-[3px] border-black p-3 flex items-center gap-3 bg-[#06B6D4]/10">
            <div className="w-10 h-10 border-2 border-black overflow-hidden shrink-0" style={{ background: "#06B6D4", borderRadius: "50%" }}>
              <Image src="/agentes/tomas/tomas.webp" alt="Tomás" width={40} height={40} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="font-stencil text-lg leading-none">Tomás</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">TANGO-T9 · Soporte 24/7</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar" className="text-2xl text-black/40 hover:text-black px-2">×</button>
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-[color:var(--cream)]/30">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-black text-white border-2 border-black"
                      : "bg-white border-2 border-black"
                  }`}
                  style={{ borderRadius: m.role === "user" ? "12px 12px 0 12px" : "12px 12px 12px 0" }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border-2 border-black px-3 py-2 text-sm" style={{ borderRadius: "12px 12px 12px 0" }}>
                  <span className="inline-flex gap-1">
                    <span className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}

            {/* Sugerencias solo al inicio */}
            {messages.length === 1 && !loading && (
              <div className="flex flex-wrap gap-2 pt-2">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s);
                      setTimeout(() => enviar(), 50);
                    }}
                    className="text-[11px] border-2 border-black bg-white px-2 py-1 hover:bg-[#06B6D4]/10 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={enviar} className="border-t-[3px] border-black p-2 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta..."
              className="flex-1 border-2 border-black px-3 py-2 text-sm focus:outline-none"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-[#06B6D4] text-white border-2 border-black px-4 py-2 font-bold text-sm hover:bg-black transition disabled:opacity-50"
            >
              →
            </button>
          </form>

          <p className="text-[10px] text-center text-black/40 pb-2 px-2">
            Tomás usa IA. Para temas críticos:{" "}
            <a href="mailto:hola@aiteam.marketing" className="underline">hola@aiteam.marketing</a>
          </p>
        </div>
      )}
    </>
  );
}
