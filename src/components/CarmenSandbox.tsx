"use client";
import { useState } from "react";

type Analysis = { resumen: string; intent: string; urgencia: string; recall_phone: string | null };

export default function CarmenSandbox() {
  const [message, setMessage] = useState("");
  const [caller, setCaller] = useState("");
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [wa, setWa] = useState("");

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || busy) return; setBusy(true);
    setAnalysis(null); setWa("");
    try {
      const r = await fetch("/api/carmen/sandbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, caller_number: caller || undefined }) });
      const j = await r.json();
      if (!r.ok) alert(j.error || "Error");
      else { setAnalysis(j.analysis); setWa(j.whatsapp_simulado); }
    } finally { setBusy(false); }
  }

  return (
    <div className="card-hard p-5 bg-white border-[#A88BE8]">
      <h3 className="font-stencil text-2xl mb-2">🧪 Sandbox · prueba sin gastar minutos</h3>
      <p className="text-xs text-black/60 mb-3">Escribe lo que diría el cliente y mira lo que Carmen detecta + el WhatsApp que recibirías.</p>

      <form onSubmit={go} className="card-hard p-3 bg-[color:var(--cream)] space-y-2 mb-3">
        <input value={caller} onChange={(e) => setCaller(e.target.value)} placeholder="Número simulado (opcional, +34xxx)" className="w-full border-2 border-black px-2 py-1 text-sm" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Lo que diría el cliente en el contestador. Ej: 'Hola, me llamo María, tengo un dolor muy fuerte en la muela, ¿podríais atenderme hoy? Mi número es 600123456.'" className="w-full border-2 border-black p-2 text-sm" />
        <button type="submit" disabled={busy || !message.trim()} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Analizando…" : "▶️ Simular llamada"}</button>
      </form>

      {analysis && (
        <div className="grid md:grid-cols-2 gap-3">
          <div className="card-hard p-3 bg-white">
            <div className="text-[10px] font-mono uppercase mb-1">Análisis Carmen</div>
            <div className="flex gap-2 flex-wrap mb-2">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ background: analysis.urgencia === "urgente" ? "#EF4444" : analysis.urgencia === "alta" ? "#FB923C" : "#94A3B8" }}>{analysis.urgencia}</span>
              <span className="text-[10px] border border-black/40 px-1.5 py-0.5">{analysis.intent}</span>
            </div>
            <p className="text-sm font-bold mb-1">{analysis.resumen}</p>
            {analysis.recall_phone && <p className="text-xs">📞 Devolver llamada: <b>{analysis.recall_phone}</b></p>}
          </div>
          <div className="card-hard p-3 bg-[#25D366]/10 border-[#25D366]">
            <div className="text-[10px] font-mono uppercase mb-1">📲 WhatsApp que recibirías</div>
            <pre className="text-xs whitespace-pre-wrap font-sans">{wa}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
