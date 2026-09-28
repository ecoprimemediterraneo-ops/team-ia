"use client";

// LISTA DE ESPERA — quién espera un hueco, para qué servicio y qué día. El motor
// de reservas ya la guardaba (`crearEspera`, y avisa sola cuando se libera un
// hueco); esto le da pantalla propia. Aquí se ve, se ordena por día y se quita
// a quien ya no espera. Apuntar a alguien nuevo se hace desde el chat ("apunta a
// Lucía en la lista de espera para un color el viernes") o desde la web pública.

import { useState } from "react";
import { useRouter } from "next/navigation";

export type FilaEspera = {
  id: string; nombre: string; telefono: string; servicio: string; profesional?: string;
  fecha: string; horaPedida?: string; estado: "esperando" | "avisado";
  /** Ya hay hueco libre ese día para lo que pide: es dinero que se está perdiendo. */
  hayHueco: boolean;
};

const fechaLarga = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

export default function ListaEsperaSalon({ slug, filas }: { slug: string; filas: FilaEspera[] }) {
  const router = useRouter();
  const [quitando, setQuitando] = useState<string | null>(null);

  async function quitar(id: string) {
    if (quitando) return;
    setQuitando(id);
    try {
      await fetch(`/api/booking/${slug}/espera?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      router.refresh();
    } finally { setQuitando(null); }
  }

  if (filas.length === 0) {
    return (
      <div className="card-hard bg-white p-6 text-sm text-black/70">
        Nadie está esperando un hueco. Cuando una clienta pida un día completo, se apunta aquí sola desde la web de reservas, o puedes apuntarla desde el chat.
      </div>
    );
  }

  const porDia = new Map<string, FilaEspera[]>();
  for (const f of filas) porDia.set(f.fecha, [...(porDia.get(f.fecha) ?? []), f]);
  const dias = [...porDia.keys()].sort();

  return (
    <div className="space-y-4">
      {dias.map((dia) => (
        <div key={dia}>
          <h2 className="font-stencil text-xl mb-2 capitalize">{fechaLarga(dia)}</h2>
          <div className="space-y-2">
            {porDia.get(dia)!.map((f) => (
              <div key={f.id} className={`card-hard bg-white p-3 flex items-center gap-3 flex-wrap ${f.estado === "avisado" ? "opacity-60" : ""}`}>
                <div className="flex-1 min-w-[12rem]">
                  <div className="font-bold text-sm">{f.nombre} <span className="font-normal text-black/50 font-mono text-xs">· {f.telefono}</span></div>
                  <div className="text-xs text-black/60">
                    {f.servicio}{f.profesional ? ` con ${f.profesional}` : ""}{f.horaPedida ? ` · le iría a las ${f.horaPedida}` : ""}
                  </div>
                </div>
                {f.estado === "avisado" ? (
                  <span className="text-[10px] font-mono uppercase tracking-widest border-2 border-black/30 px-2 py-1">✓ avisada</span>
                ) : f.hayHueco ? (
                  <a href="/dashboard/agenda-salon" className="text-[10px] font-mono uppercase tracking-widest bg-[color:var(--mustard)] border-2 border-black px-2 py-1 hover:bg-black hover:text-white">
                    Ya hay hueco →
                  </a>
                ) : (
                  <span className="text-[10px] font-mono uppercase tracking-widest text-black/40">sin hueco aún</span>
                )}
                <button type="button" onClick={() => quitar(f.id)} disabled={quitando !== null}
                  className="text-[10px] font-mono uppercase tracking-widest border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 hover:bg-[color:var(--red)] hover:text-white disabled:opacity-50">
                  {quitando === f.id ? "…" : "Quitar"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
