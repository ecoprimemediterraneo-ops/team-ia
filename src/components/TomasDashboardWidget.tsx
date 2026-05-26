"use client";
import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function TomasDashboardWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Hola, soy Tomás. Soporte 24/7 AI-Team. Tengo acceso al estado de tus agentes, así que puedo darte respuestas concretas. ¿En qué te ayudo?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, open]);

  async function send() {
    if (!input.trim() || busy) return;
    const newMsgs: Msg[] = [...msgs, { role: "user", content: input.trim() }];
    setMsgs(newMsgs); setInput(""); setBusy(true);
    try {
      const r = await fetch("/api/tomas/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsgs((m) => [...m, { role: "assistant", content: j.error || "Error" }]);
      } else {
        setMsgs((m) => [...m, { role: "assistant", content: j.reply }]);
        if (j.escalated) setEscalated(true);
      }
    } finally { setBusy(false); }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 bg-[#06B6D4] border-[3px] border-black shadow-[4px_4px_0_#000] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_#000] transition-all rounded-full w-16 h-16 flex items-center justify-center"
          aria-label="Abrir chat con Tomás"
        >
          <span className="text-2xl">💬</span>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[color:var(--red)] border-2 border-black rounded-full animate-pulse" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[380px] max-w-[calc(100vw-2.5rem)] card-hard bg-white flex flex-col" style={{ height: "min(580px, calc(100vh - 2.5rem))" }}>
          <div className="bg-[#06B6D4] text-white p-3 flex justify-between items-center border-b-[3px] border-black">
            <div>
              <div className="font-bold text-sm flex items-center gap-1">🤖 Tomás <span className="text-[10px] bg-[#14B8A6] px-1.5 py-0.5 rounded">EN LÍNEA</span></div>
              <div className="text-[10px] opacity-80">Soporte 24/7 con contexto de tus agentes</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white text-2xl leading-none hover:opacity-70" aria-label="Cerrar">×</button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-[color:var(--cream)]">
            {msgs.map((m, i) => (
              <div key={i} className={`text-sm ${m.role === "user" ? "ml-8 bg-white border-2 border-black p-2" : "mr-8 bg-[#A88BE8]/20 border-2 border-[#A88BE8] p-2"}`}>
                <div className="text-[9px] font-mono uppercase opacity-60 mb-1">{m.role === "user" ? "TÚ" : "TOMÁS"}</div>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
            {busy && <div className="text-xs text-black/50 italic">Tomás está analizando…</div>}
            {escalated && (
              <div className="card-hard p-2 bg-[#14B8A6]/20 border-[#14B8A6] text-xs">
                ✓ Caso escalado al equipo con todo el contexto. Te contactarán en menos de 24h por email.
              </div>
            )}
          </div>

          <div className="border-t-[3px] border-black p-2 flex gap-1">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Escribe tu duda…"
              className="flex-1 border-2 border-black px-2 py-1 text-sm"
              disabled={busy}
            />
            <button onClick={send} disabled={busy || !input.trim()} className="btn-mustard text-xs disabled:opacity-50 px-3">→</button>
          </div>
        </div>
      )}
    </>
  );
}
