"use client";

// EL MARCO FIJO DE GESTORÍA, REHECHO.
//
// LA VERSIÓN ANTERIOR METÍA EL CHAT EN UN LATERAL FIJO POR ALTURA (`sticky
// top-6 h-[calc(100vh-8rem)]`) Y SE PORTABA MAL: al hacer scroll, ese lateral
// se movía con la página en vez de quedarse clavado, porque un `sticky` sin
// una pila de offsets correcta —y compitiendo con el ancho del panel
// central— no da lo que da un `sticky` bien anidado. Y ni el sitio (lateral)
// ni el comportamiento (que se moviera) eran los que se pedían: el chat va
// ARRIBA, como en ChatGPT/Claude/Gemini/Codex — clavado en la parte de
// arriba de la pantalla, y lo único que hace scroll es el contenido de la
// pestaña.
//
// CÓMO SE CONSIGUE, DE VERDAD
// ---------------------------
// Dos bloques `position: sticky`, apilados con el `top` correcto:
//   1. La cabecera del sitio (logo, selector de cuenta, email, SALIR) —vive
//      en `dashboard/layout.tsx`, fuera de este componente— con
//      `sticky top-0` SOLO cuando el sector es gestoría (ver ese archivo).
//   2. ESTE bloque (negocio+agente, pestañas, y el chat: barra roja +
//      atajos + cuadro de preguntar), con `sticky top-<alto de la cabecera>`.
// El alto de la cabecera no es una constante: cambia con el ancho de
// pantalla (el badge DEV, el selector de cuenta…), así que se MIDE con
// `ResizeObserver` en vez de clavarlo a un número que se rompería en cuanto
// la cabecera envuelva línea. Sin esa medición, el segundo bloque se
// solaparía con la cabecera o dejaría un hueco según el ancho de ventana.
//
// EL HILO DE LA CONVERSACIÓN NO ES FIJO — la propia tarea lo deja así: solo
// "cuadro de preguntar + botones de acciones rápidas" está en la lista de lo
// fijo. El hilo vive en la zona que hace scroll, ENCIMA del contenido de la
// pestaña — mismo sitio donde estaba en el diseño original de la portada,
// antes de que existiera ningún lateral. Como este componente se sigue
// montando una sola vez por `(gestoria)/layout.tsx`, el hilo sigue
// sobreviviendo al cambio de pestaña exactamente igual que antes: lo que ha
// cambiado es DÓNDE se pinta, no CUÁNDO se pierde (nunca, salvo que se vacíe
// a mano).
//
// SIN LATERAL Y SIN BOTÓN FLOTANTE. Los dos se han quitado: no se pedían, y
// el botón flotante competía por sitio con el widget verde de WhatsApp que ya
// vive fijo en esa esquina en todo el sitio.

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ClienteBreve } from "./SelectorCliente";
import SelectorCliente from "./SelectorCliente";
import PestanasGestoria from "./PestanasGestoria";
import BarraChat from "./BarraChat";

type Accion = { texto: string; href: string };
type AccionPendiente = Record<string, unknown>;
type Turno = {
  rol: "usuario" | "secretaria";
  texto: string;
  acciones?: Accion[];
  pendiente?: { resumen: string; accion: AccionPendiente } | null;
};

const CLAVE_HILO = (tenantId: string) => `aiteam:portada:hilo:${tenantId}`;
const CLAVE_DIA = (tenantId: string, dia: string) => `aiteam:portada:hilo:${tenantId}:${dia}`;

function hoyMadrid(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
}

type HiloGuardado = { dia: string; turnos: Turno[] };

const EJEMPLOS = [
  "¿Qué vence esta semana?",
  "¿Qué facturas faltan por leer?",
  "¿Qué pagos no tienen factura?",
];

export default function PanelGestoriaShell({
  tenantNombre,
  agente = "Lucía · secretaria de la gestoría",
  tenantId,
  clientes,
  pagadosSinFactura = 0,
  children,
}: {
  tenantNombre: string;
  agente?: string;
  tenantId: string;
  clientes: ClienteBreve[];
  pagadosSinFactura?: number;
  children: React.ReactNode;
}) {
  // EL ALTO DE LA CABECERA DEL SITIO, MEDIDO. Es lo que evita que este bloque
  // se solape con ella o deje un hueco — ver la nota de arriba.
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

  const sp = useSearchParams();
  const clienteId = sp?.get("cliente") ?? "";
  const clienteNombre = clienteId ? clientes.find((c) => c.id === clienteId)?.nombre ?? "" : "";

  const [hilo, setHilo] = useState<Turno[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const cargado = useRef(false);
  const [hiloCargado, setHiloCargado] = useState(false);
  const lanzada = useRef(false);

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
          if (dia === hoyMadrid()) {
            setHilo(turnos);
          } else if (turnos.length) {
            try { localStorage.setItem(CLAVE_DIA(tenantId, dia), JSON.stringify(turnos)); }
            catch { /* cuota llena: se prefiere no pintarlo a no arrancar */ }
          }
        }
      } catch { /* si está corrupto, se empieza de cero y ya */ }
      cargado.current = true;
      setHiloCargado(true);
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

  /**
   * La pregunta que llega desde otra pantalla (`/dashboard/clientes?preguntar=…`,
   * vía `BarraGestoria`). Se limpia la URL después para que recargar no la
   * vuelva a preguntar otra vez.
   */
  useEffect(() => {
    if (!hiloCargado || lanzada.current) return;
    const qs = new URLSearchParams(window.location.search);
    const q = qs.get("preguntar");
    if (!q?.trim()) return;
    lanzada.current = true;
    qs.delete("preguntar");
    const resto = qs.toString();
    window.history.replaceState({}, "", window.location.pathname + (resto ? `?${resto}` : ""));
    enviar(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiloCargado]);

  function conCliente(pregunta: string): string {
    if (!clienteNombre) return pregunta;
    return `${pregunta} (solo de ${clienteNombre})`;
  }

  async function enviar(pregunta: string) {
    const q = pregunta.trim();
    if (!q || pensando) return;
    setTexto("");
    const previo = hilo;
    setHilo([...previo, { rol: "usuario", texto: q }]);
    setPensando(true);
    try {
      const res = await fetch("/api/gestoria/preguntar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pregunta: q,
          historial: previo.map((t) => ({ rol: t.rol, texto: t.texto })),
        }),
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

  async function confirmar(t: Turno) {
    if (!t.pendiente || confirmando) return;
    setConfirmando(true);
    try {
      const res = await fetch("/api/gestoria/preguntar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmar: t.pendiente.accion }),
      });
      const j = await res.json();
      setHilo((h) => [
        ...h.map((x) => (x === t ? { ...x, pendiente: null } : x)),
        { rol: "secretaria", texto: j.texto || j.error || "Hecho." },
      ]);
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
      {/* EL BLOQUE FIJO: negocio+agente, pestañas, barra roja, atajos y
          cuadro de preguntar. Todo junto para que un solo `sticky` con un
          solo `top` baste — meter cada fila en su propio `sticky` obligaría a
          sumar el alto de las anteriores en cada una. */}
      <div
        className="sticky z-40 bg-[color:var(--cream)] pb-3 -mx-5 px-5 border-b-2 border-black/10"
        style={{ top: altoCabecera }}
      >
        <div className="max-w-[1100px] mx-auto pt-3">
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-black/50">{tenantNombre}</div>
              <div className="text-[11px] text-black/40">{agente}</div>
            </div>
            {clientes.length > 0 && <SelectorCliente clientes={clientes} className="shrink-0" />}
          </div>

          <div className="mb-3">
            <PestanasGestoria pagadosSinFactura={pagadosSinFactura} />
          </div>

          <BarraChat
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
                onClick={() => enviar(conCliente(e))}
                title={clienteNombre ? `Solo de ${clienteNombre}` : "De todos los clientes"}
                className="text-[11px] border-2 border-black/20 px-2 py-1 text-black/50 hover:border-black hover:text-black bg-white"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* A PARTIR DE AQUÍ, SCROLL: el hilo de la conversación (si lo hay) y
          debajo el contenido de la pestaña. Es lo único que se mueve. */}
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

        <div className="pb-10">{children}</div>
      </div>
    </div>
  );
}
