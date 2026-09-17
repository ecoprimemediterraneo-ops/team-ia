"use client";

// Botones de "marcar avisado" / "programar" en la fila de una revisión. Mismo
// motor que el chat (`/api/dental/revisiones` → `dental-acciones.ts` por
// debajo), para que hacerlo desde aquí o hablando con el chat sea lo mismo.

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RevisionAcciones({
  clave,
  programadaPara,
}: {
  clave: string;
  /** Si ya hay una programación puesta, su fecha (AAAA-MM-DD). */
  programadaPara?: string;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [mostrarFecha, setMostrarFecha] = useState(false);
  const [fecha, setFecha] = useState("");

  async function marcarAvisado() {
    setGuardando(true);
    try {
      await fetch("/api/dental/revisiones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave, modo: "enviado" }),
      });
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  async function programar() {
    if (!fecha) return;
    setGuardando(true);
    try {
      await fetch("/api/dental/revisiones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave, modo: "programado", fecha }),
      });
      setMostrarFecha(false);
      setFecha("");
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  async function quitarProgramacion() {
    setGuardando(true);
    try {
      await fetch("/api/dental/revisiones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave, modo: "quitar_programacion" }),
      });
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  if (programadaPara) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-mono uppercase tracking-widest border-2 border-black bg-[color:var(--mustard)] px-1.5 py-0.5">
          programado {new Date(`${programadaPara}T12:00:00Z`).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
        </span>
        <button
          type="button"
          onClick={quitarProgramacion}
          disabled={guardando}
          className="text-[10px] font-mono uppercase tracking-widest text-black/40 hover:text-black hover:underline disabled:opacity-50"
        >
          quitar
        </button>
      </div>
    );
  }

  if (mostrarFecha) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border-2 border-black px-1 py-0.5 text-[11px]"
        />
        <button
          type="button"
          onClick={programar}
          disabled={guardando || !fecha}
          className="border-2 border-black px-1.5 py-0.5 text-[10px] font-bold uppercase hover:bg-[color:var(--mustard)] disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        onClick={marcarAvisado}
        disabled={guardando}
        className="border-2 border-black px-1.5 py-0.5 text-[10px] font-bold uppercase hover:bg-green-200 disabled:opacity-50"
      >
        Marcar avisado
      </button>
      <button
        type="button"
        onClick={() => setMostrarFecha(true)}
        disabled={guardando}
        className="border-2 border-black px-1.5 py-0.5 text-[10px] font-bold uppercase hover:bg-[color:var(--mustard)] disabled:opacity-50"
      >
        Programar
      </button>
    </div>
  );
}
