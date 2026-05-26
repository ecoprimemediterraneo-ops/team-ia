"use client";
import { useEffect, useState } from "react";

type Compromiso = { id: string; compromiso_texto: string; fecha_limite: string | null; destinatario: string | null; status: string; created_at: string; origen_email: string | null };

export default function LuciaCompromisos() {
  const [items, setItems] = useState<Compromiso[]>([]);
  async function load() { const r = await fetch("/api/lucia/compromisos"); const j = await r.json(); setItems(j.items || []); }
  useEffect(() => { load(); }, []);
  async function setStatus(id: string, status: "cumplido" | "descartado" | "vencido") {
    await fetch("/api/lucia/compromisos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", id, status }) });
    load();
  }
  const pendientes = items.filter((c) => c.status === "pendiente");
  return (
    <div className="card-hard p-5 bg-white border-[#F5C518]">
      <h3 className="font-stencil text-2xl mb-2">🎯 Compromisos sueltos</h3>
      <p className="text-xs text-black/60 mb-3">Promesas que hiciste en emails y aún no cumpliste. Marca cuando estén hechos.</p>
      {pendientes.length === 0 ? <p className="text-sm text-black/50 text-center py-3">Sin compromisos pendientes. Lucía los detectará al procesar tu bandeja enviada.</p> : (
        <div className="space-y-2">{pendientes.map((c) => (
          <div key={c.id} className="border-2 border-black bg-white p-2">
            <div className="flex justify-between items-start gap-2 flex-wrap mb-1">
              <div className="text-sm flex-1">
                <p className="font-bold">"{c.compromiso_texto}"</p>
                {c.destinatario && <p className="text-[10px] text-black/60">→ {c.destinatario}</p>}
                {c.fecha_limite && <p className="text-[10px] text-[color:var(--red)] font-bold">Antes del {c.fecha_limite}</p>}
                {c.origen_email && <p className="text-[10px] text-black/40 italic">Origen: {c.origen_email}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setStatus(c.id, "cumplido")} className="text-[10px] font-bold border-2 border-[#14B8A6] text-[#14B8A6] px-2 py-1 hover:bg-[#14B8A6] hover:text-white">✓ Cumplido</button>
                <button onClick={() => setStatus(c.id, "descartado")} className="text-[10px] font-bold border-2 border-black/30 text-black/60 px-2 py-1">✕</button>
              </div>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  );
}
