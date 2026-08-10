"use client";

// El servicio de HOY, que es la pantalla que un restaurante mira de verdad.
//
// No es la agenda: la agenda sirve para colocar citas a lo largo de la semana y
// aquí lo que hace falta es una lista corta, por hora, que se lea de un vistazo
// desde el móvil mientras suena el teléfono. Por eso: hora, personas, zona,
// estado, y si es de la casa.
//
// El botón COPIAR es la pieza del modo CAPTACIÓN: entre el 60 y el 70 % de estos
// restaurantes ya pagan otro software de reservas y no lo van a tirar. AI-Team
// recoge la reserva y el dueño la pega allí de un toque. Nada de integraciones
// con terceros.

import { useEffect, useState } from "react";
import type { EstadoCita } from "@/lib/booking";
import { ZONA_LABEL, type ZonaMesa } from "@/lib/restaurante";

export type LineaDia = {
  id: string;
  hora: string;
  nombre: string;
  telefono: string;
  comensales: number;
  zona: ZonaMesa;
  estado: EstadoCita;
  nota?: string;
  copiar: string;
  /** Ficha del que vuelve. Ausente = primera vez. */
  habitual?: { visitas: number; ultimaVisita?: string; zonaHabitual?: ZonaMesa; noShows: number };
};

const ESTADO_LABEL: Record<EstadoCita, string> = {
  pendiente: "PENDIENTE",
  confirmada: "CONFIRMADA",
  completada: "SENTADA",
  cancelada: "CANCELADA",
  no_show: "NO SHOW",
};

const ESTADO_CLASE: Record<EstadoCita, string> = {
  pendiente: "bg-[color:var(--mustard)] text-black",
  confirmada: "bg-green-700 text-white",
  completada: "bg-black text-white",
  cancelada: "bg-black/30 text-white",
  no_show: "bg-[color:var(--red)] text-white",
};

function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  // El "✓ Copiado" se va solo a los 2 s. Sin esto, con veinte reservas acabas
  // con veinte botones diciendo que están copiados y ninguno lo está.
  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      // Safari sin permiso de portapapeles: se cae al método de siempre.
      const ta = document.createElement("textarea");
      ta.value = texto;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopiado(true); } catch { /* ni así */ }
      document.body.removeChild(ta);
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title={texto}
      className="shrink-0 text-[10px] font-mono uppercase tracking-widest border-2 border-black px-2 py-1 hover:bg-black hover:text-white"
    >
      {copiado ? "✓ Copiado" : "Copiar"}
    </button>
  );
}

export default function PanelDelDia({
  fecha,
  lineas,
  modo,
}: {
  fecha: string;
  lineas: LineaDia[];
  modo: "captacion" | "gestion";
}) {
  const total = lineas.length;
  const personas = lineas.reduce((s, l) => s + l.comensales, 0);
  const pendientes = lineas.filter((l) => l.estado === "pendiente").length;
  const noShows = lineas.filter((l) => l.estado === "no_show").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card-hard bg-white p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-black/50">Reservas</div>
          <div className="font-stencil text-3xl leading-none mt-1">{total}</div>
        </div>
        <div className="card-hard bg-white p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-black/50">Comensales</div>
          <div className="font-stencil text-3xl leading-none mt-1">{personas}</div>
        </div>
        <div className="card-hard bg-[color:var(--mustard)] p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest">Por confirmar</div>
          <div className="font-stencil text-3xl leading-none mt-1">{pendientes}</div>
        </div>
        <div className="card-hard bg-white p-3">
          {/* Al final del servicio esto es lo que se mira. */}
          <div className="text-[10px] font-mono uppercase tracking-widest text-black/50">No aparecieron</div>
          <div className="font-stencil text-3xl leading-none mt-1">{noShows}</div>
        </div>
      </div>

      {modo === "captacion" && (
        <div className="card-hard bg-white p-3 text-xs">
          <b>Modo captación.</b> AI-Team recoge las reservas y tú las pasas a tu software de siempre:
          cada línea tiene un botón <b>Copiar</b> con los datos ya formateados.
        </div>
      )}

      {total === 0 ? (
        <div className="card-hard bg-white p-6 text-sm text-black/60">
          No hay reservas para el {fecha}. Las que entren por WhatsApp, Instagram o teléfono aparecerán aquí.
        </div>
      ) : (
        <div className="space-y-2">
          {lineas.map((l) => (
            <div key={l.id} className="card-hard bg-white p-3 flex items-center gap-3 flex-wrap">
              <div className="font-stencil text-2xl leading-none w-14 shrink-0">{l.hora}</div>

              <div className="flex-1 min-w-[9rem]">
                <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
                  {l.nombre || "Sin nombre"}
                  {l.habitual && (
                    <span
                      className="text-[10px] font-mono uppercase tracking-widest border-2 border-black px-1"
                      title={`${l.habitual.visitas} visitas${l.habitual.ultimaVisita ? ` · última ${l.habitual.ultimaVisita}` : ""}`}
                    >
                      ★ habitual
                    </span>
                  )}
                  {/* Un no-show previo es justo lo que quieres saber antes de guardar la mesa del viernes. */}
                  {l.habitual && l.habitual.noShows > 0 && (
                    <span className="text-[10px] font-mono uppercase tracking-widest bg-[color:var(--red)] text-white px-1">
                      {l.habitual.noShows} no-show
                    </span>
                  )}
                </div>
                <div className="text-xs text-black/60 font-mono">
                  {l.comensales || "?"} personas · {ZONA_LABEL[l.zona]}
                  {l.telefono ? ` · ${l.telefono}` : ""}
                </div>
                {l.nota && <div className="text-xs text-black/60 mt-0.5">{l.nota}</div>}
              </div>

              <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 ${ESTADO_CLASE[l.estado]}`}>
                {ESTADO_LABEL[l.estado]}
              </span>
              <BotonCopiar texto={l.copiar} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
