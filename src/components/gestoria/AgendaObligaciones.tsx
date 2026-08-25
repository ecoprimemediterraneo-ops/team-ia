"use client";

// LA AGENDA DE UN GESTOR.
//
// Aquí había una agenda de peluquería: rejilla de horas, huecos libres, "nueva
// cita", empleados por columna. Un gestor no recibe a nadie a las 10:30. Lo que
// un gestor tiene son fechas límite legales, y lo que le cuesta dinero —de
// verdad, en euros de sanción— es que se le pase una.
//
// LA LISTA ES LA PANTALLA. No hay calendario, ni mes, ni semana: hay una
// columna ordenada por lo que vence antes. Un calendario obliga a buscar; una
// lista ordenada te dice qué toca sin que preguntes.
//
// EL COLOR TIENE QUE SIGNIFICAR ALGO: rojo lo que vence en tres días o menos y
// lo ya vencido, ámbar esta semana, y el resto en blanco. Si todo fuera rojo,
// el rojo dejaría de mirarse.

import { useEffect, useState } from "react";

type Apremio = "vencido" | "rojo" | "ambar" | "normal" | "sin_fecha";

type Linea = {
  id: string;
  titulo: string;
  detalle?: string;
  clienteId: string | null;
  clienteNombre: string | null;
  vence: string | null;
  etiqueta: string;
  apremio: Apremio;
  dias: number | null;
  critico?: boolean;
  motivo?: string;
  correoId?: string;
  sinCliente?: boolean;
  hecho?: boolean;
};

type Grupo = {
  id: string;
  titulo: string;
  etiqueta: string;
  vence: string | null;
  dias: number | null;
  apremio: Apremio;
  critico: boolean;
  lineas: Linea[];
};

type Fila = { tipo: "linea"; linea: Linea } | { tipo: "grupo"; grupo: Grupo };

type Resumen = {
  total: number; vencidas: number; rojas: number; ambar: number;
  sinFecha: number; criticas: number; sinCliente: number;
};

/** El fondo de la línea. El color dice cuánto aprieta, no de qué va. */
const FONDO: Record<Apremio, string> = {
  vencido: "bg-[color:var(--red)] text-white",
  rojo: "bg-[color:var(--red)] text-white",
  ambar: "bg-[color:var(--mustard)] text-black",
  normal: "bg-white text-black",
  sin_fecha: "bg-white text-black",
};

const fechaCorta = (f: string | null) => {
  if (!f) return "sin fecha";
  const d = new Date(`${f}T12:00:00Z`);
  return isNaN(d.getTime()) ? f : d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
};

/** "vence hoy" · "quedan 3 días" · "venció hace 2 días". En cristiano. */
function cuantoQueda(dias: number | null): string {
  if (dias === null) return "sin fecha límite — míralo";
  if (dias === 0) return "vence HOY";
  if (dias === 1) return "vence MAÑANA";
  if (dias < 0) return `venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "día" : "días"}`;
  return `quedan ${dias} días`;
}

export default function AgendaObligaciones() {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  /** Qué grupos ha abierto el gestor. Cerrados de partida: la gracia es no verlos. */
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string }>>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [verHechas, setVerHechas] = useState(false);
  const [tocando, setTocando] = useState<string | null>(null);

  async function traer(hechas: boolean) {
    const res = await fetch(`/api/gestoria/agenda${hechas ? "?hechas=1" : ""}`).catch(() => null);
    const j = res ? await res.json().catch(() => null) : null;
    if (j?.ok) { setLineas(j.lineas); setFilas(j.filas ?? []); setClientes(j.clientes); setResumen(j.resumen); }
    setCargando(false);
  }

  useEffect(() => {
    let vivo = true;
    (async () => {
      const res = await fetch(`/api/gestoria/agenda${verHechas ? "?hechas=1" : ""}`).catch(() => null);
      const j = res ? await res.json().catch(() => null) : null;
      if (!vivo) return;
      if (j?.ok) { setLineas(j.lineas); setFilas(j.filas ?? []); setClientes(j.clientes); setResumen(j.resumen); }
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, [verHechas]);

  async function marcar(l: Linea, hecho: boolean) {
    setTocando(l.id);
    // Se quita de la lista al momento y se confirma después: esperar a la red
    // para tachar una línea hace que parezca que el clic no ha ido.
    setLineas((xs) => (hecho && !verHechas ? xs.filter((x) => x.id !== l.id) : xs.map((x) => (x.id === l.id ? { ...x, hecho } : x))));
    await fetch("/api/gestoria/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: l.id, hecho }),
    }).catch(() => {});
    await traer(verHechas);
    setTocando(null);
  }

  async function asignar(l: Linea, clienteId: string) {
    if (!clienteId) return;
    setTocando(l.id);
    await fetch("/api/gestoria/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asignar: { id: l.id, clienteId } }),
    }).catch(() => {});
    await traer(verHechas);
    setTocando(null);
  }

  /** Abre o cierra un grupo. */
  function alternar(id: string) {
    setAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  /**
   * Una línea de la lista. Vale suelta y vale dentro de un grupo desplegado.
   *
   * Dentro del grupo va sin fondo de color: el color ya lo lleva la cabecera y
   * repetirlo ochenta y siete veces convertiría el despliegue en una pared roja.
   */
  /**
   * Una fila de la lista. Vale suelta y vale dentro de un grupo desplegado.
   *
   * Dentro del grupo va SIN fondo de color: el color ya lo lleva la cabecera del
   * grupo, y repetirlo ochenta y siete veces convertiría el despliegue en una
   * pared roja donde no se distingue nada.
   */
  function LineaFila({ l, dentroDeGrupo }: { l: Linea; dentroDeGrupo?: boolean }) {
    return (
      <div
        className={`p-2 flex items-start gap-3 flex-wrap ${
          dentroDeGrupo ? "bg-white" : `border-2 border-black ${l.hecho ? "bg-white opacity-50" : FONDO[l.apremio]}`
        } ${dentroDeGrupo && l.hecho ? "opacity-50" : ""}`}
      >
        <input
          type="checkbox"
          checked={!!l.hecho}
          disabled={tocando === l.id}
          onChange={(e) => marcar(l, e.target.checked)}
          title="Marcar como hecho"
          className="mt-0.5 w-5 h-5 shrink-0 accent-black"
        />

        <div className="flex-1 min-w-[12rem]">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Dentro de un grupo la etiqueta y el título ya los dice la
                cabecera: aquí lo que importa es DE QUIÉN es. */}
            {!dentroDeGrupo && (
              <>
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest border-2 border-current px-1.5 py-0.5">
                  {l.etiqueta}
                </span>
                {l.critico && (
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest bg-black text-white px-1.5 py-0.5">
                    CRÍTICO
                  </span>
                )}
              </>
            )}
            <span className={`font-bold text-sm ${l.hecho ? "line-through" : ""}`}>
              {dentroDeGrupo ? l.clienteNombre ?? "sin cliente" : l.titulo}
            </span>
          </div>

          {!dentroDeGrupo && (
            <div className="text-[11px] font-mono mt-0.5 opacity-80">
              {l.clienteNombre ?? "sin cliente"}
              {l.detalle ? ` · ${l.detalle}` : ""}
            </div>
          )}

          {/* De dónde salió. Un vencimiento que aparece solo sin decir de dónde
              viene no se cree, y hace bien en no creerse. */}
          {l.motivo && <div className="text-[10px] font-mono mt-0.5 opacity-60">{l.motivo}</div>}

          {/* Sin dueño: se dice de quién es AQUÍ, sin salir de la agenda. */}
          {l.sinCliente && !l.hecho && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <span className="text-[10px] font-mono font-bold">¿De qué cliente es?</span>
              <select
                defaultValue=""
                disabled={tocando === l.id}
                onChange={(e) => asignar(l, e.target.value)}
                className="border-2 border-black px-1 py-0.5 text-[11px] bg-white text-black"
              >
                <option value="">— elige —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Dentro del grupo la fecha es la misma para todos: no se repite. */}
        {!dentroDeGrupo && (
          <div className="text-right shrink-0">
            <div className="font-mono text-xs font-bold">{fechaCorta(l.vence)}</div>
            <div className="text-[11px] font-mono opacity-80">{cuantoQueda(l.dias)}</div>
          </div>
        )}
      </div>
    );
  }


  if (cargando) return <p className="text-sm text-black/60">Cargando la agenda…</p>;

  return (
    <div className="space-y-3">
      {/* EL TITULAR. Lo primero es cuánto aprieta, no cuántas cosas hay. */}
      {resumen && (
        <div className="card-hard bg-white p-3 flex items-center gap-2 flex-wrap text-sm">
          <span className="font-stencil text-2xl leading-none">{resumen.total}</span>
          <span className="text-black/60">pendiente{resumen.total === 1 ? "" : "s"}</span>
          {resumen.vencidas > 0 && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-[color:var(--red)] text-white border-2 border-black px-1.5 py-0.5">
              {resumen.vencidas} ya vencida{resumen.vencidas === 1 ? "" : "s"}
            </span>
          )}
          {resumen.rojas > 0 && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-[color:var(--red)] text-white border-2 border-black px-1.5 py-0.5">
              {resumen.rojas} en 3 días o menos
            </span>
          )}
          {resumen.ambar > 0 && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-[color:var(--mustard)] border-2 border-black px-1.5 py-0.5">
              {resumen.ambar} esta semana
            </span>
          )}
          {resumen.sinFecha > 0 && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest border-2 border-black px-1.5 py-0.5">
              {resumen.sinFecha} sin fecha
            </span>
          )}
          <label className="ml-auto flex items-center gap-1 text-[11px] font-mono text-black/60">
            <input type="checkbox" checked={verHechas} onChange={(e) => setVerHechas(e.target.checked)} />
            ver lo ya hecho
          </label>
        </div>
      )}

      {lineas.length === 0 ? (
        <div className="card-hard bg-white p-6 text-sm text-black/60">
          No hay nada pendiente con fecha límite.{" "}
          <a href="/dashboard/expedientes" className="underline">
            Marca qué modelos presenta cada cliente
          </a>{" "}
          y sus vencimientos del trimestre aparecerán aquí solas.
        </div>
      ) : (
        <div className="space-y-1.5">
          {filas.map((f) =>
            f.tipo === "linea" ? (
              <LineaFila key={f.linea.id} l={f.linea} />
            ) : (
              <div key={f.grupo.id} className="border-2 border-black">
                {/* LA CABECERA DEL GRUPO. Una línea por lo que se repite:
                    "Modelo 303 · 87 clientes · vence el lunes 20 de octubre".
                    No es menos información, es la misma dicha una vez. */}
                <button
                  type="button"
                  onClick={() => alternar(f.grupo.id)}
                  className={`w-full text-left p-2 flex items-start gap-3 flex-wrap ${FONDO[f.grupo.apremio]}`}
                >
                  <span className="text-lg leading-none mt-0.5 select-none w-4 shrink-0">
                    {abiertos.has(f.grupo.id) ? "▾" : "▸"}
                  </span>
                  <span className="flex-1 min-w-[12rem]">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-mono font-bold uppercase tracking-widest border-2 border-current px-1.5 py-0.5">
                        {f.grupo.etiqueta}
                      </span>
                      {f.grupo.critico && (
                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest bg-black text-white px-1.5 py-0.5">
                          CRÍTICO
                        </span>
                      )}
                      <span className="font-bold text-sm">{f.grupo.titulo}</span>
                      <span className="text-[11px] font-mono opacity-80">
                        · {f.grupo.lineas.length} clientes
                      </span>
                    </span>
                    <span className="block text-[11px] font-mono mt-0.5 opacity-70">
                      {abiertos.has(f.grupo.id) ? "Pulsa para plegar" : "Pulsa para ver los clientes uno a uno"}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block font-mono text-xs font-bold">{fechaCorta(f.grupo.vence)}</span>
                    <span className="block text-[11px] font-mono opacity-80">{cuantoQueda(f.grupo.dias)}</span>
                  </span>
                </button>

                {abiertos.has(f.grupo.id) && (
                  <div className="border-t-2 border-black divide-y divide-black/10 bg-white">
                    {f.grupo.lineas.map((l) => (
                      <LineaFila key={l.id} l={l} dentroDeGrupo />
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      )}

      <p className="text-[11px] text-black/50">
        Esta lista se rellena sola: los modelos salen de lo que tenga marcado cada cliente, los requerimientos
        del correo que vigila Eva, y las facturas que faltan del estado real de tus facturas. Lo que marcas
        hecho aquí queda marcado también en Hoy.
      </p>
    </div>
  );
}
