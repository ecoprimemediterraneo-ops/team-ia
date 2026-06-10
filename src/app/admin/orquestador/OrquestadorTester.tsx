"use client";

import { useState } from "react";

type TestResult = {
  ok: boolean;
  startIso?: string;
  disparadas?: number;
  confirmadas?: number;
  rechazadas?: number;
  detalle?: { agente: string; estado: string }[];
};

export default function OrquestadorTester() {
  const [startIso, setStartIso] = useState("2026-06-20T10:00:00");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<TestResult | null>(null);

  async function fire() {
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch("/api/admin/orquestador/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fire",
          startIso,
          nombre: "Cliente de prueba",
          motivo: "Limpieza dental",
          agentes: ["pablo", "carmen", "eva"],
        }),
      });
      setRes(await r.json());
    } catch (e) {
      setRes({ ok: false, detalle: [{ agente: "—", estado: e instanceof Error ? e.message : "error" }] });
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    await fetch("/api/admin/orquestador/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    setRes(null);
  }

  return (
    <div className="card-hard bg-white p-4 space-y-3">
      <div className="font-stencil text-xl">Banco de pruebas (simulación)</div>
      <p className="text-sm text-black/60">
        Dispara 3 agentes (Pablo, Carmen, Eva) pidiendo <strong>el mismo hueco a la vez</strong>.
        El orquestador debe dejar pasar <strong>solo 1</strong>; los otros 2 se rechazan por conflicto.
        Modo simulación: no toca Google Calendar.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={startIso}
          onChange={(e) => setStartIso(e.target.value)}
          className="border-2 border-black px-2 py-1 text-sm font-mono flex-1 min-w-[220px]"
          placeholder="2026-06-20T10:00:00"
        />
        <button
          onClick={fire}
          disabled={loading}
          className="text-xs uppercase tracking-widest font-bold border-2 border-black px-3 py-1.5 bg-black text-white disabled:opacity-50"
        >
          {loading ? "Disparando…" : "Disparar 3 agentes"}
        </button>
        <button
          onClick={reset}
          className="text-xs uppercase tracking-widest font-bold border-2 border-black px-3 py-1.5 bg-white hover:bg-[color:var(--mustard)]/40"
        >
          Reset
        </button>
      </div>

      {res && res.ok && (
        <div className="border-2 border-black/15 p-3 text-sm">
          <div className="font-bold mb-1">
            {res.confirmadas === 1 ? "✅" : "⚠️"} {res.confirmadas}/{res.disparadas} confirmadas · {res.rechazadas} rechazadas
          </div>
          <ul className="space-y-0.5">
            {res.detalle?.map((d) => (
              <li key={d.agente} className="flex gap-2">
                <span className="font-mono w-16">{d.agente}</span>
                <span className={d.estado === "booked" ? "text-green-700 font-bold" : "text-black/60"}>
                  {d.estado === "booked" ? "RESERVADA" : d.estado === "slot_taken" ? "rechazada (conflicto)" : d.estado === "locked" ? "bloqueada (lock)" : d.estado}
                </span>
              </li>
            ))}
          </ul>
          <div className="text-[11px] text-black/50 mt-2">
            Recarga la página para ver estas decisiones en el log de abajo.
          </div>
        </div>
      )}
      {res && !res.ok && (
        <div className="border-2 border-red-700 bg-red-50 p-3 text-sm text-red-800">
          Error: {res.detalle?.[0]?.estado}
        </div>
      )}
    </div>
  );
}
