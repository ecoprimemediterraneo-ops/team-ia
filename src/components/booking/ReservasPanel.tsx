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

const TABS = ["agenda", "clientes", "informes", "compartir", "config"] as const;
type Tab = (typeof TABS)[number];

function esTab(v: string | undefined): v is Tab {
  return !!v && (TABS as readonly string[]).includes(v);
}

/**
 * `negocioInicial` / `tabInicial` / `mesInicial` vienen de la query string
 * (?negocio=&tab=&mes=), que resuelve la página servidor. Los usa el botón del
 * informe mensual para abrir el panel YA en el negocio, la pestaña y el mes de
 * ese informe: antes el enlace caía siempre en Agenda con el primer negocio de
 * la lista, que no tenía por qué ser el del correo.
 *
 * Solo son valores INICIALES: en cuanto el usuario cambia de pestaña o de
 * negocio manda su elección, no la URL.
 */
export default function ReservasPanel({
  negocios,
  negocioInicial,
  tabInicial,
  mesInicial,
  vocabulario,
}: {
  negocios: BusinessBooking[];
  negocioInicial?: string;
  tabInicial?: string;
  mesInicial?: string;
  /** Palabras del sector. Sin ellas se usan las genéricas de siempre. */
  vocabulario?: { clientePlural: string; servicioPlural: string; citaPlural: string };
}) {
  // Las etiquetas de las pestañas hablan el idioma del negocio: un despacho no
  // tiene "clientes" a secas ni "servicios", tiene clientes del despacho y materias.
  const vv = vocabulario;
  const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
  const ETIQUETAS: Record<Tab, string> = {
    agenda: "Agenda",
    clientes: vv ? cap(vv.clientePlural) : "Clientes",
    informes: "Informes",
    compartir: "Compartir",
    config: vv ? `${cap(vv.servicioPlural)} y horario` : "Servicios y horario",
  };
  const [tab, setTab] = useState<Tab>(esTab(tabInicial) ? tabInicial : "agenda");
  // Slug desconocido (o ausente) → primer negocio, como hasta ahora.
  const [idx, setIdx] = useState(() => {
    const i = negocios.findIndex((n) => n.slug === negocioInicial);
    return i >= 0 ? i : 0;
  });
  const b = negocios[idx] || negocios[0];
  // Al pulsar una notificación → ir a la AGENDA en el día de esa cita. El nonce fuerza
  // la navegación aunque se pulse el mismo día dos veces.
  const [agendaTarget, setAgendaTarget] = useState<{ dia: string; n: number } | null>(null);
  function irACita(dia: string) { setTab("agenda"); setAgendaTarget((p) => ({ dia, n: (p?.n ?? 0) + 1 })); }

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="inline-flex border-[3px] border-black">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-bold uppercase tracking-widest ${tab === t ? "bg-black text-white" : "bg-white hover:bg-[color:var(--cream)]"}`}
            >
              {ETIQUETAS[t]}
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
        <InformesView slug={b.slug} mesInicial={mesInicial} />
      ) : tab === "compartir" ? (
        <CompartirEnlace slug={b.slug} nombre={b.nombre} />
      ) : (
        <OwnerConfig negocios={negocios} />
      )}
    </div>
  );
}
