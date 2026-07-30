"use client";

// Cambiar de sector desde Perfil.
//
// Está detrás de un desplegable y con confirmación a propósito: cambiar de
// sector reordena el panel entero, cambia los números de arriba y cambia lo que
// tus agentes pueden y no pueden decir. No es una casilla que se toque sin
// querer. Lo que NO se pierde son los servicios ni el horario del cliente.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SECTORES_LISTA, type SectorNegocio } from "@/lib/sectores";

export default function CambiarSector({ actual }: { actual: SectorNegocio | null }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState<SectorNegocio | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    if (!elegido) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch("/api/perfil/sector-negocio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector: elegido }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "No se pudo cambiar");
      setAbierto(false);
      setElegido(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs font-mono underline text-black/60 hover:text-black"
      >
        Mi negocio no es de este tipo — cambiar sector
      </button>
    );
  }

  return (
    <div className="border-2 border-black p-3 mt-2">
      <div className="text-xs font-mono uppercase tracking-widest text-black/50 mb-2">Cambiar de sector</div>
      <div className="space-y-2">
        {SECTORES_LISTA.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setElegido(p.id)}
            className={`w-full text-left border-2 p-2 text-sm ${
              elegido === p.id ? "border-black bg-[color:var(--mustard)]/40" : "border-black/25 hover:border-black"
            } ${p.id === actual ? "opacity-50" : ""}`}
            disabled={p.id === actual}
          >
            <span className="font-bold">{p.label}</span>
            {p.id === actual && <span className="text-xs font-mono ml-2">(el actual)</span>}
            <div className="text-xs text-black/60">{p.alta.paraQuien}</div>
          </button>
        ))}
      </div>

      {elegido && (
        <p className="text-xs text-black/70 mt-3 leading-snug">
          Va a cambiar: los agentes que ves y su orden, los números de arriba del panel, cómo se
          llaman las cosas y lo que tus agentes pueden decir. <b>No</b> se tocan tus servicios ni tu
          horario.
        </p>
      )}
      {error && <p className="text-xs text-[color:var(--red)] mt-2">{error}</p>}

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={confirmar}
          disabled={!elegido || guardando}
          className="btn-mustard text-xs px-3 py-2 disabled:opacity-40"
        >
          {guardando ? "CAMBIANDO…" : "Confirmar cambio"}
        </button>
        <button
          type="button"
          onClick={() => { setAbierto(false); setElegido(null); setError(null); }}
          className="text-xs font-mono border-2 border-black px-3 py-2"
        >Cancelar</button>
      </div>
    </div>
  );
}
