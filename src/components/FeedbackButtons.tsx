"use client";
import { useState } from "react";

type Props = {
  agent: "lucia" | "marta" | "carmen" | "pablo" | "rocio" | "eva" | "sergio" | "diana" | "tomas";
  userMessage: string;
  agentResponse: string;
};

export default function FeedbackButtons({ agent, userMessage, agentResponse }: Props) {
  const [sent, setSent] = useState<"up" | "down" | null>(null);
  const [editing, setEditing] = useState(false);
  const [correction, setCorrection] = useState(agentResponse);
  const [saving, setSaving] = useState(false);

  async function send(rating: "up" | "down", correctionText?: string) {
    if (sent && !correctionText) return;
    setSaving(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent,
          userMessage,
          agentResponse,
          rating,
          correction: correctionText,
        }),
      });
      setSent(rating);
      setEditing(false);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  if (editing) {
    return (
      <div className="absolute -bottom-2 left-2 right-2 translate-y-full bg-white border-[3px] border-black p-3 shadow-[3px_3px_0_#000] z-30">
        <p className="text-[10px] font-bold tracking-widest mb-2 text-[color:var(--red)]">CORREGIR RESPUESTA — se aprende como gold standard</p>
        <textarea
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          rows={4}
          className="w-full border-2 border-black p-2 text-xs font-sans"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => send("down", correction)}
            disabled={saving}
            className="text-[10px] font-bold tracking-widest border-2 border-black bg-[color:var(--mustard)] px-2 py-1 hover:bg-black hover:text-white"
          >
            {saving ? "GUARDANDO…" : "✓ GUARDAR LECCIÓN"}
          </button>
          <button onClick={() => setEditing(false)} className="text-[10px] font-bold tracking-widest border-2 border-black px-2 py-1 hover:bg-black hover:text-white">
            CANCELAR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute -bottom-2 right-2 translate-y-full flex items-center gap-1 z-20">
      {sent ? (
        <span className="bg-green-200 border-2 border-black px-2 py-0.5 text-[9px] font-bold tracking-widest">
          ✓ {sent === "up" ? "GRACIAS" : "GUARDADO"}
        </span>
      ) : (
        <>
          <button
            onClick={() => send("up")}
            disabled={saving}
            className="bg-white border-2 border-black w-7 h-7 flex items-center justify-center text-sm hover:bg-green-200"
            title="Buena respuesta"
          >👍</button>
          <button
            onClick={() => send("down")}
            disabled={saving}
            className="bg-white border-2 border-black w-7 h-7 flex items-center justify-center text-sm hover:bg-red-200"
            title="Mala respuesta"
          >👎</button>
          <button
            onClick={() => setEditing(true)}
            className="bg-white border-2 border-black w-7 h-7 flex items-center justify-center text-sm hover:bg-[color:var(--mustard)]"
            title="Corregir y enseñar"
          >✏️</button>
        </>
      )}
    </div>
  );
}
