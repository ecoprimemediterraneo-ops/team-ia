"use client";
import { useEffect, useState } from "react";

type Call = { id: string; caller_number: string | null; duration_sec: number | null; transcript: string | null; resumen: string | null; intent: string | null; urgencia: string; recall_phone: string | null; status: string; whatsapp_sent: boolean; email_sent: boolean; created_at: string; recording_url: string | null };

const URG_COLORS: Record<string, string> = { urgente: "#EF4444", alta: "#FB923C", normal: "#94A3B8", spam: "#000000" };

export default function CarmenCalls() {
  const [items, setItems] = useState<Call[]>([]);
  const [filter, setFilter] = useState("");

  async function load() { const q = filter ? `?status=${filter}` : ""; const r = await fetch(`/api/carmen/calls${q}`); const j = await r.json(); setItems(j.items || []); }
  useEffect(() => { load(); }, [filter]); // eslint-disable-line

  async function setStatus(id: string, status: string) {
    await fetch("/api/carmen/calls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", id, status }) });
    load();
  }

  return (
    <div className="card-hard p-5 bg-white border-[#A88BE8]">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <h3 className="font-stencil text-2xl">📞 Llamadas perdidas ({items.length})</h3>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="text-xs border-2 border-black px-2 py-1 bg-white">
          <option value="">Todas</option><option value="nueva">Nuevas</option><option value="contactado">Contactadas</option><option value="resuelta">Resueltas</option><option value="descartada">Descartadas</option>
        </select>
      </div>
      <p className="text-xs text-black/60 mb-3">Cada llamada perdida queda aquí con transcripción, resumen IA y prioridad. WhatsApp instantáneo al dueño.</p>

      {items.length === 0 ? <p className="text-sm text-black/50 text-center py-3">Sin llamadas. Cuando configures el número Twilio empezarán a llegar aquí.</p> : (
        <div className="space-y-2">{items.map((c) => (
          <div key={c.id} className={`border-2 p-3 bg-white`} style={{ borderLeftWidth: 6, borderLeftColor: URG_COLORS[c.urgencia] || "#000" }}>
            <div className="flex justify-between items-center gap-2 flex-wrap mb-2">
              <div className="flex gap-2 items-center text-xs flex-wrap">
                <b className="text-sm">📱 {c.caller_number || "desconocido"}</b>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ background: URG_COLORS[c.urgencia] || "#000" }}>{c.urgencia}</span>
                {c.intent && <span className="text-[10px] border border-black/40 px-1.5 py-0.5">{c.intent}</span>}
                {c.duration_sec ? <span className="text-[10px] text-black/60">{c.duration_sec}s</span> : null}
                {c.whatsapp_sent && <span className="text-[10px] text-[#25D366]">✓ WA</span>}
                {c.email_sent && <span className="text-[10px] text-[#60A5FA]">✓ Email</span>}
              </div>
              <span className="text-[10px] text-black/40">{new Date(c.created_at).toLocaleString("es-ES")}</span>
            </div>
            {c.resumen && <p className="text-sm font-bold mb-2">{c.resumen}</p>}
            {c.transcript && (
              <details className="text-xs text-black/70 mb-2">
                <summary className="cursor-pointer text-[10px] uppercase font-mono">Transcripción completa</summary>
                <p className="mt-1 whitespace-pre-wrap italic">"{c.transcript}"</p>
              </details>
            )}
            {c.recording_url && <audio controls src={c.recording_url} className="w-full mb-2" />}
            <div className="flex gap-2 flex-wrap">
              {c.recall_phone && <a href={`tel:${c.recall_phone}`} className="text-[10px] font-bold border-2 border-[#14B8A6] text-[#14B8A6] px-2 py-1 hover:bg-[#14B8A6] hover:text-white">📞 Llamar {c.recall_phone}</a>}
              <select value={c.status} onChange={(e) => setStatus(c.id, e.target.value)} className="text-[10px] border-2 border-black px-2 py-1 bg-white">
                <option value="nueva">nueva</option><option value="contactado">contactado</option><option value="resuelta">resuelta</option><option value="descartada">descartada</option>
              </select>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  );
}
