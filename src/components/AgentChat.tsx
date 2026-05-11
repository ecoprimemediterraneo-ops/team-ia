"use client";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import FeedbackButtons from "./FeedbackButtons";

type Props = {
  agent: "lucia" | "marta" | "carmen" | "pablo" | "rocio" | "eva" | "sergio";
  initialMessages: ChatMessage[];
  placeholder: string;
  suggestions?: string[];
};

export default function AgentChat({ agent, initialMessages, placeholder, suggestions = [] }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/${agent}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${err instanceof Error ? err.message : "Error"}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function clear() {
    if (!confirm("¿Borrar la conversación?")) return;
    await fetch(`/api/chat/${agent}/clear`, { method: "POST" });
    setMessages([]);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
      <div className="flex-1 overflow-y-auto card-hard p-4 space-y-3 bg-white">
        {messages.length === 0 && suggestions.length > 0 && (
          <div className="text-sm">
            <p className="text-black/60 mb-3 font-mono uppercase tracking-widest text-xs">Prueba con:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="border-2 border-black px-3 py-1.5 text-xs font-bold hover:bg-[color:var(--mustard)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`group relative max-w-[85%] px-4 py-2.5 border-[3px] border-black whitespace-pre-wrap leading-relaxed text-sm ${
                m.role === "user" ? "bg-[color:var(--mustard)]" : "bg-[color:var(--cream)]"
              }`}
            >
              {m.content}
              {m.role === "assistant" && (
                <>
                  <button
                    type="button"
                    onClick={async (e) => {
                      await navigator.clipboard.writeText(m.content);
                      const btn = e.currentTarget;
                      const prev = btn.textContent;
                      btn.textContent = "✓ COPIADO";
                      setTimeout(() => { btn.textContent = prev; }, 1500);
                    }}
                    className="absolute -top-2 -right-2 bg-white border-2 border-black px-2 py-0.5 text-[10px] font-bold tracking-widest hover:bg-[color:var(--mustard)]"
                    title="Copiar al portapapeles"
                  >
                    COPIAR
                  </button>
                  <FeedbackButtons agent={agent} userMessage={i > 0 ? messages[i-1]?.content || "" : ""} agentResponse={m.content} />
                </>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-sm font-mono text-black/50">escribiendo...</div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 border-[3px] border-black px-3 py-3 focus:outline-none"
        />
        <button type="submit" disabled={loading || !input.trim()} className="btn-mustard">
          Enviar
        </button>
        {messages.length > 0 && (
          <button type="button" onClick={clear} className="border-[3px] border-black px-3 py-3 text-xs uppercase tracking-widest font-bold hover:bg-[color:var(--red)] hover:text-white">
            Limpiar
          </button>
        )}
      </form>
    </div>
  );
}
