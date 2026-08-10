"use client";

// Botón de marcar / desmarcar spam en la tabla de diagnósticos.
//
// Marcar NO borra: deja la bandera y el registro entero sigue ahí. Es
// reversible a propósito, porque el criterio automático se equivoca y un
// cliente real marcado por error tiene que poder recuperarse. El borrado de
// verdad va aparte, por `DELETE /api/admin/diagnosticos?id=`.

import { useState } from "react";

export default function MarcarSpam({ id, spam }: { id: string; spam: boolean }) {
  const [marcado, setMarcado] = useState(spam);
  const [ocupado, setOcupado] = useState(false);

  async function alternar() {
    setOcupado(true);
    try {
      const res = await fetch("/api/admin/diagnosticos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, spam: !marcado }),
      });
      if (res.ok) setMarcado((v) => !v);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={ocupado}
      className="ml-2 border-2 border-black px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-widest hover:bg-black hover:text-white disabled:opacity-50"
      title={marcado ? "Devolverlo a la lista buena" : "Marcarlo como spam"}
    >
      {ocupado ? "…" : marcado ? "no es spam" : "spam"}
    </button>
  );
}
