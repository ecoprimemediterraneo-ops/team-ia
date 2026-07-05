"use client";

// Banner de lista de espera en la agenda del panel. Solo aparece si hay gente
// esperando. Colapsable; permite quitar entradas. Se avisa solo por email al liberarse.
import { useCallback, useEffect, useState } from "react";
import type { EsperaEntry } from "@/lib/booking";

const fechaCorta = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y.slice(2)}`; };

export default function EsperaBanner({ slug }: { slug: string }) {
  const [entries, setEntries] = useState<EsperaEntry[] | null>(null);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/booking/${slug}/espera`, { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setEntries(j.entries);
    } catch { /* */ }
  }, [slug]);
  useEffect(() => { cargar(); }, [cargar]);

  async function quitar(id: string) {
    setEntries((p) => (p ? p.filter((e) => e.id !== id) : p));
    try { await fetch(`/api/booking/${slug}/espera?id=${id}`, { method: "DELETE" }); } catch { /* */ }
  }

  if (!entries || entries.length === 0) return null;

  return (
    <div className="card-hard bg-white mb-4">
      <button onClick={() => setAbierto((a) => !a)} className="w-full flex items-center justify-between p-3">
        <span className="font-bold flex items-center gap-2">🔔 Lista de espera <span className="text-xs bg-[color:var(--mustard)] border-2 border-black px-1.5 py-0.5">{entries.length}</span></span>
        <span className="text-sm text-black/40">{abierto ? "▾ ocultar" : "▸ ver"}</span>
      </button>
      {abierto && (
        <div className="border-t-2 border-black/10 p-3 space-y-2">
          {entries.map((e) => (
            <div key={e.id} className={`flex items-center justify-between gap-2 ${e.estado === "avisado" ? "opacity-60" : ""}`}>
              <div className="min-w-0">
                <div className="font-bold text-sm truncate">{e.cliente.nombre} <span className="font-normal text-black/50">· {e.cliente.telefono}</span></div>
                <div className="text-xs text-black/50 truncate">{[e.servicioNombre, e.varianteNombre].filter(Boolean).join(" · ")}{e.empleadoNombre ? ` · ${e.empleadoNombre}` : ""} · {fechaCorta(e.fecha)}{e.estado === "avisado" ? " · ✓ avisado" : ""}</div>
              </div>
              <button onClick={() => quitar(e.id)} className="text-xs border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-0.5 shrink-0 hover:bg-[color:var(--red)] hover:text-white">Quitar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
