"use client";

// Panel del negocio (Biz): pestañas Agenda (pantalla principal, estilo Booksy) y
// Servicios y horario (configuración). Reutiliza OwnerConfig para la config.
import { useState } from "react";
import type { BusinessBooking } from "@/lib/booking";
import AgendaView from "./AgendaView";
import ClientesView from "./ClientesView";
import InformesView from "./InformesView";
import OwnerConfig from "./OwnerConfig";
import CompartirEnlace from "./CompartirEnlace";
import NotificacionesBell from "./NotificacionesBell";

export default function ReservasPanel({ negocios }: { negocios: BusinessBooking[] }) {
  const [tab, setTab] = useState<"agenda" | "clientes" | "informes" | "compartir" | "config">("agenda");
  const [idx, setIdx] = useState(0);
  const b = negocios[idx] || negocios[0];
  // Al pulsar una notificación → ir a la AGENDA en el día de esa cita. El nonce fuerza
  // la navegación aunque se pulse el mismo día dos veces.
  const [agendaTarget, setAgendaTarget] = useState<{ dia: string; n: number } | null>(null);
  function irACita(dia: string) { setTab("agenda"); setAgendaTarget((p) => ({ dia, n: (p?.n ?? 0) + 1 })); }

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="inline-flex border-[3px] border-black">
          {([["agenda", "Agenda"], ["clientes", "Clientes"], ["informes", "Informes"], ["compartir", "Compartir"], ["config", "Servicios y horario"]] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-bold uppercase tracking-widest ${tab === t ? "bg-black text-white" : "bg-white hover:bg-[color:var(--cream)]"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {negocios.length > 1 && tab !== "config" && (
          <select value={idx} onChange={(e) => setIdx(+e.target.value)} className="card-hard px-3 py-2 bg-white text-sm">
            {negocios.map((n, i) => <option key={n.slug} value={i}>{n.nombre}</option>)}
          </select>
        )}
        <div className="ml-auto"><NotificacionesBell slug={b.slug} onIrACita={irACita} /></div>
      </div>

      {tab === "agenda" ? (
        <AgendaView slug={b.slug} nombre={b.nombre} timezone={b.timezone} servicios={b.servicios} empleados={b.empleados || []} target={agendaTarget} />
      ) : tab === "clientes" ? (
        <ClientesView slug={b.slug} />
      ) : tab === "informes" ? (
        <InformesView slug={b.slug} />
      ) : tab === "compartir" ? (
        <CompartirEnlace slug={b.slug} nombre={b.nombre} />
      ) : (
        <OwnerConfig negocios={negocios} />
      )}
    </div>
  );
}
