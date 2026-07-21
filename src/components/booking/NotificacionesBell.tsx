"use client";

// Campanita de notificaciones del dueño (panel Biz). Deriva los eventos de los
// BookingRecord vía /api/booking/[slug]/notificaciones (nueva/cancelada/reprogramada,
// últimas 2 semanas). Badge = no leídas; al abrir el panel se marcan como leídas.

import { useCallback, useEffect, useRef, useState } from "react";

type NotifTipo = "nueva" | "cancelada" | "reprogramada";
type Notif = { id: string; tipo: NotifTipo; recordId: string; cliente: string; servicio: string; citaIso: string; citaDia: string; eventoIso: string };

const META: Record<NotifTipo, { icono: string; label: string; color: string }> = {
  nueva: { icono: "🟢", label: "Nueva cita", color: "var(--olive,#5A6B3F)" },
  cancelada: { icono: "🔴", label: "Cita cancelada", color: "var(--red)" },
  reprogramada: { icono: "🔄", label: "Cita reprogramada", color: "#8a7500" },
};

function haceCuanto(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return "ahora mismo";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24); return `hace ${d} día${d === 1 ? "" : "s"}`;
}
function fechaCitaCorta(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return iso.slice(0, 10);
  return `${m[3]}/${m[2]} · ${m[4]}:${m[5]}`;
}

export default function NotificacionesBell({ slug, onIrACita }: { slug: string; onIrACita: (dia: string) => void }) {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [cargado, setCargado] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/booking/${slug}/notificaciones`, { cache: "no-store" });
      const j = await r.json();
      if (j.ok) { setNotifs(j.notificaciones as Notif[]); setNoLeidas(j.noLeidas as number); }
    } catch { /* */ }
    finally { setCargado(true); }
  }, [slug]);

  // Carga inicial + al cambiar de negocio + refresco periódico (60 s).
  useEffect(() => {
    setCargado(false); setAbierto(false); cargar();
    const t = setInterval(cargar, 60_000);
    return () => clearInterval(t);
  }, [cargar]);

  // Cerrar al tocar fuera.
  useEffect(() => {
    if (!abierto) return;
    function fuera(e: Event) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false); }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("touchstart", fuera);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("touchstart", fuera); };
  }, [abierto]);

  async function abrir() {
    const nuevo = !abierto;
    setAbierto(nuevo);
    if (nuevo && noLeidas > 0) {
      setNoLeidas(0); // optimista
      try { await fetch(`/api/booking/${slug}/notificaciones`, { method: "POST" }); } catch { /* */ }
    }
  }

  if (!cargado) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={abrir}
        aria-label={`Notificaciones${noLeidas ? ` (${noLeidas} sin leer)` : ""}`}
        aria-expanded={abierto}
        className={`relative w-10 h-10 border-[3px] border-black flex items-center justify-center text-lg ${abierto ? "bg-black text-[color:var(--mustard)]" : "bg-white hover:bg-[color:var(--cream)]"}`}
      >
        🔔
        {noLeidas > 0 && (
          <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 border-2 border-black bg-[color:var(--red)] text-white text-[11px] font-bold leading-none flex items-center justify-center">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 mt-2 z-40 w-[min(92vw,340px)] card-hard bg-white max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 bg-[color:var(--cream)] border-b-[3px] border-black sticky top-0">
            <span className="font-stencil text-lg leading-none">Novedades</span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-black/40">últimas 2 sem.</span>
          </div>
          {notifs.length === 0 ? (
            <div className="p-6 text-center text-sm text-black/50">
              <div className="text-3xl mb-2">🔕</div>
              Sin novedades por ahora.
            </div>
          ) : (
            <ul>
              {notifs.map((n) => {
                const m = META[n.tipo];
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => { onIrACita(n.citaDia); setAbierto(false); }}
                      className="w-full text-left px-3 py-2.5 border-b-2 border-black/10 hover:bg-[color:var(--cream)] flex gap-2.5"
                    >
                      <span aria-hidden className="shrink-0 leading-none mt-0.5">{m.icono}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold leading-snug" style={{ color: m.color }}>
                          {m.label} <span className="text-black">· {n.cliente}</span>
                        </span>
                        <span className="block text-xs text-black/55 truncate">{n.servicio} · {fechaCitaCorta(n.citaIso)}</span>
                        <span className="block text-[11px] font-mono text-black/40">{haceCuanto(n.eventoIso)}</span>
                      </span>
                      <span aria-hidden className="shrink-0 text-[color:var(--red)] font-bold self-center">›</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
