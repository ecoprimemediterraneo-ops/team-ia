"use client";
import { useEffect, useState } from "react";

type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
};

export default function LuciaCalendar() {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/lucia/calendar")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else if (!d.connected) setEvents(null);
        else setEvents(d.events);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (error) return null; // silent fail
  if (events === null) return null; // not connected, hide

  // Agrupar por día
  const byDay: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    const day = e.start.slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(e);
  }

  function formatTime(iso: string) {
    if (iso.length === 10) return "Todo el día";
    try {
      return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  }

  function formatDay(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "HOY";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return "MAÑANA";
    return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" }).toUpperCase();
  }

  return (
    <div className="card-hard p-4 mt-3">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="font-stencil text-xl">📅 Tu agenda esta semana</h3>
          <p className="text-sm text-black/60 mt-1">Eventos de Google Calendar (lectura). Próximos 7 días.</p>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-black/50 italic py-4">No tienes eventos en los próximos 7 días.</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(byDay).slice(0, 7).map(([day, evts]) => (
            <div key={day}>
              <div className="font-stencil text-sm text-[color:var(--red)] mb-1">{formatDay(day)}</div>
              <ul className="space-y-1">
                {evts.map((e) => (
                  <li key={e.id} className="text-sm border-l-4 border-[color:var(--mustard)] pl-2 py-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-black/60 w-12 shrink-0">{formatTime(e.start)}</span>
                      <span className="font-bold">{e.summary}</span>
                    </div>
                    {e.location && <div className="text-xs text-black/50 ml-14">📍 {e.location}</div>}
                    {e.attendees && e.attendees.length > 0 && (
                      <div className="text-xs text-black/50 ml-14">👥 {e.attendees.length} asistente{e.attendees.length === 1 ? "" : "s"}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
