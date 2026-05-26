"use client";
import { useEffect, useState } from "react";

type Colab = { id: string; cuenta_sugerida: string; tipo_cuenta: string; por_que: string; propuesta_colab: string; beneficio_estimado: string | null; status: string; created_at: string };

export default function MartaColaboraciones() {
  const [items, setItems] = useState<Colab[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/marta/colaboraciones");
    const j = await r.json();
    setItems(j.items || []);
  }
  useEffect(() => { load(); }, []);

  async function generar() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/marta/colaboraciones", { method: "POST" });
      const j = await r.json();
      if (!r.ok) alert(j.error || "Error");
      else load();
    } finally { setBusy(false); }
  }

  async function setStatus(id: string, status: "contactada" | "aceptada" | "descartada") {
    await fetch("/api/marta/colaboraciones", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    load();
  }

  async function copy(c: Colab) {
    await navigator.clipboard.writeText(c.propuesta_colab).catch(() => {});
    alert("✓ Propuesta copiada");
  }

  return (
    <div className="card-hard p-5 bg-white border-[#FF7A59]">
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <h3 className="font-stencil text-2xl">🤝 Sugerencias de colaboraciones</h3>
        <button onClick={generar} disabled={busy} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Buscando…" : "🔍 Generar 5 sugerencias"}</button>
      </div>
      <p className="text-xs text-black/60 mb-3">Marta sugiere tipos de cuentas afines de tu zona para co-marketing + propuesta lista para DM.</p>

      {items.length === 0 ? (
        <p className="text-sm text-black/50 text-center py-4">Sin sugerencias aún. Genera el primer lote ☝️</p>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <div key={c.id} className={`border-2 bg-white p-3 ${c.status === "aceptada" ? "border-[#14B8A6]" : c.status === "descartada" ? "border-black/20 opacity-60" : "border-black"}`}>
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{c.cuenta_sugerida}</span>
                  <span className="text-[10px] font-mono uppercase border border-black/40 px-2 py-0.5">{c.tipo_cuenta}</span>
                  {c.status !== "pending" && <span className="text-[10px] font-bold uppercase bg-black text-[color:var(--mustard)] px-2 py-0.5">{c.status}</span>}
                </div>
                <span className="text-[10px] text-black/40">{new Date(c.created_at).toLocaleDateString("es-ES")}</span>
              </div>
              <p className="text-sm mb-2"><b className="text-[10px] uppercase font-mono text-black/60">Por qué:</b> {c.por_que}</p>
              <div className="border-l-4 border-[#FF7A59] pl-3 mb-2">
                <div className="text-[10px] font-mono uppercase text-black/60 mb-1">Propuesta DM</div>
                <p className="text-sm whitespace-pre-wrap">{c.propuesta_colab}</p>
              </div>
              {c.beneficio_estimado && <p className="text-xs text-black/60 mb-2">💎 {c.beneficio_estimado}</p>}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => copy(c)} className="text-[10px] font-bold uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-[color:var(--mustard)]">📋 Copiar DM</button>
                <button onClick={() => setStatus(c.id, "contactada")} className="text-[10px] font-bold uppercase border-2 border-black/40 px-2 py-1 hover:bg-black/10">📤 Contactada</button>
                <button onClick={() => setStatus(c.id, "aceptada")} className="text-[10px] font-bold uppercase border-2 border-[#14B8A6] text-[#14B8A6] px-2 py-1 hover:bg-[#14B8A6] hover:text-white">✓ Aceptada</button>
                <button onClick={() => setStatus(c.id, "descartada")} className="text-[10px] font-bold uppercase border-2 border-black/30 text-black/60 px-2 py-1 hover:bg-black/10">Descartar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
