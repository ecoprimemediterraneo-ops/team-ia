"use client";

// Agenda del panel del negocio (Biz) — estilo Booksy.
// Vista día/semana, máquina de estados (confirmar/completar/no-show/cancelar),
// citas manuales (walk-in/teléfono) y bloqueos de tiempo. Lee y escribe en el
// MISMO calendario que el flujo público (sin dobles reservas).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BookingService, BookingRecord, EstadoCita, Empleado } from "@/lib/booking";
import EsperaBanner from "./EsperaBanner";

type Props = { slug: string; nombre: string; timezone: string; servicios: BookingService[]; empleados: Empleado[] };

// --- helpers de fecha (día "plano", sin arrastrar TZ del navegador) ----------
const ymd = (d: Date) => d.toISOString().slice(0, 10);
function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
function mondayOf(dateStr: string): string {
  const wd = new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0=dom
  return addDays(dateStr, -((wd + 6) % 7));
}
function humanDia(dateStr: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("es-ES", { ...opts, timeZone: "UTC" });
}
const hora = (iso: string) => iso.slice(11, 16);
const p2 = (n: number) => String(n).padStart(2, "0");
function sumaHora(iso: string, min: number): string {
  const [h, m] = iso.slice(11, 16).split(":").map(Number);
  const t = h * 60 + m + min;
  const hh = Math.floor((t % 1440) / 60);
  const mm = t % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
const HOY = () => new Date().toISOString().slice(0, 10);

// --- estados -----------------------------------------------------------------
const ESTADO: Record<EstadoCita, { label: string; bg: string; fg: string }> = {
  pendiente: { label: "Pendiente", bg: "#F5C518", fg: "#000" },
  confirmada: { label: "Confirmada", bg: "#5A6B3F", fg: "#fff" },
  completada: { label: "Completada", bg: "#111", fg: "#fff" },
  cancelada: { label: "Cancelada", bg: "#e5e5e5", fg: "#666" },
  no_show: { label: "No-show", bg: "#C8202A", fg: "#fff" },
};
const ACCIONES: Record<EstadoCita, [EstadoCita, string][]> = {
  pendiente: [["confirmada", "Confirmar"], ["completada", "Completar"], ["no_show", "No vino"], ["cancelada", "Cancelar"]],
  confirmada: [["completada", "Completar"], ["no_show", "No vino"], ["cancelada", "Cancelar"]],
  completada: [],
  cancelada: [],
  no_show: [],
};

/** Evento externo del Google Calendar del owner (solo lectura). */
type EventoExterno = { id: string; titulo: string; start: string; end: string; allDay: boolean };

export default function AgendaView({ slug, nombre, timezone, servicios, empleados }: Props) {
  const empMap = useMemo(() => Object.fromEntries(empleados.map((e) => [e.id, e])) as Record<string, Empleado>, [empleados]);
  const [vista, setVista] = useState<"dia" | "rejilla" | "columnas" | "semana">("dia");
  const [dia, setDia] = useState<string>(HOY());
  const [records, setRecords] = useState<BookingRecord[]>([]);
  const [externos, setExternos] = useState<EventoExterno[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState<null | "cita" | "bloqueo">(null);
  const [reprog, setReprog] = useState<BookingRecord | null>(null);
  const [detalle, setDetalle] = useState<BookingRecord | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "err"; msg: string } | null>(null);

  const lunes = useMemo(() => mondayOf(dia), [dia]);
  const semanal = vista === "semana" || vista === "rejilla";
  const rangeFrom = semanal ? lunes : dia;
  const rangeTo = semanal ? addDays(lunes, 6) : dia;

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch(`/api/booking/${slug}/agenda?from=${rangeFrom}&to=${rangeTo}`, { cache: "no-store" });
      const j = await r.json();
      if (r.ok && j.ok) setRecords(j.records as BookingRecord[]);
      else setAviso({ tipo: "err", msg: "No se pudo cargar la agenda." });
    } catch {
      setAviso({ tipo: "err", msg: "Fallo de red al cargar la agenda." });
    } finally {
      setCargando(false);
    }
    // Eventos externos de Google (solo lectura) — best-effort, no bloquean la agenda.
    try {
      const re = await fetch(`/api/booking/${slug}/agenda/externos?from=${rangeFrom}&to=${rangeTo}`, { cache: "no-store" });
      const je = await re.json();
      setExternos(re.ok && je.ok ? (je.eventos as EventoExterno[]) : []);
    } catch {
      setExternos([]);
    }
  }, [slug, rangeFrom, rangeTo]);

  // Reprograma (mover/redimensionar) desde la rejilla, con guardado optimista.
  const reprogramarInline = useCallback(async (recordId: string, startIso: string, durationMin: number) => {
    setAviso(null);
    // optimista
    setRecords((prev) => prev.map((x) => (x.id === recordId ? { ...x, startIso: `${startIso}:00`.slice(0, 19), durationMin } : x)));
    try {
      const r = await fetch(`/api/booking/${slug}/agenda`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reprogramar", recordId, startIso, durationMin }),
      });
      const j = await r.json();
      if (r.ok && j.ok) {
        setRecords((prev) => prev.map((x) => (x.id === recordId ? (j.record as BookingRecord) : x)));
        setAviso({ tipo: "ok", msg: "Cita actualizada." });
      } else {
        if (j.reason === "slot_taken") setAviso({ tipo: "err", msg: "Ese hueco choca con otra cita/bloqueo." });
        else if (j.reason === "no_calendar") setAviso({ tipo: "err", msg: "No hay calendario de Google conectado." });
        else setAviso({ tipo: "err", msg: j.detail || "No se pudo mover la cita." });
        cargar(); // revertir al estado real
      }
    } catch {
      setAviso({ tipo: "err", msg: "Fallo de red al mover." });
      cargar();
    }
  }, [slug, cargar]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  async function cambiarEstado(recordId: string, estado: EstadoCita) {
    setAviso(null);
    const r = await fetch(`/api/booking/${slug}/agenda`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "estado", recordId, estado }),
    });
    const j = await r.json();
    if (r.ok && j.ok) {
      setRecords((prev) => prev.map((x) => (x.id === recordId ? (j.record as BookingRecord) : x)));
      setAviso({ tipo: "ok", msg: `Marcada como ${ESTADO[estado].label.toLowerCase()}.` });
    } else {
      setAviso({ tipo: "err", msg: j.detail || "No se pudo actualizar el estado." });
    }
  }

  const delDia = (fecha: string) =>
    records.filter((r) => r.startIso.slice(0, 10) === fecha).sort((a, b) => a.startIso.localeCompare(b.startIso));

  return (
    <div>
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex border-[3px] border-black">
          {(empleados.length > 0 ? (["dia", "rejilla", "columnas", "semana"] as const) : (["dia", "rejilla", "semana"] as const)).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest ${vista === v ? "bg-black text-white" : "bg-white hover:bg-[color:var(--cream)]"}`}
            >
              {v === "dia" ? "Día" : v === "rejilla" ? "Rejilla" : v === "columnas" ? "Personal" : "Semana"}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-1">
          <button onClick={() => setDia(addDays(dia, semanal ? -7 : -1))} className="w-8 h-8 border-[3px] border-black bg-white font-bold hover:bg-[color:var(--cream)]" aria-label="Anterior">‹</button>
          <button onClick={() => setDia(HOY())} className="px-2 h-8 border-[3px] border-black bg-white text-xs font-bold uppercase tracking-widest hover:bg-[color:var(--cream)]">Hoy</button>
          <button onClick={() => setDia(addDays(dia, semanal ? 7 : 1))} className="w-8 h-8 border-[3px] border-black bg-white font-bold hover:bg-[color:var(--cream)]" aria-label="Siguiente">›</button>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setModal("cita")} className="btn-mustard text-xs">＋ Cita</button>
          <button onClick={() => setModal("bloqueo")} className="border-[3px] border-black bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest hover:bg-[color:var(--cream)]">＋ Bloqueo</button>
        </div>
      </div>

      <EsperaBanner slug={slug} />

      <div className="mb-3 font-stencil text-2xl capitalize leading-none">
        {semanal ? `Semana del ${humanDia(lunes, { day: "numeric", month: "long" })}` : humanDia(dia)}
      </div>

      {aviso && (
        <div className={`mb-3 border-2 p-2 text-sm font-bold ${aviso.tipo === "ok" ? "border-[color:var(--olive,#5A6B3F)] text-[color:var(--olive,#5A6B3F)]" : "border-[color:var(--red)] text-[color:var(--red)]"}`}>
          {aviso.tipo === "ok" ? "✓ " : "⚠ "}{aviso.msg}
        </div>
      )}

      {cargando ? (
        <div className="animate-pulse font-mono text-sm text-black/40 py-8 text-center">Cargando agenda…</div>
      ) : vista === "dia" ? (
        <DiaLista records={delDia(dia)} onEstado={cambiarEstado} onMover={setReprog} empMap={empMap} />
      ) : vista === "rejilla" ? (
        <RejillaSemana
          lunes={lunes}
          records={records}
          externos={externos}
          empMap={empMap}
          timezone={timezone}
          slotStepMin={15}
          onReprogramar={reprogramarInline}
          onSelect={setDetalle}
        />
      ) : vista === "columnas" ? (
        <ColumnasDia dia={dia} records={records} empleados={empleados} onSelect={setDetalle} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, i) => addDays(lunes, i)).map((fecha) => {
            const recs = delDia(fecha);
            const esHoy = fecha === HOY();
            return (
              <div key={fecha} className={`border-2 ${esHoy ? "border-black" : "border-black/20"} min-h-[80px]`}>
                <button onClick={() => { setDia(fecha); setVista("dia"); }} className={`w-full text-left px-2 py-1 text-[11px] font-bold uppercase tracking-wide border-b-2 ${esHoy ? "bg-[color:var(--mustard)] border-black" : "border-black/10 hover:bg-[color:var(--cream)]"}`}>
                  {humanDia(fecha, { weekday: "short", day: "numeric" })}
                </button>
                <div className="p-1 space-y-1">
                  {recs.length === 0 && <div className="text-[10px] text-black/25 px-1 py-2">—</div>}
                  {recs.map((r) => (
                    <MiniBloque key={r.id} r={r} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal === "cita" && (
        <CitaModal slug={slug} servicios={servicios} empleados={empleados} dia={dia} onClose={() => setModal(null)} onDone={(msg) => { setModal(null); setAviso({ tipo: "ok", msg }); cargar(); }} onError={(msg) => setAviso({ tipo: "err", msg })} />
      )}
      {modal === "bloqueo" && (
        <BloqueoModal slug={slug} dia={dia} onClose={() => setModal(null)} onDone={(msg) => { setModal(null); setAviso({ tipo: "ok", msg }); cargar(); }} onError={(msg) => setAviso({ tipo: "err", msg })} />
      )}
      {reprog && (
        <ReprogramarModal slug={slug} record={reprog} onClose={() => setReprog(null)} onDone={(msg) => { setReprog(null); setAviso({ tipo: "ok", msg }); cargar(); }} onError={(msg) => setAviso({ tipo: "err", msg })} />
      )}
      {detalle && (
        <DetalleCita r={detalle} empMap={empMap} onClose={() => setDetalle(null)} onEstado={(id, e) => { setDetalle(null); cambiarEstado(id, e); }} onMover={(r) => { setDetalle(null); setReprog(r); }} />
      )}

      <p className="mt-6 text-[11px] text-black/40 leading-relaxed">
        Zona horaria: {timezone}. Las citas online, por WhatsApp o teléfono y las que crees aquí comparten el mismo calendario de Google — sin dobles reservas.
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Lista del día (tarjetas ricas con acciones)
// -----------------------------------------------------------------------------
function DiaLista({ records, onEstado, onMover, empMap }: { records: BookingRecord[]; onEstado: (id: string, e: EstadoCita) => void; onMover: (r: BookingRecord) => void; empMap: Record<string, Empleado> }) {
  if (records.length === 0) {
    return (
      <div className="card-hard bg-white p-8 text-center">
        <div className="text-4xl mb-2">🗓️</div>
        <div className="font-bold">Sin citas este día</div>
        <p className="text-sm text-black/50 mt-1">Crea una cita manual o comparte tu enlace de reservas.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {records.map((r) => (
        <TarjetaCita key={r.id} r={r} onEstado={onEstado} onMover={onMover} empMap={empMap} />
      ))}
    </div>
  );
}

function TarjetaCita({ r, onEstado, onMover, empMap }: { r: BookingRecord; onEstado: (id: string, e: EstadoCita) => void; onMover: (r: BookingRecord) => void; empMap: Record<string, Empleado> }) {
  const emp = r.empleadoId ? empMap[r.empleadoId] : undefined;
  const empNombre = emp?.nombre || r.empleadoNombre;
  const esBloqueo = r.tipo === "bloqueo";
  const est = ESTADO[r.estado];
  const finServicio = sumaHora(r.startIso, r.durationMin);
  const servicio = [r.servicioNombre, r.varianteNombre].filter(Boolean).join(" · ");
  const anulado = r.estado === "cancelada" || r.estado === "no_show";

  return (
    <div className={`card-hard bg-white p-3 flex gap-3 ${anulado ? "opacity-60" : ""}`}>
      {/* Columna hora */}
      <div className="shrink-0 text-center w-16 border-r-2 border-black/10 pr-2">
        <div className="font-stencil text-lg leading-none">{hora(r.startIso)}</div>
        <div className="text-[11px] text-black/40">{finServicio}</div>
      </div>
      {/* Cuerpo */}
      <div className="flex-1 min-w-0">
        {esBloqueo ? (
          <div className="font-bold text-black/70">⛔ Bloqueo{r.nota ? `: ${r.nota}` : ""}</div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold truncate">{r.cliente?.nombre || "Cliente"}</span>
              <span className="text-[10px]" title={r.origen === "manual" ? "Creada a mano" : "Reserva online"}>{r.origen === "manual" ? "✍️" : "🌐"}</span>
              {empNombre && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 border-2 border-black" style={{ background: emp?.color || "#eee", color: emp?.color ? "#fff" : "#000" }}>{empNombre}</span>
              )}
            </div>
            <div className="text-sm text-black/70 truncate">{servicio}{typeof r.precioEUR === "number" && r.precioEUR > 0 ? ` · ${r.precioEUR}€` : ""}</div>
            {(r.cliente?.telefono || r.addonsNombres?.length) && (
              <div className="text-[11px] text-black/45 truncate">
                {r.cliente?.telefono}{r.addonsNombres?.length ? `${r.cliente?.telefono ? " · " : ""}+ ${r.addonsNombres.join(", ")}` : ""}
              </div>
            )}
          </>
        )}
        {/* Acciones */}
        {esBloqueo ? (
          r.estado === "confirmada" && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <BtnAccion onClick={() => onMover(r)}>Mover</BtnAccion>
              <BtnAccion onClick={() => onEstado(r.id, "cancelada")}>Eliminar</BtnAccion>
            </div>
          )
        ) : ACCIONES[r.estado].length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {ACCIONES[r.estado].map(([e, label]) => (
              <BtnAccion key={e} onClick={() => onEstado(r.id, e)}>{label}</BtnAccion>
            ))}
            <BtnAccion onClick={() => onMover(r)}>Mover</BtnAccion>
          </div>
        ) : null}
      </div>
      {/* Badge estado */}
      <div className="shrink-0">
        <span className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 inline-block" style={{ background: est.bg, color: est.fg }}>{est.label}</span>
      </div>
    </div>
  );
}

function MiniBloque({ r }: { r: BookingRecord }) {
  const est = ESTADO[r.estado];
  const anulado = r.estado === "cancelada" || r.estado === "no_show";
  return (
    <div className={`text-[10px] leading-tight px-1 py-0.5 border-l-4 ${anulado ? "opacity-50" : ""}`} style={{ borderColor: est.bg, background: "#fff" }}>
      <div className="font-bold">{hora(r.startIso)}</div>
      <div className="truncate">{r.tipo === "bloqueo" ? "⛔ Bloqueo" : r.cliente?.nombre || r.servicioNombre}</div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Vista "Personal" — columnas por empleado (calendario tipo Booksy)
// -----------------------------------------------------------------------------
function ColumnasDia({ dia, records, empleados, onSelect }: {
  dia: string; records: BookingRecord[]; empleados: Empleado[]; onSelect: (r: BookingRecord) => void;
}) {
  const emps = empleados.filter((e) => e.activo);
  const recs = records.filter((r) => r.startIso.slice(0, 10) === dia && r.estado !== "cancelada");
  const min = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
  const globales = recs.filter((r) => !r.empleadoId);

  const starts = recs.map((r) => min(r.startIso));
  const ends = recs.map((r) => min(r.startIso) + r.durationMin);
  let lo = Math.min(540, ...(starts.length ? starts : [540]));
  let hi = Math.max(1200, ...(ends.length ? ends : [1200]));
  lo = Math.floor(lo / 60) * 60;
  hi = Math.ceil(hi / 60) * 60;
  const PX = 0.7;
  const H = (hi - lo) * PX;
  const horas: number[] = [];
  for (let m = lo; m <= hi; m += 60) horas.push(m);

  if (emps.length === 0) return <p className="text-sm text-black/50 py-6 text-center">Añade personal para ver la agenda por columnas.</p>;

  const bloque = (r: BookingRecord, emp?: Empleado) => {
    const top = (min(r.startIso) - lo) * PX;
    const h = Math.max(r.durationMin * PX, 22);
    const bg = r.tipo === "bloqueo" ? "#4b5563" : emp?.color || "#6b7280";
    return (
      <button key={r.id} onClick={() => onSelect(r)} className={`absolute left-0.5 right-0.5 text-left overflow-hidden border-2 border-black px-1 py-0.5 ${r.estado === "no_show" ? "opacity-60" : ""}`} style={{ top, height: h, background: bg, color: "#fff" }}>
        <div className="text-[10px] font-bold leading-none">{r.startIso.slice(11, 16)}{r.estado === "completada" ? " ✓" : r.estado === "no_show" ? " ✗" : ""}</div>
        <div className="text-[10px] leading-tight truncate">{r.tipo === "bloqueo" ? `⛔ ${r.nota || "Bloqueo"}` : (r.cliente?.nombre || r.servicioNombre)}</div>
        {h > 36 && r.tipo !== "bloqueo" && <div className="text-[9px] leading-tight truncate opacity-80">{r.servicioNombre}</div>}
      </button>
    );
  };

  return (
    <div className="overflow-x-auto border-2 border-black">
      <div className="flex" style={{ minWidth: `${56 + (emps.length + (globales.length ? 1 : 0)) * 128}px` }}>
        <div className="w-14 shrink-0 relative border-r-2 border-black/15" style={{ height: H + 28 }}>
          <div className="h-7 border-b-2 border-black" />
          {horas.map((m) => (
            <div key={m} className="absolute right-1 text-[10px] font-mono text-black/40" style={{ top: 28 + (m - lo) * PX - 5 }}>{p2(Math.floor(m / 60))}:{p2(m % 60)}</div>
          ))}
        </div>
        {globales.length > 0 && <Columna titulo="General" color="#4b5563" H={H} horas={horas} lo={lo} PX={PX}>{globales.map((r) => bloque(r))}</Columna>}
        {emps.map((e) => (
          <Columna key={e.id} titulo={e.nombre} color={e.color} H={H} horas={horas} lo={lo} PX={PX}>
            {recs.filter((r) => r.empleadoId === e.id).map((r) => bloque(r, e))}
          </Columna>
        ))}
      </div>
    </div>
  );
}

function Columna({ titulo, color, H, horas, lo, PX, children }: {
  titulo: string; color?: string; H: number; horas: number[]; lo: number; PX: number; children: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-w-[128px] border-l border-black/10">
      <div className="h-7 flex items-center gap-1 px-1.5 border-b-2 border-black bg-white">
        <span className="w-3 h-3 border border-black shrink-0" style={{ background: color || "#eee" }} />
        <span className="text-[11px] font-bold uppercase tracking-wide truncate">{titulo}</span>
      </div>
      <div className="relative" style={{ height: H }}>
        {horas.map((m) => <div key={m} className="absolute left-0 right-0 border-t border-black/10" style={{ top: (m - lo) * PX }} />)}
        {children}
      </div>
    </div>
  );
}

function DetalleCita({ r, empMap, onClose, onEstado, onMover }: {
  r: BookingRecord; empMap: Record<string, Empleado>; onClose: () => void; onEstado: (id: string, e: EstadoCita) => void; onMover: (r: BookingRecord) => void;
}) {
  const emp = r.empleadoId ? empMap[r.empleadoId] : undefined;
  const est = ESTADO[r.estado];
  const esBloqueo = r.tipo === "bloqueo";
  const servicio = [r.servicioNombre, r.varianteNombre].filter(Boolean).join(" · ");
  return (
    <Overlay titulo={esBloqueo ? "Bloqueo" : "Cita"} onClose={onClose}>
      <div className="space-y-1 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5" style={{ background: est.bg, color: est.fg }}>{est.label}</span>
          {emp && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 border-2 border-black" style={{ background: emp.color || "#eee", color: emp.color ? "#fff" : "#000" }}>{emp.nombre}</span>}
          {r.origen && <span className="text-[10px]">{r.origen === "manual" ? "✍️ manual" : "🌐 online"}</span>}
        </div>
        {esBloqueo ? (
          <div className="font-bold text-lg">⛔ {r.nota || "Bloqueo"}</div>
        ) : (
          <>
            <div className="font-bold text-lg">{r.cliente?.nombre || "Cliente"}</div>
            <div className="text-sm text-black/70">{servicio}{typeof r.precioEUR === "number" && r.precioEUR > 0 ? ` · ${r.precioEUR}€` : ""}</div>
            {r.cliente?.telefono && <div className="text-sm text-black/60">{r.cliente.telefono}</div>}
            {r.addonsNombres?.length ? <div className="text-xs text-black/50">+ {r.addonsNombres.join(", ")}</div> : null}
          </>
        )}
        <div className="text-sm text-black/70">{r.startIso.slice(0, 10)} · {r.startIso.slice(11, 16)} ({r.durationMin} min)</div>
        {r.nota && !esBloqueo && <div className="text-xs text-black/50">Nota: {r.nota}</div>}
      </div>
      <div className="flex flex-wrap gap-2">
        {esBloqueo ? (
          r.estado === "confirmada" && (
            <>
              <BtnAccion onClick={() => onMover(r)}>Mover</BtnAccion>
              <BtnAccion onClick={() => onEstado(r.id, "cancelada")}>Eliminar</BtnAccion>
            </>
          )
        ) : ACCIONES[r.estado].length > 0 ? (
          <>
            {ACCIONES[r.estado].map(([e, label]) => <BtnAccion key={e} onClick={() => onEstado(r.id, e)}>{label}</BtnAccion>)}
            <BtnAccion onClick={() => onMover(r)}>Mover</BtnAccion>
          </>
        ) : (
          <span className="text-xs text-black/40">Cita cerrada (sin acciones).</span>
        )}
      </div>
    </Overlay>
  );
}

function BtnAccion({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="text-[11px] font-bold uppercase tracking-wide border-2 border-black px-2 py-0.5 hover:bg-black hover:text-white">
      {children}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Modal: reprogramar / mover (cita o bloqueo)
// -----------------------------------------------------------------------------
function ReprogramarModal({ slug, record, onClose, onDone, onError }: {
  slug: string; record: BookingRecord; onClose: () => void; onDone: (msg: string) => void; onError: (msg: string) => void;
}) {
  const [fecha, setFecha] = useState(record.startIso.slice(0, 10));
  const [hh, setHh] = useState(record.startIso.slice(11, 16));
  const [dur, setDur] = useState(record.durationMin);
  const [enviando, setEnviando] = useState(false);
  const esBloqueo = record.tipo === "bloqueo";

  async function enviar() {
    setEnviando(true);
    try {
      const r = await fetch(`/api/booking/${slug}/agenda`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reprogramar", recordId: record.id, startIso: `${fecha}T${hh}:00`, durationMin: dur }),
      });
      const j = await r.json();
      if (r.ok && j.ok) onDone(esBloqueo ? "Bloqueo movido." : "Cita reprogramada.");
      else if (j.reason === "slot_taken") onError("Ese hueco choca con otra cita/bloqueo. Elige otra hora.");
      else if (j.reason === "no_movible") onError("Esta cita ya está cerrada y no se puede mover.");
      else if (j.reason === "no_calendar") onError("No hay calendario de Google conectado.");
      else onError(j.detail || "No se pudo reprogramar.");
    } catch {
      onError("Fallo de red.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Overlay titulo={esBloqueo ? "Mover bloqueo" : "Reprogramar cita"} onClose={onClose}>
      <div className="text-sm text-black/70 mb-4 border-l-4 border-black pl-3">
        {esBloqueo ? `⛔ Bloqueo${record.nota ? `: ${record.nota}` : ""}` : (
          <>
            <b>{record.cliente?.nombre || "Cliente"}</b> — {[record.servicioNombre, record.varianteNombre].filter(Boolean).join(" · ")}
            <div className="text-[11px] text-black/40">Ahora: {record.startIso.slice(0, 10)} · {record.startIso.slice(11, 16)}</div>
          </>
        )}
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="card-hard w-full px-3 py-2 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Hora</label>
          <input type="time" value={hh} onChange={(e) => setHh(e.target.value)} className="card-hard w-full px-3 py-2 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Min</label>
          <input type="number" min={5} step={5} value={dur} onChange={(e) => setDur(Math.max(5, +e.target.value || record.durationMin))} className="card-hard w-20 px-3 py-2 bg-white" />
        </div>
      </div>
      <button onClick={enviar} disabled={enviando} className="btn-mustard w-full disabled:opacity-60">{enviando ? "Moviendo…" : "Guardar cambios"}</button>
    </Overlay>
  );
}

// -----------------------------------------------------------------------------
// Modal: cita manual
// -----------------------------------------------------------------------------
function CitaModal({ slug, servicios, empleados, dia, onClose, onDone, onError }: {
  slug: string; servicios: BookingService[]; empleados: Empleado[]; dia: string;
  onClose: () => void; onDone: (msg: string) => void; onError: (msg: string) => void;
}) {
  const [serviceId, setServiceId] = useState<string>(servicios[0]?.id || "__custom");
  const [variantId, setVariantId] = useState<string>("");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [empleadoId, setEmpleadoId] = useState<string>("");
  const [customNombre, setCustomNombre] = useState("");
  const [customDur, setCustomDur] = useState(30);
  const [fecha, setFecha] = useState(dia);
  const [hora, setHora] = useState("10:00");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  const svc = servicios.find((s) => s.id === serviceId);
  const esCustom = serviceId === "__custom";
  const empsActivos = empleados.filter((e) => e.activo);
  const empsDisp = esCustom ? empsActivos : empsActivos.filter((e) => !e.serviceIds?.length || e.serviceIds.includes(serviceId));

  async function enviar() {
    setEnviando(true);
    try {
      const body: Record<string, unknown> = {
        action: "cita",
        startIso: `${fecha}T${hora}:00`,
        cliente: { nombre, telefono, email },
        empleadoId: empleadoId || undefined,
        nota: nota || undefined,
      };
      if (esCustom) {
        body.customNombre = customNombre || "Cita";
        body.customDurationMin = customDur;
      } else {
        body.serviceId = serviceId;
        if (variantId) body.variantId = variantId;
        if (addonIds.length) body.addonIds = addonIds;
      }
      const r = await fetch(`/api/booking/${slug}/agenda`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok && j.ok) onDone("Cita creada.");
      else if (j.reason === "slot_taken") onError("Ese hueco choca con otra cita/bloqueo. Elige otra hora.");
      else if (j.reason === "no_calendar") onError("No hay calendario de Google conectado para este negocio.");
      else onError(j.detail || "No se pudo crear la cita.");
    } catch {
      onError("Fallo de red.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Overlay titulo="Nueva cita" onClose={onClose}>
      <label className="block text-xs font-bold uppercase tracking-widest mb-1">Servicio</label>
      <select value={serviceId} onChange={(e) => { setServiceId(e.target.value); setVariantId(""); setAddonIds([]); setEmpleadoId(""); }} className="card-hard w-full px-3 py-2 mb-3 bg-white">
        {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        <option value="__custom">Otro (personalizado)…</option>
      </select>

      {esCustom ? (
        <div className="grid grid-cols-[1fr_auto] gap-2 mb-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1">Nombre</label>
            <input value={customNombre} onChange={(e) => setCustomNombre(e.target.value)} placeholder="p. ej. Consulta" className="card-hard w-full px-3 py-2 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1">Min</label>
            <input type="number" min={5} step={5} value={customDur} onChange={(e) => setCustomDur(Math.max(5, +e.target.value || 30))} className="card-hard w-20 px-3 py-2 bg-white" />
          </div>
        </div>
      ) : (
        <>
          {svc?.variantes?.length ? (
            <>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1">Opción</label>
              <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="card-hard w-full px-3 py-2 mb-3 bg-white">
                <option value="">— elige —</option>
                {svc.variantes.map((v) => <option key={v.id} value={v.id}>{v.nombre} · {v.durationMin}min · {v.precioEUR}€</option>)}
              </select>
            </>
          ) : null}
          {svc?.addons?.filter((a) => a.activo).length ? (
            <div className="mb-3">
              <div className="text-xs font-bold uppercase tracking-widest mb-1">Extras</div>
              {svc.addons.filter((a) => a.activo).map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm py-0.5">
                  <input type="checkbox" checked={addonIds.includes(a.id)} onChange={(e) => setAddonIds((prev) => e.target.checked ? [...prev, a.id] : prev.filter((x) => x !== a.id))} />
                  {a.nombre} <span className="text-black/40">+{a.durationMin}min · +{a.precioEUR}€</span>
                </label>
              ))}
            </div>
          ) : null}
        </>
      )}

      {empsActivos.length > 0 && (
        <>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Profesional</label>
          <select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)} className="card-hard w-full px-3 py-2 mb-3 bg-white">
            <option value="">Sin asignar</option>
            {empsDisp.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="card-hard w-full px-3 py-2 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Hora</label>
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="card-hard w-full px-3 py-2 bg-white" />
        </div>
      </div>

      <label className="block text-xs font-bold uppercase tracking-widest mb-1">Cliente</label>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className="card-hard w-full px-3 py-2 mb-2 bg-white" />
      <div className="grid grid-cols-2 gap-2 mb-3">
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono" className="card-hard px-3 py-2 bg-white" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (opcional)" className="card-hard px-3 py-2 bg-white" />
      </div>
      <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota interna (opcional)" className="card-hard w-full px-3 py-2 mb-4 bg-white" />

      <button onClick={enviar} disabled={enviando} className="btn-mustard w-full disabled:opacity-60">{enviando ? "Creando…" : "Crear cita"}</button>
    </Overlay>
  );
}

// -----------------------------------------------------------------------------
// Modal: bloqueo
// -----------------------------------------------------------------------------
function BloqueoModal({ slug, dia, onClose, onDone, onError }: {
  slug: string; dia: string; onClose: () => void; onDone: (msg: string) => void; onError: (msg: string) => void;
}) {
  const [fecha, setFecha] = useState(dia);
  const [hora, setHora] = useState("14:00");
  const [dur, setDur] = useState(60);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    try {
      const r = await fetch(`/api/booking/${slug}/agenda`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bloqueo", startIso: `${fecha}T${hora}:00`, durationMin: dur, nota: nota || undefined }),
      });
      const j = await r.json();
      if (r.ok && j.ok) onDone("Bloqueo creado.");
      else if (j.reason === "slot_taken") onError("Ese tramo choca con una cita existente.");
      else if (j.reason === "no_calendar") onError("No hay calendario de Google conectado.");
      else onError(j.detail || "No se pudo crear el bloqueo.");
    } catch {
      onError("Fallo de red.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Overlay titulo="Bloquear tiempo" onClose={onClose}>
      <p className="text-sm text-black/60 mb-3">Descansos, recados, vacaciones… El tramo deja de ofrecerse para reservas.</p>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="card-hard w-full px-3 py-2 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Desde</label>
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="card-hard w-full px-3 py-2 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Min</label>
          <input type="number" min={5} step={5} value={dur} onChange={(e) => setDur(Math.max(5, +e.target.value || 60))} className="card-hard w-20 px-3 py-2 bg-white" />
        </div>
      </div>
      <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Motivo (opcional)" className="card-hard w-full px-3 py-2 mb-4 bg-white" />
      <button onClick={enviar} disabled={enviando} className="btn-mustard w-full disabled:opacity-60">{enviando ? "Bloqueando…" : "Bloquear"}</button>
    </Overlay>
  );
}

// -----------------------------------------------------------------------------
// Vista "Rejilla" — semana con arrastrar/redimensionar (Booksy). Mueve hora Y día,
// redimensiona duración, guarda vía reprogramar. Pinta eventos externos de Google
// (solo lectura) para no solaparse con reservas nuevas.
// -----------------------------------------------------------------------------
type ExternoBlk = { id: string; date: string; min: number; dur: number; titulo: string };
type Ghost = { id: string; date: string; min: number; dur: number };

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const minFromIso = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
const hhmm = (m: number) => `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;

/** ISO con zona (Google) → { date:"YYYY-MM-DD", min } en la zona del negocio (DST-correcto). */
function localPartsTz(iso: string, tz: string): { date: string; min: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d).reduce((a, x) => ((a[x.type] = x.value), a), {} as Record<string, string>);
  const hh = parts.hour === "24" ? 0 : Number(parts.hour);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, min: hh * 60 + Number(parts.minute) };
}

function RejillaSemana({ lunes, records, externos, empMap, timezone, slotStepMin, onReprogramar, onSelect }: {
  lunes: string;
  records: BookingRecord[];
  externos: { id: string; titulo: string; start: string; end: string; allDay: boolean }[];
  empMap: Record<string, Empleado>;
  timezone: string;
  slotStepMin: number;
  onReprogramar: (recordId: string, startIso: string, durationMin: number) => void;
  onSelect: (r: BookingRecord) => void;
}) {
  const step = slotStepMin || 15;
  const PX = 0.8;
  const AX = 46; // ancho del eje horario (px)
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(lunes, i)), [lunes]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<null | { id: string; mode: "move" | "resize"; startX: number; startY: number; origDate: string; origMin: number; origDur: number; moved: boolean }>(null);
  const ghostRef = useRef<Ghost | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const setGh = (g: Ghost | null) => { ghostRef.current = g; setGhost(g); };

  // Bloques de nuestras reservas (excluye canceladas). Movible = pendiente/confirmada.
  const nuestros = useMemo(() =>
    records
      .filter((r) => r.estado !== "cancelada")
      .map((r) => ({ id: r.id, date: r.startIso.slice(0, 10), min: minFromIso(r.startIso), dur: Math.max(step, r.durationMin), r })),
    [records, step]);

  // Eventos externos con hora (los de día completo se listan aparte arriba).
  const ext = useMemo(() => {
    const out: ExternoBlk[] = [];
    for (const e of externos) {
      if (e.allDay) continue;
      const s = localPartsTz(e.start, timezone);
      const en = localPartsTz(e.end, timezone);
      if (!s) continue;
      let dur = en && en.date === s.date ? en.min - s.min : 24 * 60 - s.min;
      if (dur < 15) dur = 15;
      out.push({ id: e.id, date: s.date, min: s.min, dur, titulo: e.titulo });
    }
    return out;
  }, [externos, timezone]);
  const extAllDay = externos.filter((e) => e.allDay);

  // Rango vertical dinámico (por defecto 9:00–20:00, se estira a lo que haya).
  const { lo, hi, H, horas } = useMemo(() => {
    const all = [...nuestros, ...ext].flatMap((b) => [b.min, b.min + b.dur]);
    let l = Math.min(9 * 60, ...(all.length ? all : [9 * 60]));
    let h = Math.max(20 * 60, ...(all.length ? all : [20 * 60]));
    l = Math.floor(l / 60) * 60; h = Math.ceil(h / 60) * 60;
    const hrs: number[] = [];
    for (let m = l; m <= h; m += 60) hrs.push(m);
    return { lo: l, hi: h, H: (h - l) * PX, horas: hrs };
  }, [nuestros, ext]);

  // Aplica el ghost (arrastre en curso) al bloque afectado.
  const efNuestros = ghost ? nuestros.map((b) => (b.id === ghost.id ? { ...b, date: ghost.date, min: ghost.min, dur: ghost.dur } : b)) : nuestros;

  const onMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    const deltaMin = Math.round(dy / PX / step) * step;
    if (d.mode === "move") {
      const newMin = clampN(d.origMin + deltaMin, lo, hi - d.origDur);
      const rect = wrapRef.current?.getBoundingClientRect();
      let idx = dias.indexOf(d.origDate);
      if (rect) {
        const colW = (rect.width - AX) / 7;
        idx = clampN(Math.floor((e.clientX - rect.left - AX) / colW), 0, 6);
      }
      setGh({ id: d.id, date: dias[idx], min: newMin, dur: d.origDur });
    } else {
      const newDur = clampN(d.origDur + deltaMin, step, hi - d.origMin);
      setGh({ id: d.id, date: d.origDate, min: d.origMin, dur: newDur });
    }
  }, [dias, lo, hi, step]);

  const onUp = useCallback(() => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    const d = dragRef.current; dragRef.current = null;
    const g = ghostRef.current; setGh(null);
    if (!d) return;
    if (!d.moved) { // fue un clic → abrir detalle
      const rec = records.find((r) => r.id === d.id);
      if (rec) onSelect(rec);
      return;
    }
    if (!g) return;
    const cambiaTiempo = g.date !== d.origDate || g.min !== d.origMin;
    const cambiaDur = g.dur !== d.origDur;
    if (!cambiaTiempo && !cambiaDur) return;
    onReprogramar(d.id, `${g.date}T${hhmm(g.min)}`, g.dur);
  }, [onMove, records, onSelect, onReprogramar]);

  function startDrag(e: React.PointerEvent, blk: { id: string; date: string; min: number; dur: number }, mode: "move" | "resize") {
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { id: blk.id, mode, startX: e.clientX, startY: e.clientY, origDate: blk.date, origMin: blk.min, origDur: blk.dur, moved: false };
    setGh({ id: blk.id, date: blk.date, min: blk.min, dur: blk.dur });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  useEffect(() => () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); }, [onMove, onUp]);

  const esArrastrando = !!ghost;

  return (
    <div>
      {extAllDay.length > 0 && (
        <div className="mb-2 text-[11px] text-black/50 flex flex-wrap gap-2">
          {extAllDay.map((e) => <span key={e.id} className="border-2 border-black/30 bg-black/5 px-1.5 py-0.5">📅 {e.titulo}</span>)}
        </div>
      )}
      <div ref={wrapRef} className="border-2 border-black bg-white select-none" style={{ touchAction: esArrastrando ? "none" : "auto" }}>
        {/* Cabecera de días */}
        <div className="flex border-b-2 border-black">
          <div className="shrink-0 border-r-2 border-black/15" style={{ width: AX }} />
          {dias.map((f) => {
            const esHoy = f === HOY();
            return (
              <div key={f} className={`flex-1 text-center py-1 text-[11px] font-bold uppercase tracking-wide border-l border-black/10 ${esHoy ? "bg-[color:var(--mustard)]" : ""}`}>
                {humanDia(f, { weekday: "short", day: "numeric" })}
              </div>
            );
          })}
        </div>
        {/* Cuerpo */}
        <div className="flex" style={{ height: H }}>
          {/* Eje horario */}
          <div className="shrink-0 relative border-r-2 border-black/15" style={{ width: AX, height: H }}>
            {horas.map((m) => (
              <div key={m} className="absolute right-1 text-[10px] font-mono text-black/40" style={{ top: (m - lo) * PX - 5 }}>{p2(Math.floor(m / 60))}:{p2(m % 60)}</div>
            ))}
          </div>
          {/* Columnas de día */}
          {dias.map((f) => {
            const dosNuestros = efNuestros.filter((b) => b.date === f);
            const dosExt = ext.filter((b) => b.date === f);
            return (
              <div key={f} className="flex-1 relative border-l border-black/10" style={{ height: H }}>
                {horas.map((m) => <div key={m} className="absolute left-0 right-0 border-t border-black/10" style={{ top: (m - lo) * PX }} />)}
                {/* Externos (solo lectura) */}
                {dosExt.map((b) => (
                  <div key={b.id} title={b.titulo}
                    className="absolute left-0.5 right-0.5 overflow-hidden border-2 border-black/30 px-1 py-0.5 text-[9px] leading-tight text-black/50"
                    style={{ top: (b.min - lo) * PX, height: Math.max(b.dur * PX, 16), background: "repeating-linear-gradient(45deg,#e5e5e5,#e5e5e5 4px,#f3f3f3 4px,#f3f3f3 8px)" }}>
                    🔒 {b.titulo}
                  </div>
                ))}
                {/* Nuestras reservas */}
                {dosNuestros.map((b) => {
                  const r = b.r;
                  const movible = r.estado === "pendiente" || r.estado === "confirmada";
                  const emp = r.empleadoId ? empMap[r.empleadoId] : undefined;
                  const est = ESTADO[r.estado];
                  const bg = r.tipo === "bloqueo" ? "#4b5563" : emp?.color || est.bg;
                  const fg = r.tipo === "bloqueo" ? "#fff" : emp?.color ? "#fff" : est.fg;
                  const arrastrando = ghost?.id === b.id;
                  return (
                    <div key={b.id}
                      onPointerDown={(e) => movible && startDrag(e, b, "move")}
                      onClick={() => !movible && onSelect(r)}
                      className={`absolute left-0.5 right-0.5 overflow-hidden border-2 border-black px-1 py-0.5 ${movible ? "cursor-grab active:cursor-grabbing" : "opacity-60 cursor-pointer"} ${arrastrando ? "ring-2 ring-black z-20 shadow-lg" : ""}`}
                      style={{ top: (b.min - lo) * PX, height: Math.max(b.dur * PX, 18), background: bg, color: fg, touchAction: "none" }}>
                      <div className="text-[9px] font-bold leading-none">{hhmm(b.min)}{r.estado === "completada" ? " ✓" : r.estado === "no_show" ? " ✗" : ""}</div>
                      <div className="text-[9px] leading-tight truncate">{r.tipo === "bloqueo" ? `⛔ ${r.nota || "Bloqueo"}` : (r.cliente?.nombre || r.servicioNombre)}</div>
                      {b.dur * PX > 34 && r.tipo !== "bloqueo" && <div className="text-[8px] leading-tight truncate opacity-80">{r.servicioNombre}</div>}
                      {/* Tirador de redimensionar */}
                      {movible && (
                        <div onPointerDown={(e) => startDrag(e, b, "resize")}
                          className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize bg-black/20 hover:bg-black/40"
                          style={{ touchAction: "none" }} title="Redimensionar" />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-black/40">Arrastra una cita para moverla de día/hora · tira del borde inferior para cambiar la duración · los bloques 🔒 en gris son eventos de tu Google Calendar (solo lectura).</p>
    </div>
  );
}

// -----------------------------------------------------------------------------
function Overlay({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-[color:var(--cream)] border-[3px] border-black w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-stencil text-2xl leading-none">{titulo}</h2>
          <button onClick={onClose} className="w-8 h-8 border-2 border-black font-bold hover:bg-black hover:text-white" aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
