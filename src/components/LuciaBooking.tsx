"use client";

// Formulario de reserva de cita para Lucía — usa la agenda central
// (Google Calendar read/write). Muestra slots libres calculados a partir
// del free-busy del día seleccionado y crea la cita en `primary`.

import { useEffect, useMemo, useState } from "react";

type Busy = { start: string; end: string };

const SLOT_MIN = 30;             // duración del slot por defecto
const DAY_START_H = 9;
const DAY_END_H = 19;            // último slot empieza a las 18:30

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoLocal(date: Date): string {
  // YYYY-MM-DDTHH:mm:ss sin tz — el endpoint lo trata como Europe/Madrid.
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildSlots(dayYmd: string, busy: Busy[]): { start: string; end: string; free: boolean }[] {
  const out: { start: string; end: string; free: boolean }[] = [];
  const [y, m, d] = dayYmd.split("-").map((n) => parseInt(n, 10));
  let cursor = new Date(y, m - 1, d, DAY_START_H, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d, DAY_END_H, 0, 0, 0);
  while (cursor < dayEnd) {
    const slotStart = new Date(cursor.getTime());
    const slotEnd = new Date(cursor.getTime() + SLOT_MIN * 60_000);
    const ovr = busy.some((b) => {
      const bs = new Date(b.start).getTime();
      const be = new Date(b.end).getTime();
      return bs < slotEnd.getTime() && be > slotStart.getTime();
    });
    out.push({
      start: isoLocal(slotStart),
      end: isoLocal(slotEnd),
      free: !ovr,
    });
    cursor = slotEnd;
  }
  return out;
}

export default function LuciaBooking({ connected }: { connected: boolean }) {
  const [day, setDay] = useState<string>(todayPlus(1));
  const [busy, setBusy] = useState<Busy[] | null>(null);
  const [loadingFb, setLoadingFb] = useState(false);
  const [fbError, setFbError] = useState("");

  const [selectedSlot, setSelectedSlot] = useState<string>(""); // start ISO local
  const [nombre, setNombre] = useState("");
  const [motivo, setMotivo] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string; link?: string } | null>(null);

  // Cargar free-busy del día seleccionado
  useEffect(() => {
    if (!connected) return;
    setBusy(null);
    setFbError("");
    setSelectedSlot("");
    setLoadingFb(true);
    const [y, m, d] = day.split("-").map((n) => parseInt(n, 10));
    const from = new Date(y, m - 1, d, 0, 0, 0).toISOString();
    const to = new Date(y, m - 1, d, 23, 59, 59).toISOString();
    fetch(`/api/lucia/calendar/free-busy?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setBusy(data.busy || []);
        else setFbError(data.error || "Error al cargar disponibilidad");
      })
      .catch((e) => setFbError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoadingFb(false));
  }, [day, connected]);

  const slots = useMemo(() => (busy ? buildSlots(day, busy) : []), [busy, day]);

  async function reservar() {
    if (!selectedSlot || !nombre.trim() || !motivo.trim()) {
      setFlash({ ok: false, msg: "Completa nombre, motivo y selecciona un hueco." });
      return;
    }
    setSubmitting(true);
    setFlash(null);
    try {
      const res = await fetch("/api/lucia/calendar/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          motivo: motivo.trim(),
          start: selectedSlot,
          durationMin: SLOT_MIN,
          agenteOrigen: "lucia",
          customerPhone: customerPhone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Error");
      setFlash({ ok: true, msg: "Cita reservada en tu calendario ✓", link: data.htmlLink });
      setSelectedSlot("");
      setNombre("");
      setMotivo("");
      setCustomerPhone("");
      // Refrescar disponibilidad
      const [y, m, d2] = day.split("-").map((n) => parseInt(n, 10));
      const from = new Date(y, m - 1, d2, 0, 0, 0).toISOString();
      const to = new Date(y, m - 1, d2, 23, 59, 59).toISOString();
      const fbRes = await fetch(`/api/lucia/calendar/free-busy?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const fbData = await fbRes.json();
      if (fbData.ok) setBusy(fbData.busy || []);
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!connected) {
    return (
      <div className="card-hard p-4 bg-[color:var(--cream)] text-sm">
        <div className="font-bold mb-1">📌 Reservar cita</div>
        <p className="text-xs text-black/60 leading-snug">
          Conecta tu Google Calendar para reservar citas desde aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="card-hard p-4">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
        <div>
          <h3 className="font-stencil text-xl">📌 Reservar cita</h3>
          <p className="text-xs text-black/60 leading-snug mt-0.5">
            Lucía crea la cita en tu calendario y la deja registrada para el informe mensual.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-black/60 mb-1">Día</label>
          <input
            type="date"
            value={day}
            min={todayPlus(0)}
            onChange={(e) => setDay(e.target.value)}
            className="w-full border-2 border-black px-2 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-black/60 mb-1">
            Slots disponibles ({SLOT_MIN} min · 9:00–19:00)
          </label>
          <div className="text-xs text-black/55">
            {loadingFb ? "Cargando…" : fbError ? <span className="text-[color:var(--red)]">{fbError}</span> : `${slots.filter((s) => s.free).length} libres de ${slots.length}`}
          </div>
        </div>
      </div>

      {/* Grid de slots */}
      {!loadingFb && !fbError && slots.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-1.5 mb-3">
          {slots.map((s) => {
            const time = s.start.slice(11, 16);
            const isSelected = selectedSlot === s.start;
            return (
              <button
                key={s.start}
                type="button"
                disabled={!s.free}
                onClick={() => setSelectedSlot(s.start)}
                className={`border-2 border-black px-1 py-1 text-[11px] font-mono font-bold ${
                  !s.free
                    ? "bg-black/15 text-black/40 line-through cursor-not-allowed"
                    : isSelected
                      ? "bg-black text-[color:var(--mustard)]"
                      : "bg-white hover:bg-[color:var(--mustard)]/40"
                }`}
              >
                {time}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="text"
          placeholder="Nombre del cliente *"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="border-2 border-black px-2 py-1.5 text-sm"
        />
        <input
          type="text"
          placeholder="Motivo de la cita *"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="border-2 border-black px-2 py-1.5 text-sm"
        />
        <input
          type="text"
          placeholder="Tel. (opcional)"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          className="border-2 border-black px-2 py-1.5 text-sm font-mono"
        />
      </div>

      <button
        onClick={reservar}
        disabled={submitting || !selectedSlot || !nombre.trim() || !motivo.trim()}
        className="btn-mustard text-sm mt-3 w-full disabled:opacity-50"
      >
        {submitting ? "Reservando…" : selectedSlot ? `📅 Reservar a las ${selectedSlot.slice(11, 16)}` : "📅 Selecciona un hueco para reservar"}
      </button>

      {flash && (
        <div className={`mt-3 p-2 border-2 border-black text-sm ${flash.ok ? "bg-green-200" : "bg-red-200"}`}>
          {flash.ok ? "✓" : "⚠"} {flash.msg}
          {flash.link && (
            <>
              {" · "}
              <a href={flash.link} target="_blank" rel="noopener noreferrer" className="underline font-bold">
                Ver en Google Calendar →
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
