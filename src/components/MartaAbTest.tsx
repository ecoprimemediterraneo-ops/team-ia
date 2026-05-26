"use client";
import { useEffect, useState } from "react";

type Variant = { letra: "A" | "B" | "C"; hook: string; rationale: string };
type Test = {
  id: string;
  tema: string;
  variantes: Variant[];
  winner_letra: "A" | "B" | "C" | null;
  status: "pending" | "running" | "resolved" | "discarded";
  created_at: string;
};

export default function MartaAbTest() {
  const [tests, setTests] = useState<Test[]>([]);
  const [tema, setTema] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/marta/abtest");
      const j = await r.json();
      setTests(j.tests || []);
    } catch { /* */ }
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    if (!tema.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/marta/abtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tema: tema.trim() }),
      });
      const j = await r.json();
      if (!r.ok) alert(j.error || "Error");
      else { setTema(""); load(); }
    } finally {
      setBusy(false);
    }
  }

  async function resolve(id: string, winner: "A" | "B" | "C") {
    await fetch("/api/marta/abtest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve", id, winner }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("¿Borrar este test?")) return;
    await fetch("/api/marta/abtest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    load();
  }

  async function copyHook(hook: string) {
    await navigator.clipboard.writeText(hook).catch(() => {});
    alert("✓ Hook copiado");
  }

  return (
    <div className="card-hard p-5 bg-white border-[#F5C518]">
      <h3 className="font-stencil text-2xl mb-2">🧪 A/B test de hooks</h3>
      <p className="text-xs text-black/60 mb-4">
        Marta te da 3 versiones distintas del hook (curiosidad / beneficio / emoción). Prueba la A en story, mide 2-4h, marca la ganadora.
      </p>

      <div className="card-hard p-4 bg-[color:var(--cream)] mb-4 space-y-3">
        <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Tema. Ej: 3 errores al cepillarse" className="w-full border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000]" />
        <button onClick={generate} disabled={busy || !tema.trim()} className="btn-mustard text-xs disabled:opacity-50">
          {busy ? "Generando 3 hooks…" : "🧪 Generar 3 hooks (A/B/C)"}
        </button>
      </div>

      {tests.length === 0 ? (
        <p className="text-sm text-black/50">Sin tests todavía. Prueba con un tema arriba.</p>
      ) : (
        <div className="space-y-4">
          {tests.map((t) => (
            <div key={t.id} className="border-2 border-black bg-white p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <span className="font-bold text-sm">{t.tema}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border-2 border-black ${
                    t.status === "resolved" ? "bg-[#14B8A6] text-white" :
                    t.status === "pending" ? "bg-[color:var(--mustard)]" :
                    "bg-black text-white"
                  }`}>{t.status === "resolved" ? `Ganador: ${t.winner_letra}` : t.status}</span>
                  <button onClick={() => remove(t.id)} className="text-[10px] font-bold uppercase tracking-widest border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 hover:bg-[color:var(--red)] hover:text-white">Borrar</button>
                </div>
              </div>
              <div className="space-y-2">
                {t.variantes.map((v) => {
                  const isWinner = t.winner_letra === v.letra;
                  return (
                    <div key={v.letra} className={`border-2 p-3 ${isWinner ? "border-[#14B8A6] bg-[#14B8A6]/10" : "border-black/30 bg-white"}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-stencil text-lg">{v.letra}</span>
                          {isWinner && <span className="text-[10px] font-bold uppercase tracking-widest bg-[#14B8A6] text-white px-2 py-0.5">★ GANADOR</span>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => copyHook(v.hook)} className="text-[10px] font-bold uppercase tracking-widest border-2 border-black px-2 py-1 hover:bg-black hover:text-[color:var(--mustard)]">📋 Copiar</button>
                          {t.status === "pending" && (
                            <button onClick={() => resolve(t.id, v.letra)} className="text-[10px] font-bold uppercase tracking-widest border-2 border-[#14B8A6] text-[#14B8A6] px-2 py-1 hover:bg-[#14B8A6] hover:text-white">Marcar ganador</button>
                          )}
                        </div>
                      </div>
                      <p className="font-bold text-sm mb-1">{v.hook}</p>
                      <p className="text-[11px] italic text-black/60">💡 {v.rationale}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
