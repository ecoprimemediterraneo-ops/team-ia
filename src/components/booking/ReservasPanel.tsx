"use client";

// Panel del negocio (Biz): pestañas Agenda (pantalla principal, estilo Booksy) y
// Servicios y horario (configuración). Reutiliza OwnerConfig para la config.
import { useState } from "react";
import type { BusinessBooking } from "@/lib/booking";
import AgendaView from "./AgendaView";
import AgendaObligaciones from "../gestoria/AgendaObligaciones";
import ClientesView from "./ClientesView";
import InformesView from "./InformesView";
import OwnerConfig from "./OwnerConfig";
import CompartirEnlace from "./CompartirEnlace";
import NotificacionesBell from "./NotificacionesBell";

// El ORDEN de esta lista es el orden de las pestañas en pantalla. "informes" va
// la última a propósito: es la que se consulta una vez al mes, no a diario.
//
// OJO — la CLAVE `informes` no se toca aunque cambie la etiqueta: es la que
// viaja en la query string (?tab=informes) y la que construye el botón del email
// mensual (`urlPanelInformes` en informe-unificado.ts). Renombrar la clave
// rompería el enlace de todos los correos ya enviados.
const TABS = ["agenda", "clientes", "compartir", "config", "informes"] as const;
type Tab = (typeof TABS)[number];

/**
 * Las pestañas que NO tiene sentido enseñarle a una gestoría.
 *
 * "Compartir" da un enlace público para que la gente pida cita; "Trámites y
 * horario" configura servicios y franjas horarias; "Informes mensuales" cuenta
 * reservas y no-shows. Las tres son del módulo de peluquería, donde sí sirven.
 * Un gestor no tiene enlace de reservas ni horario de atención por franjas, y
 * cada pestaña que sobra es una que hay que abrir para descubrir que no era.
 *
 * Se quitan SOLO en gestoría: peluquerías, clínicas y restaurantes las siguen
 * viendo exactamente igual.
 */
const TABS_FUERA_EN_GESTORIA: Tab[] = ["compartir", "config", "informes"];

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
  esGestoria,
}: {
  negocios: BusinessBooking[];
  negocioInicial?: string;
  tabInicial?: string;
  mesInicial?: string;
  /** Palabras del sector. Sin ellas se usan las genéricas de siempre. */
  vocabulario?: { clientePlural: string; servicioPlural: string; citaPlural: string };
  /**
   * En gestoría la pestaña de agenda enseña VENCIMIENTOS, no citas: fechas
   * límite legales, requerimientos y reclamaciones. La agenda de franjas
   * horarias sigue intacta para peluquerías y clínicas, que sí dan citas.
   */
  esGestoria?: boolean;
}) {
  // Las etiquetas de las pestañas hablan el idioma del negocio: una gestoría no
  // tiene "clientes" a secas ni "servicios", tiene clientes de la gestoría y trámites.
  const vv = vocabulario;
  const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
  const ETIQUETAS: Record<Tab, string> = {
    // En una gestoría la pestaña no enseña citas: enseña fechas límite legales.
    agenda: esGestoria ? "Vencimientos" : "Agenda",
    clientes: vv ? cap(vv.clientePlural) : "Clientes",
    compartir: "Compartir",
    config: vv ? `${cap(vv.servicioPlural)} y horario` : "Servicios y horario",
    informes: "Informes mensuales",
  };
  // Si llega ?tab=informes en una gestoría —de un enlace viejo de un email— se
  // cae a la agenda en vez de pintar una pestaña que ya no está en la tira.
  const [tab, setTab] = useState<Tab>(() => {
    if (!esTab(tabInicial)) return "agenda";
    if (esGestoria && TABS_FUERA_EN_GESTORIA.includes(tabInicial)) return "agenda";
    return tabInicial;
  });
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
        {/* La tira medía 586 px de ancho fijo: en un móvil de 375 el `overflow-x:hidden`
            del body se comía las últimas pestañas — no se recortaban a medias, es que no
            se podían pulsar. Y al mandar "Informes mensuales" al final, la que quedaba
            fuera era justo esa.
            Solo se toca por DEBAJO de `md` (`max-md:`): dejándolo suelto, en escritorio la
            tira también envolvía a dos filas, que antes no hacía. Ahí sigue en una sola. */}
        <div className="inline-flex border-[3px] border-black max-md:flex-wrap max-md:max-w-full">
          {TABS.filter((t) => !(esGestoria && TABS_FUERA_EN_GESTORIA.includes(t))).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              // `max-md:grow`: al envolver en móvil, cada fila se reparte el ancho entero
              // en vez de dejar el escalón irregular que queda si cada botón mide lo que
              // ocupa su texto. En escritorio, sin efecto.
              className={`max-md:grow px-4 py-2 text-sm font-bold uppercase tracking-widest ${tab === t ? "bg-black text-white" : "bg-white hover:bg-[color:var(--cream)]"}`}
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
        esGestoria ? (
          <AgendaObligaciones />
        ) : (
          <AgendaView slug={b.slug} nombre={b.nombre} timezone={b.timezone} servicios={b.servicios} empleados={b.empleados || []} target={agendaTarget} />
        )
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
