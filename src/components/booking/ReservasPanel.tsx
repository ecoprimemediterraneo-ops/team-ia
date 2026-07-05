"use client";

// Panel del negocio (Biz): pestañas Agenda (pantalla principal, estilo Booksy) y
// Servicios y horario (configuración). Reutiliza OwnerConfig para la config.
import { useState } from "react";
import type { BusinessBooking } from "@/lib/booking";
import AgendaView from "./AgendaView";
import ClientesView from "./ClientesView";
import InformesView from "./InformesView";
import OwnerConfig from "./OwnerConfig";

export default function ReservasPanel({ negocios }: { negocios: BusinessBooking[] }) {
  const [tab, setTab] = useState<"agenda" | "clientes" | "informes" | "config">("agenda");
  const [idx, setIdx] = useState(0);
  const b = negocios[idx] || negocios[0];

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="inline-flex border-[3px] border-black">
          {([["agenda", "Agenda"], ["clientes", "Clientes"], ["informes", "Informes"], ["config", "Servicios y horario"]] as const).map(([t, label]) => (
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
      </div>

      {tab === "agenda" ? (
        <AgendaView slug={b.slug} nombre={b.nombre} timezone={b.timezone} servicios={b.servicios} empleados={b.empleados || []} />
      ) : tab === "clientes" ? (
        <ClientesView slug={b.slug} />
      ) : tab === "informes" ? (
        <InformesView slug={b.slug} />
      ) : (
        <OwnerConfig negocios={negocios} />
      )}
    </div>
  );
}
