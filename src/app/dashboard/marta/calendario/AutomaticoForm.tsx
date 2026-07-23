"use client";

// BLOQUE 1 (automático): en UN solo recuadro, la pauta de publicación (cada día
// de la semana con su propia hora) + la generación del mes. Sin "Previsualizar":
// "GENERAR POSTS DEL MES" guarda la pauta y deja los posts programados.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarPautaAction, generarMesAction } from "./actions";
import type { AutoState } from "./types";

type PautaDia = { dow: number; hora: number; minuto: number };

// Semana empezando en Lunes.
const DIAS = [
  { dow: 1, label: "Lunes" }, { dow: 2, label: "Martes" }, { dow: 3, label: "Miércoles" },
  { dow: 4, label: "Jueves" }, { dow: 5, label: "Viernes" }, { dow: 6, label: "Sábado" }, { dow: 0, label: "Domingo" },
];

type Fila = { dow: number; label: string; active: boolean; hora: string };

function hhmm(h: number, m: number) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function AutomaticoForm({
  tenantId,
  dias,
  autoEnabled,
}: {
  tenantId: string;
  dias: PautaDia[];
  autoEnabled: boolean;
}) {
  const router = useRouter();
  const inicial: Fila[] = DIAS.map((d) => {
    const g = dias.find((x) => x.dow === d.dow);
    return { dow: d.dow, label: d.label, active: !!g, hora: g ? hhmm(g.hora, g.minuto) : "10:00" };
  });
  const [filas, setFilas] = useState<Fila[]>(inicial);
  const [total, setTotal] = useState<number>(8);
  const [state, setState] = useState<AutoState>({ ts: 0 });
  const [pending, startTransition] = useTransition();

  function toggle(dow: number) {
    setFilas((f) => f.map((r) => (r.dow === dow ? { ...r, active: !r.active } : r)));
  }
  function setHora(dow: number, hora: string) {
    setFilas((f) => f.map((r) => (r.dow === dow ? { ...r, hora } : r)));
  }

  function pautaActual(): PautaDia[] {
    return filas
      .filter((r) => r.active)
      .map((r) => {
        const m = r.hora.match(/^(\d{1,2}):(\d{2})$/);
        return { dow: r.dow, hora: m ? Math.min(23, +m[1]) : 10, minuto: m ? Math.min(59, +m[2]) : 0 };
      });
  }

  function run(kind: "guardar" | "generar") {
    setState({ ts: 0 });
    startTransition(async () => {
      const pauta = pautaActual();
      const res =
        kind === "guardar"
          ? await guardarPautaAction(tenantId, pauta)
          : await generarMesAction(tenantId, pauta, total);
      setState(res);
      if (res.variant === "ok") router.refresh();
    });
  }

  const activos = filas.filter((r) => r.active).length;

  return (
    <section className="card-hard bg-white p-5 space-y-5">
      <div>
        <h2 className="font-stencil text-2xl uppercase leading-none">
          Pauta de publicación y posts a generar{" "}
          <span className="text-[11px] font-mono lowercase tracking-widest text-black/45 align-middle">(automático)</span>
        </h2>
        <p className="text-[11px] text-black/55 mt-1">
          Marca los días que quieres publicar y pon la hora de cada uno. Marta genera y programa sola.
        </p>
      </div>

      {/* Pauta: un día por fila, con su hora */}
      <div className="space-y-1.5">
        <span className="block text-[11px] font-mono uppercase tracking-widest text-black/50">Días y hora de cada día</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {filas.map((r) => (
            <label key={r.dow} className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={r.active} onChange={() => toggle(r.dow)} className="peer sr-only" />
              <span className="grid place-items-center w-6 h-6 border-2 border-black bg-white peer-checked:bg-black peer-checked:text-[color:var(--mustard)] text-xs font-bold shrink-0">
                {r.active ? "✓" : ""}
              </span>
              <span className={`w-24 text-sm font-bold ${r.active ? "" : "text-black/35"}`}>{r.label}</span>
              <input
                type="time"
                value={r.hora}
                onChange={(e) => setHora(r.dow, e.target.value)}
                disabled={!r.active}
                className="border-2 border-black px-2 py-1 text-sm bg-white disabled:opacity-30 disabled:bg-black/5"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Guardar pauta — justo debajo de los días/horas */}
      <div>
        <button
          type="button"
          onClick={() => run("guardar")}
          disabled={pending || activos === 0}
          className="border-[3px] border-black bg-[color:var(--mustard)] px-4 py-2 text-sm font-bold uppercase tracking-widest hover:brightness-95 disabled:opacity-40"
        >
          Guardar pauta
        </button>
      </div>

      <hr className="border-t-2 border-black/10" />

      {/* Posts a generar (total) */}
      <div>
        <label className="block">
          <span className="block text-[11px] font-mono uppercase tracking-widest text-black/50 mb-1">
            Posts a generar este mes (total)
          </span>
          <input
            type="number"
            min={1}
            max={20}
            value={total}
            onChange={(e) => setTotal(parseInt(e.target.value, 10) || 0)}
            className="border-2 border-black px-2 py-1.5 text-sm bg-white w-28"
          />
        </label>
        <p className="text-[11px] text-black/50 mt-1 max-w-xl leading-relaxed">
          Es el <strong>total del mes</strong>: Marta reparte esos posts entre los días y horas de la pauta, por
          orden de fecha. Si hay menos fechas que ese número, hará una por fecha.
        </p>
      </div>

      {/* Generar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => run("generar")}
          disabled={pending || activos === 0}
          className="border-[3px] border-black bg-black text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-black/80 disabled:opacity-40"
        >
          {pending ? "Generando…" : "Generar posts del mes"}
        </button>
        {!autoEnabled && (
          <span className="text-[11px] text-black/45">
            La publicación automática (n8n) está apagada; generar aquí no publica, solo programa.
          </span>
        )}
      </div>

      {state.ts > 0 && state.mensaje && (
        <p className={`text-xs font-bold ${state.variant === "error" ? "text-[color:var(--red)]" : "text-green-700"}`}>
          {state.mensaje}
        </p>
      )}
    </section>
  );
}
