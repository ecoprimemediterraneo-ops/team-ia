"use client";

// Widget de chat de dudas para la web pública de reservas (cliente final).
// Botón flotante → panel de chat. Contexto (servicios/precios/horario/dirección)
// lo pone el backend a partir del slug. Si el asistente detecta intención de
// reservar, dispara onReservar() para llevar al flujo de reserva.

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatDudas({ slug, nombre, onReservar }: { slug: string; nombre: string; onReservar?: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (abierto && msgs.length === 0) {
      setMsgs([{ role: "assistant", content: `¡Hola! Soy el asistente de ${nombre}. Pregúntame por servicios, precios, duración, horario o dónde estamos. ¿En qué te ayudo?` }]);
    }
  }, [abierto, msgs.length, nombre]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, cargando]);

  async function enviar() {
    const t = texto.trim();
    if (!t || cargando) return;
    const nuevos: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs(nuevos);
    setTexto("");
    setCargando(true);
    try {
      const r = await fetch(`/api/booking/${slug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Solo mandamos user/assistant reales (el saludo inicial también vale como contexto).
        body: JSON.stringify({ messages: nuevos.slice(-16) }),
      });
      const j = await r.json();
      if (r.ok && j.ok) {
        setMsgs((prev) => [...prev, { role: "assistant", content: j.reply }]);
        if (j.iniciarReserva && onReservar) {
          setTimeout(() => { setAbierto(false); onReservar(); }, 1200);
        }
      } else {
        setMsgs((prev) => [...prev, { role: "assistant", content: "Uf, ahora no puedo responder. Prueba de nuevo en un momento o reserva directamente aquí." }]);
      }
    } catch {
      setMsgs((prev) => [...prev, { role: "assistant", content: "Fallo de conexión. Inténtalo otra vez." }]);
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      {/* Botón flotante */}
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 border-[3px] border-black bg-[color:var(--mustard)] px-4 py-3 font-bold uppercase tracking-widest text-sm shadow-[4px_4px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#000] transition"
          aria-label="Abrir chat de dudas"
        >
          <span className="text-lg leading-none">💬</span> ¿Dudas?
        </button>
      )}

      {/* Panel */}
      {abierto && (
        <div className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:right-4 sm:bottom-4 z-50 w-full sm:w-[380px] max-h-[80vh] sm:max-h-[560px] flex flex-col border-[3px] border-black bg-[color:var(--cream)] shadow-[6px_6px_0_0_#000]">
          <div className="flex items-center justify-between border-b-[3px] border-black bg-black px-4 py-3">
            <div className="text-white">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/50">Asistente</div>
              <div className="font-bold leading-none truncate">{nombre}</div>
            </div>
            <button onClick={() => setAbierto(false)} className="w-8 h-8 border-2 border-white/40 text-white font-bold hover:bg-white hover:text-black" aria-label="Cerrar">✕</button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 text-sm border-2 border-black ${m.role === "user" ? "bg-[color:var(--mustard)]" : "bg-white"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {cargando && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-3 py-2 text-sm border-2 border-black bg-white text-black/40 animate-pulse">Escribiendo…</div>
              </div>
            )}
          </div>

          <div className="border-t-[3px] border-black p-2 flex gap-2 bg-white">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") enviar(); }}
              placeholder="Escribe tu duda…"
              className="flex-1 border-2 border-black px-3 py-2 text-sm bg-white outline-none"
              disabled={cargando}
            />
            <button onClick={enviar} disabled={cargando || !texto.trim()} className="btn-mustard text-xs px-3 disabled:opacity-50">Enviar</button>
          </div>
        </div>
      )}
    </>
  );
}
