"use client";

// LA PORTADA, SIN EL CHAT: el saludo y el día en tres frases. El chat, el
// selector de cliente, la barra roja y el cuadro de preguntar ya no viven
// aquí — se han ido a `PanelGestoriaShell.tsx`, montado una vez por
// `(gestoria)/layout.tsx` y no por esta página. Esto es solo el panel
// central de la pestaña "Hoy": lo único que cambiaba antes era esto, así
// que es lo único que sigue aquí.

import { useEffect, useState } from "react";

type Resumen = { puntos: string[]; restantes: number; hechoEn: string; conIA: boolean };

/** "miércoles, 20 de agosto de 2026". En pequeño y en gris, como una cabecera. */
function fechaLarga(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  const t = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return t[0].toUpperCase() + t.slice(1);
}

export default function ResumenDelDia({ nombreGestor }: { nombreGestor: string }) {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [hoy, setHoy] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const res = await fetch("/api/gestoria/portada").catch(() => null);
      const j = res ? await res.json().catch(() => null) : null;
      if (!vivo) return;
      if (j?.ok) { setResumen(j.resumen); setHoy(j.hoy); }
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, []);

  return (
    <div>
      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-black/40">
        {hoy ? fechaLarga(hoy) : " "}
      </div>
      <h1 className="font-stencil text-4xl md:text-5xl leading-none mt-1 mb-8">
        {nombreGestor ? `Hola, ${nombreGestor}` : "Hola"}
      </h1>

      {/* EL DÍA, EN PUNTOS. Ni tarjetas, ni números grandes, ni colores: solo
          texto. Un punto por asunto, uno por línea. */}
      {cargando ? (
        <p className="text-lg text-black/30">Mirando cómo está el día…</p>
      ) : !resumen?.puntos?.length ? (
        <p className="text-lg text-black/80">Hoy no hay nada que reclame tu atención.</p>
      ) : (
        <ul className="space-y-2">
          {resumen.puntos.map((p, i) => (
            <li key={i} className="flex gap-2 text-base md:text-lg leading-snug text-black/80">
              <span className="text-black/30 select-none shrink-0">—</span>
              <span>{p}</span>
            </li>
          ))}
          {resumen.restantes > 0 && (
            <li className="text-sm text-black/45 pl-5">
              Y {resumen.restantes} {resumen.restantes === 1 ? "cosa más" : "cosas más"} sin tanta prisa.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
