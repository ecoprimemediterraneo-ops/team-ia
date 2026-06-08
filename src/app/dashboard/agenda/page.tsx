"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { agents, type AgentSlug } from "@/lib/agents";

type Cita = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink?: string;
  agenteOrigen: string | null;
  nombre: string | null;
  motivo: string | null;
};

type AgendaResponse =
  | { ok: true; citas: Cita[]; kpis: { semana: number; mes: number; total: number }; timezone: string }
  | { ok: false; reason?: string; error?: string; hint?: string };

const AGENT_COLOR: Record<string, string> = Object.fromEntries(
  agents.map((a) => [a.slug, a.color]),
);
const AGENT_NAME: Record<string, string> = Object.fromEntries(
  agents.map((a) => [a.slug, a.name]),
);

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function fmtDayHeader(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "HOY";
  if (day.getTime() === tomorrow.getTime()) return "MAÑANA";
  return day.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function AgentBadge({ slug }: { slug: string | null }) {
  if (!slug) return (
    <span className="inline-block text-[10px] font-bold uppercase tracking-widest border-2 border-black px-1.5 py-0.5 bg-white">
      Manual
    </span>
  );
  const color = AGENT_COLOR[slug] || "#ddd";
  const name = AGENT_NAME[slug] || slug;
  return (
    <span
      className="inline-block text-[10px] font-bold uppercase tracking-widest border-2 border-black px-1.5 py-0.5"
      style={{ background: color }}
    >
      {name}
    </span>
  );
}

export default function AgendaPage() {
  const [data, setData] = useState<AgendaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"lista" | "semana">("lista");
  const [weekRef, setWeekRef] = useState<Date>(() => startOfWeek(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/agenda", { cache: "no-store" });
      const j = (await r.json()) as AgendaResponse;
      setData(j);
    } catch (e) {
      setData({ ok: false, error: e instanceof Error ? e.message : "Error de red" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    if (!data?.ok) return [];
    const map = new Map<string, { date: Date; items: Cita[] }>();
    for (const c of data.citas) {
      const k = dayKey(c.start);
      if (!map.has(k)) map.set(k, { date: new Date(c.start), items: [] });
      map.get(k)!.items.push(c);
    }
    return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-stencil text-4xl leading-none">AGENDA</h1>
          <p className="text-sm text-black/60 mt-1">Tus citas en Google Calendar — creadas por tu equipo de agentes.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView("lista")}
            className={`text-xs uppercase tracking-widest font-bold border-2 border-black px-3 py-1.5 ${view === "lista" ? "bg-black text-white" : "bg-white hover:bg-[color:var(--mustard)]/40"}`}
          >
            Lista
          </button>
          <button
            type="button"
            onClick={() => setView("semana")}
            className={`text-xs uppercase tracking-widest font-bold border-2 border-black px-3 py-1.5 ${view === "semana" ? "bg-black text-white" : "bg-white hover:bg-[color:var(--mustard)]/40"}`}
          >
            Semana
          </button>
          <button
            type="button"
            onClick={load}
            className="text-xs uppercase tracking-widest font-bold border-2 border-black px-3 py-1.5 bg-white hover:bg-[color:var(--mustard)]/40"
            title="Recargar"
          >
            ↻
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-hard p-3 bg-white">
          <div className="text-[10px] uppercase tracking-widest text-black/60">Esta semana</div>
          <div className="font-stencil text-3xl">{data?.ok ? data.kpis.semana : "—"}</div>
        </div>
        <div className="card-hard p-3 bg-white">
          <div className="text-[10px] uppercase tracking-widest text-black/60">Este mes</div>
          <div className="font-stencil text-3xl">{data?.ok ? data.kpis.mes : "—"}</div>
        </div>
        <div className="card-hard p-3" style={{ background: "var(--mustard)" }}>
          <div className="text-[10px] uppercase tracking-widest text-black/70">Próx. 30 días</div>
          <div className="font-stencil text-3xl">{data?.ok ? data.kpis.total : "—"}</div>
        </div>
      </div>

      {/* Estados */}
      {loading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card-hard p-4 bg-white animate-pulse">
              <div className="h-3 w-24 bg-black/10 mb-2" />
              <div className="h-5 w-2/3 bg-black/10" />
            </div>
          ))}
        </div>
      )}

      {!loading && data && !data.ok && (
        <div className="card-hard p-4 bg-red-50 border-red-700">
          <div className="font-bold uppercase tracking-widest text-sm text-red-800 mb-1">
            No se pudo leer la agenda
          </div>
          <div className="text-sm text-black/80 mb-2">{data.hint || data.error}</div>
          <a href="/dashboard/lucia" className="inline-block text-xs uppercase tracking-widest font-bold border-2 border-black px-3 py-1.5 bg-white hover:bg-[color:var(--mustard)]/40">
            Reconectar Google →
          </a>
        </div>
      )}

      {!loading && data?.ok && data.citas.length === 0 && (
        <div className="card-hard p-6 bg-white text-center">
          <div className="text-5xl mb-2">📅</div>
          <div className="font-bold uppercase tracking-widest text-sm mb-1">Sin citas próximas</div>
          <div className="text-sm text-black/60">
            Cuando Pablo, Carmen o Eva agenden una cita, aparecerá aquí.
          </div>
        </div>
      )}

      {/* VISTA LISTA */}
      {!loading && data?.ok && data.citas.length > 0 && view === "lista" && (
        <div className="space-y-4">
          {grouped.map((g) => (
            <div key={g.date.toISOString()}>
              <div className="text-xs font-mono uppercase tracking-widest text-black/60 mb-1.5 px-1">
                {fmtDayHeader(g.date)}
              </div>
              <div className="space-y-2">
                {g.items.map((c) => (
                  <div key={c.id} className="card-hard p-3 bg-white flex gap-3 items-start">
                    <div className="text-center min-w-[60px] border-r-2 border-black/20 pr-3">
                      <div className="font-stencil text-xl leading-none">
                        {c.allDay ? "·" : fmtTime(c.start)}
                      </div>
                      {!c.allDay && (
                        <div className="text-[10px] text-black/50 mt-0.5">{fmtTime(c.end)}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <AgentBadge slug={c.agenteOrigen} />
                        {c.location && (
                          <span className="text-[10px] text-black/50 truncate">📍 {c.location}</span>
                        )}
                      </div>
                      <div className="font-bold truncate">{c.nombre || c.summary}</div>
                      {(c.motivo || c.description) && (
                        <div className="text-xs text-black/60 line-clamp-2">
                          {c.motivo || c.description}
                        </div>
                      )}
                    </div>
                    {c.htmlLink && (
                      <a
                        href={c.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] uppercase tracking-widest font-bold border-2 border-black px-2 py-1 bg-white hover:bg-[color:var(--mustard)]/40 self-center"
                      >
                        Calendar ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VISTA SEMANA */}
      {!loading && data?.ok && view === "semana" && (
        <WeekView
          citas={data.citas}
          weekStart={weekRef}
          onPrev={() => setWeekRef(addDays(weekRef, -7))}
          onNext={() => setWeekRef(addDays(weekRef, 7))}
          onToday={() => setWeekRef(startOfWeek(new Date()))}
        />
      )}
    </div>
  );
}

function WeekView({
  citas, weekStart, onPrev, onNext, onToday,
}: {
  citas: Cita[];
  weekStart: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const HOURS = Array.from({ length: 12 }, (_, i) => 9 + i); // 9..20
  const rangeEnd = addDays(weekStart, 7);

  const inWeek = citas.filter((c) => {
    const t = new Date(c.start).getTime();
    return t >= weekStart.getTime() && t < rangeEnd.getTime();
  });

  const label = `${weekStart.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – ${addDays(weekStart, 6).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;

  return (
    <div className="card-hard p-3 bg-white overflow-x-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="font-stencil text-lg">{label}</div>
        <div className="flex gap-1">
          <button onClick={onPrev} className="text-xs uppercase tracking-widest font-bold border-2 border-black px-2 py-1 bg-white hover:bg-[color:var(--mustard)]/40">←</button>
          <button onClick={onToday} className="text-xs uppercase tracking-widest font-bold border-2 border-black px-2 py-1 bg-white hover:bg-[color:var(--mustard)]/40">Hoy</button>
          <button onClick={onNext} className="text-xs uppercase tracking-widest font-bold border-2 border-black px-2 py-1 bg-white hover:bg-[color:var(--mustard)]/40">→</button>
        </div>
      </div>
      <div className="min-w-[700px] grid" style={{ gridTemplateColumns: "50px repeat(7, 1fr)" }}>
        <div />
        {days.map((d) => {
          const isToday = new Date().toDateString() === d.toDateString();
          return (
            <div key={d.toISOString()} className={`text-center text-xs border-b-2 border-black pb-1 ${isToday ? "bg-[color:var(--mustard)]/40" : ""}`}>
              <div className="uppercase tracking-widest text-black/60">{d.toLocaleDateString("es-ES", { weekday: "short" })}</div>
              <div className="font-stencil text-lg leading-none">{d.getDate()}</div>
            </div>
          );
        })}

        {HOURS.map((h) => (
          <FragmentRow key={h} hour={h} days={days} citas={inWeek} />
        ))}
      </div>
    </div>
  );
}

function FragmentRow({ hour, days, citas }: { hour: number; days: Date[]; citas: Cita[] }) {
  return (
    <>
      <div className="text-[10px] text-black/50 text-right pr-1 border-r-2 border-black/10 h-14">
        {String(hour).padStart(2, "0")}:00
      </div>
      {days.map((d) => {
        const slotStart = new Date(d); slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(d); slotEnd.setHours(hour + 1, 0, 0, 0);
        const hits = citas.filter((c) => {
          const t = new Date(c.start).getTime();
          return t >= slotStart.getTime() && t < slotEnd.getTime();
        });
        return (
          <div key={d.toISOString() + hour} className="border border-black/10 h-14 p-0.5 text-[10px] overflow-hidden">
            {hits.map((c) => {
              const color = c.agenteOrigen ? AGENT_COLOR[c.agenteOrigen] : "#fff";
              return (
                <a
                  key={c.id}
                  href={c.htmlLink || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="block border-2 border-black px-1 py-0.5 mb-0.5 truncate font-bold hover:-translate-y-0.5 transition"
                  style={{ background: color || "#fff" }}
                  title={`${c.nombre || c.summary} — ${c.motivo || ""}`}
                >
                  {fmtTime(c.start)} {c.nombre || c.summary}
                </a>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
