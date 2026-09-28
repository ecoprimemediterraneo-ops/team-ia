"use client";
import { esSi, esNo } from "@/lib/chat-honesto";

// EL MARCO FIJO DE DENTAL — mismo molde que `PanelGestoriaShell.tsx`: dos
// bloques `position: sticky` apilados (la cabecera del sitio, con
// `sticky top-0` solo para dental — ver `dashboard/layout.tsx` — y este
// bloque, con `sticky top-<alto medido de la cabecera>`), el hilo de la
// conversación en la zona que hace scroll, y NADA fijo por altura de
// viewport: por eso no se mueve nunca, ver la nota larga en
// `PanelGestoriaShell.tsx` sobre por qué la versión anterior de gestoría sí
// se movía y esta no.
//
// DIFERENCIAS CON GESTORÍA, a propósito:
//   - Sin selector de cliente: la auditoría no lo pedía para dental, y cada
//     paciente se busca desde la propia pestaña de Pacientes.
//   - Pestañas propias (`PestanasDental`): Hoy / Agenda / Pacientes /
//     Presupuestos y revisiones / Reseñas — nada de Correo importante ni
//     Facturas, que es vocabulario de gestoría.
//   - El chat habla con `/api/dental/preguntar` y `/api/dental/portada`, no
//     con los de gestoría: son datos y herramientas distintos
//     (`dental-consulta.ts`). SÍ hay "confirmar" — mismo mecanismo que
//     gestoría: crear cita, apuntar presupuesto, cambiarle el estado o marcar
//     un aviso de revisión se PROPONEN primero y solo se ejecutan al pulsar
//     "Sí, hazlo".

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PestanasDental from "./PestanasDental";
import BarraChat, { type Urgente } from "@/components/gestoria/BarraChat";
import type { AccionPendiente } from "@/lib/dental-acciones";

type Turno = {
  rol: "usuario" | "secretaria";
  texto: string;
  acciones?: { texto: string; href: string }[];
  /** Lo que el chat propone hacer y espera un sí. Solo el ÚLTIMO turno lo pinta. */
  pendiente?: { resumen: string; accion: AccionPendiente } | null;
};

const CLAVE_HILO = (tenantId: string) => `aiteam:dental:hilo:${tenantId}`;
const CLAVE_DIA = (tenantId: string, dia: string) => `aiteam:dental:hilo:${tenantId}:${dia}`;
function hoyMadrid(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
}
type HiloGuardado = { dia: string; turnos: Turno[] };

const EJEMPLOS = ["¿Hay alguna urgencia?", "¿Qué citas tengo hoy?", "¿A quién le toca revisión?"];

export default function PanelDentalShell({
  tenantNombre,
  agente = "Pablo · recepción de la clínica",
  tenantId,
  children,
}: {
  tenantNombre: string;
  agente?: string;
  tenantId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  // Fuerza el REMONTADO del panel central tras una acción del chat. No basta
  // con `router.refresh()`: eso vuelve a pedir los datos del server component
  // de la pestaña, pero un componente cliente que ya estaba montado (la
  // agenda semanal, la ficha de pacientes…) puede quedarse con sus props
  // viejas si React decide reutilizar la instancia en vez de recrearla —
  // exactamente lo que le pasaba a `PresupuestosPanel`. Cambiando la `key`
  // del contenedor, React desmonta y vuelve a montar TODO lo de dentro con
  // los datos frescos, sin tocar nada de fuera (cabecera, pestañas, chat).
  const [refreshKey, setRefreshKey] = useState(0);
  const [altoCabecera, setAltoCabecera] = useState(0);
  useEffect(() => {
    const el = document.getElementById("cabecera-ai-team");
    if (!el) return;
    const medir = () => setAltoCabecera(el.getBoundingClientRect().height);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [urgente, setUrgente] = useState<Urgente>(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await fetch("/api/dental/portada").catch(() => null);
      const j = r ? await r.json().catch(() => null) : null;
      if (vivo && j?.ok) setUrgente(j.urgente);
    })();
    return () => { vivo = false; };
  }, []);

  const [hilo, setHilo] = useState<Turno[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const cargado = useRef(false);

  useEffect(() => {
    let vivo = true;
    queueMicrotask(() => {
      if (!vivo) return;
      try {
        const crudo = localStorage.getItem(CLAVE_HILO(tenantId));
        if (crudo) {
          const leido = JSON.parse(crudo) as HiloGuardado | Turno[];
          const esViejo = Array.isArray(leido);
          const dia = esViejo ? "antiguo" : leido.dia;
          const turnos = esViejo ? leido : leido.turnos;
          if (dia === hoyMadrid()) setHilo(turnos);
          else if (turnos.length) {
            try { localStorage.setItem(CLAVE_DIA(tenantId, dia), JSON.stringify(turnos)); } catch { /* cuota llena */ }
          }
        }
      } catch { /* se empieza de cero */ }
      cargado.current = true;
    });
    return () => { vivo = false; };
  }, [tenantId]);

  useEffect(() => {
    if (!cargado.current) return;
    try {
      const guardar: HiloGuardado = { dia: hoyMadrid(), turnos: hilo.slice(-40) };
      localStorage.setItem(CLAVE_HILO(tenantId), JSON.stringify(guardar));
    } catch { /* cuota llena: se sigue funcionando, solo que sin guardar */ }
  }, [hilo, tenantId]);

  useEffect(() => {
    if (!hilo.length) return;
    const caja = finRef.current?.parentElement;
    if (caja) caja.scrollTop = caja.scrollHeight;
  }, [hilo, pensando]);

  async function enviar(pregunta: string) {
    const q = pregunta.trim();
    if (!q || pensando) return;
    setTexto("");
    // Un "sí" / "no" escrito, con una propuesta a la vista, hace lo MISMO que el
    // botón (y nunca pasa por el modelo, que se inventaba el "hecho").
    const ultimo = hilo[hilo.length - 1];
    if (ultimo?.pendiente && (esSi(q) || esNo(q))) {
      setHilo((h) => [...h, { rol: "usuario", texto: q }]);
      if (esSi(q)) void confirmar(ultimo); else descartar(ultimo);
      return;
    }
    const previo = hilo;
    setHilo([...previo, { rol: "usuario", texto: q }]);
    setPensando(true);
    try {
      const res = await fetch("/api/dental/preguntar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: q, historial: previo.map((t) => ({ rol: t.rol, texto: t.texto })) }),
      });
      const j = await res.json();
      setHilo((h) => [
        ...h,
        j.error
          ? { rol: "secretaria", texto: j.error }
          : { rol: "secretaria", texto: j.texto, acciones: j.acciones ?? [], pendiente: j.pendiente ?? null },
      ]);
    } catch {
      setHilo((h) => [...h, { rol: "secretaria", texto: "No he podido contestar. Inténtalo otra vez." }]);
    } finally {
      setPensando(false);
    }
  }

  /** El "sí" del dueño. Es lo ÚNICO que cambia datos desde esta pantalla. */
  async function confirmar(t: Turno) {
    if (!t.pendiente || confirmando) return;
    setConfirmando(true);
    try {
      const res = await fetch("/api/dental/preguntar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmar: t.pendiente.accion }),
      });
      const j = await res.json();
      setHilo((h) => [
        // La propuesta se apaga en el turno donde estaba: así el botón no se
        // queda vivo invitando a hacerlo dos veces.
        ...h.map((x) => (x === t ? { ...x, pendiente: null } : x)),
        { rol: "secretaria", texto: j.texto || j.error || "Hecho." },
      ]);
      // REFRESCO SOLO DEL CONTENIDO CENTRAL, en dos pasos que hacen falta los
      // dos: `router.refresh()` vuelve a pedir los datos del server
      // component de la pestaña abierta (Hoy, Agenda, Pacientes,
      // Presupuestos y revisiones…), y cambiar `refreshKey` obliga a
      // remontar ese contenido para que un componente cliente que ya estaba
      // vivo (la agenda semanal, la ficha de pacientes) vuelva a pedir sus
      // propios datos en vez de quedarse con los que tenía cuando se montó.
      // Nada de esto toca este componente, que vive en el layout: el hilo
      // del chat no se entera. Antes había que pulsar F5 a mano para ver la
      // cita o el presupuesto recién creados en su tabla.
      if (j.ok !== false) {
        router.refresh();
        setRefreshKey((k) => k + 1);
      }
    } catch {
      setHilo((h) => [...h, { rol: "secretaria", texto: "No he podido hacerlo. Inténtalo otra vez." }]);
    } finally {
      setConfirmando(false);
    }
  }

  function descartar(t: Turno) {
    setHilo((h) => [
      ...h.map((x) => (x === t ? { ...x, pendiente: null } : x)),
      { rol: "secretaria", texto: "Vale, lo dejo como estaba." },
    ]);
  }

  function vaciar() {
    setHilo([]);
    try { localStorage.removeItem(CLAVE_HILO(tenantId)); } catch { /* da igual */ }
  }

  return (
    <div>
      <div
        className="sticky z-40 bg-[color:var(--cream)] pb-3 -mx-5 px-5 border-b-2 border-black/10"
        style={{ top: altoCabecera }}
      >
        <div className="max-w-[1100px] mx-auto pt-3">
          <div className="mb-2">
            <div className="text-xs font-mono uppercase tracking-widest text-black/50">{tenantNombre}</div>
            <div className="text-[11px] text-black/40">{agente}</div>
          </div>

          <div className="mb-3">
            <PestanasDental refreshKey={refreshKey} />
          </div>

          <BarraChat
            urgente={urgente}
            texto={texto}
            onTexto={setTexto}
            onEnviar={enviar}
            pensando={pensando}
          />
          <div className="flex gap-1.5 flex-wrap mt-1.5">
            {EJEMPLOS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => enviar(e)}
                className="text-[11px] border-2 border-black/20 px-2 py-1 text-black/50 hover:border-black hover:text-black bg-white"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-5 pt-4">
        {hilo.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-black/35">
                {hilo.filter((t) => t.rol === "usuario").length} pregunta
                {hilo.filter((t) => t.rol === "usuario").length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={vaciar}
                className="text-[10px] font-mono uppercase tracking-widest text-black/35 hover:text-black hover:underline"
              >
                vaciar
              </button>
            </div>
            <div className="space-y-3">
              {hilo.map((t, i) => (
                <div key={i} className={t.rol === "usuario" ? "text-right" : ""}>
                  <div
                    className={
                      t.rol === "usuario"
                        ? "inline-block bg-black text-white px-3 py-2 text-sm max-w-[85%] text-left"
                        : "border-2 border-black bg-white px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed"
                    }
                  >
                    {t.texto}
                  </div>
                  {/* LA CONFIRMACIÓN. Nada cambia hasta que se pulsa aquí. Se
                      pinta solo en el último turno: una propuesta de hace tres
                      preguntas ya no se sabe sobre qué era. */}
                  {t.pendiente && i === hilo.length - 1 && (
                    <div className="border-2 border-black bg-[color:var(--mustard)] px-3 py-2 mt-1.5">
                      <p className="text-sm font-bold leading-snug">{t.pendiente.resumen}</p>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => confirmar(t)}
                          disabled={confirmando}
                          className="text-[11px] font-mono uppercase tracking-widest bg-black text-white px-3 py-1.5 disabled:opacity-50"
                        >
                          {confirmando ? "Haciéndolo…" : "Sí, hazlo"}
                        </button>
                        <button
                          type="button"
                          onClick={() => descartar(t)}
                          disabled={confirmando}
                          className="text-[11px] font-mono uppercase tracking-widest border-2 border-black px-3 py-1.5 hover:bg-black hover:text-white disabled:opacity-50"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}
                  {t.acciones && t.acciones.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-1.5">
                      {t.acciones.map((a) => (
                        <a
                          key={a.href + a.texto}
                          href={a.href}
                          className="text-[10px] font-mono uppercase tracking-widest border-2 border-black px-2 py-1 hover:bg-black hover:text-white"
                        >
                          {a.texto} →
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {pensando && <p className="text-sm text-black/40 animate-pulse">Mirando…</p>}
              <div ref={finRef} />
            </div>
          </div>
        )}

        <div key={refreshKey} className="pb-10">{children}</div>
      </div>
    </div>
  );
}
