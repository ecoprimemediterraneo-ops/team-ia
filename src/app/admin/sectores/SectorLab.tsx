"use client";

// Banco de pruebas: un mensaje, cuatro respuestas de Pablo, una por sector.
// Sirve para ver de un vistazo si el perfil de sector está haciendo su trabajo.

import { useState } from "react";

type Resultado = {
  sector: string;
  label: string;
  negocio: string;
  respuesta: string;
  error?: string;
};

const EJEMPLOS = [
  "Hola, ¿cuánto cuesta?",
  "Buenas, tengo un dolor horrible desde anoche",
  "Quería pedir cita para el jueves por la tarde",
  "Me han despedido y no sé qué hacer, ¿me podéis ayudar?",
];

export default function SectorLab({ hayDemos }: { hayDemos: boolean }) {
  const [mensaje, setMensaje] = useState(EJEMPLOS[0]);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function probar() {
    if (!mensaje.trim()) return;
    setCargando(true);
    setError(null);
    setResultados(null);
    try {
      const r = await fetch("/api/admin/sector-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error");
      setResultados(j.resultados);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card-hard bg-white p-4">
        <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">
          Mensaje que llega por WhatsApp
        </label>
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          rows={2}
          className="w-full border-2 border-black p-2 text-sm"
          placeholder="Escribe lo que escribiría un cliente…"
        />
        <div className="flex flex-wrap gap-2 mt-2">
          {EJEMPLOS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setMensaje(e)}
              className="text-[11px] border-2 border-black/30 px-2 py-1 hover:bg-[color:var(--mustard)]/40"
            >
              {e}
            </button>
          ))}
        </div>
        <button onClick={probar} disabled={cargando || !hayDemos} className="btn-mustard text-sm mt-3">
          {cargando ? "PREGUNTANDO A LOS CUATRO…" : "▶ COMPARAR LOS 4 SECTORES"}
        </button>
        {!hayDemos && (
          <p className="text-xs text-[color:var(--red)] mt-2">
            Antes hay que crear los negocios de ejemplo (botón de arriba).
          </p>
        )}
        {error && <p className="text-xs text-[color:var(--red)] mt-2">{error}</p>}
      </div>

      {resultados && (
        <div className="grid md:grid-cols-2 gap-4">
          {resultados.map((r) => (
            <div key={r.sector} className="card-hard bg-white p-4">
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <span className="font-stencil text-lg">{r.label}</span>
                <span className="text-[11px] font-mono text-black/50">{r.negocio}</span>
              </div>
              {r.error ? (
                <p className="text-sm text-[color:var(--red)]">{r.error}</p>
              ) : (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.respuesta}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
