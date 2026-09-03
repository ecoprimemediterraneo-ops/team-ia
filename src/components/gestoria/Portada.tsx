"use client";

// LA PORTADA: una pantalla, un texto y un sitio para escribir.
//
// EL PROBLEMA QUE VIENE A ARREGLAR
// --------------------------------
// El panel se había convertido en un ERP: cinco secciones en el lateral y otras
// cinco pestañas dentro de una de ellas. Para saber qué le toca hoy, Jose tenía
// que leerse cuatro pantallas y cruzarlas de cabeza. Eso no es quitarle trabajo,
// es dárselo con otro nombre.
//
// LO QUE VENDEMOS NO ES UN ERP, ES UNA SECRETARIA. Y una secretaria no te enseña
// un cuadro de mandos: te cuenta cómo está el día y le puedes preguntar. De ahí
// las tres cosas de esta pantalla y ni una más:
//
//   1. Una barra arriba SOLO si hay algo que arde. Si no arde nada, no hay barra
//      —ni hueco vacío que sugiera que falta algo—.
//   2. El día en tres frases. Prosa, no tarjetas: la cifra sirve cuando ya sabes
//      qué buscas; la frase sirve cuando acabas de sentarte.
//   3. Un cuadro para preguntar.
//
// Las secciones de siempre siguen existiendo, abajo y en pequeño. No se han
// borrado: esto es una portada, no una amputación.
//
// AQUÍ NO HAY NÚMEROS GRANDES. Ni tarjetas de métricas, ni gráficas, ni badges
// de colores. Fue deliberado y cuesta: la tentación de poner "18 pendientes" en
// grande es enorme, y es exactamente lo que convierte una secretaria en un ERP.

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BarraUrgente, CuadroPreguntar } from "./BarraChat";
import SelectorCliente, { type ClienteBreve } from "./SelectorCliente";
import AccesosGestoria, { type Seccion } from "./AccesosGestoria";

type Urgente = { texto: string; href: string } | null;
type Resumen = { puntos: string[]; restantes: number; hechoEn: string; conIA: boolean };
type Accion = { texto: string; href: string };
type AccionPendiente = Record<string, unknown>;
type Turno = {
  rol: "usuario" | "secretaria";
  texto: string;
  acciones?: Accion[];
  /** Lo que el chat propone hacer y espera un sí. Solo el ÚLTIMO turno lo pinta. */
  pendiente?: { resumen: string; accion: AccionPendiente } | null;
};

/**
 * El hilo se guarda en el navegador.
 *
 * Antes se perdía al recargar, y con él todo lo que se había preguntado. Va en
 * `localStorage` y no en el servidor a propósito: es la libreta de Jose, no un
 * histórico que haya que guardar en ningún sitio, y así no hay nada que borrar
 * ni que cumplir. Por tenant, para que mirar dos gestorías no mezcle hilos.
 */
const CLAVE_HILO = (tenantId: string) => `aiteam:portada:hilo:${tenantId}`;

/**
 * Lo de ayer se archiva, no se borra.
 *
 * La conversación visible arranca vacía cada día —una libreta que crece sin fin
 * deja de ser una libreta— pero lo escrito NO desaparece: se mueve a su propia
 * clave con la fecha dentro. Si un día hace falta recuperar algo, está.
 */
const CLAVE_DIA = (tenantId: string, dia: string) =>
  `aiteam:portada:hilo:${tenantId}:${dia}`;

/** Hoy en España, "AAAA-MM-DD". `en-CA` da justo ese formato sin montarlo a mano. */
function hoyMadrid(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
}

/** Lo guardado: los turnos y el día en que se escribieron. */
type HiloGuardado = { dia: string; turnos: Turno[] };


/** "miércoles, 20 de agosto de 2026". En pequeño y en gris, como una cabecera. */
function fechaLarga(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  const t = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return t[0].toUpperCase() + t.slice(1);
}

/**
 * Sugerencias de arranque. Un cuadro de texto vacío no dice qué se le puede pedir.
 *
 * LOS TRES SON GENÉRICOS, y eso es el cambio importante. Antes nombraban a un
 * cliente concreto ("¿Qué le falta a Bar El Puerto?"), que en la demo de seis
 * clientes se leía bien y con los cien de verdad no: o se pintan cien cartelitos
 * o se elige uno a dedo y a los otros noventa y nueve no les sirve de nada.
 *
 * El cliente ya se elige arriba, en el selector. Estos tres preguntan por lo que
 * haya elegido: es el mismo filtro para toda la pantalla, no uno por botón.
 */
const EJEMPLOS = [
  "¿Qué vence esta semana?",
  "¿Qué facturas faltan por leer?",
  "¿Qué pagos no tienen factura?",
];

export default function Portada({
  nombreGestor,
  tenantId,
  clientes = [],
  seccion = null,
  pagadosSinFactura = 0,
  contenidoSeccion = null,
}: {
  nombreGestor: string;
  tenantId: string;
  /** Los clientes del gestor, para el selector que va encima del chat. */
  clientes?: ClienteBreve[];
  /** Qué sección hay desplegada debajo, si hay alguna. */
  seccion?: Seccion | null;
  pagadosSinFactura?: number;
  /** El contenido de esa sección, montado como slot desde el servidor. */
  contenidoSeccion?: React.ReactNode;
}) {
  // EL CLIENTE ELEGIDO ARRIBA. Se lee de la URL —la misma verdad que usan el
  // selector, el aviso rojo y el servidor— para que los atajos pregunten por lo
  // que se está mirando y no por toda la gestoría.
  const sp = useSearchParams();
  const clienteId = sp?.get("cliente") ?? "";
  const clienteNombre = clienteId
    ? clientes.find((c) => c.id === clienteId)?.nombre ?? ""
    : "";

  const [urgente, setUrgente] = useState<Urgente>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [hoy, setHoy] = useState("");
  const [cargando, setCargando] = useState(true);

  const [hilo, setHilo] = useState<Turno[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  /** Se ha pulsado Atrás con el hilo abierto: se avisa antes de dejarle salir. */
  const [avisoSalida, setAvisoSalida] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  /** ¿Ya se ha leído el hilo guardado? Hasta entonces no se escribe nada. */
  const cargado = useRef(false);
  /**
   * Lo mismo, pero como ESTADO.
   *
   * La ref no vale para encadenar: cambiarla no vuelve a disparar un efecto, y
   * la pregunta que llega por la URL se quedaba esperando a un `cargado.current`
   * que ya era `true` pero que nadie había vuelto a mirar.
   */
  const [hiloCargado, setHiloCargado] = useState(false);
  /** ¿Ya se metió la entrada de historial que amortigua el botón Atrás? */
  const guardiaPuesta = useRef(false);
  /** ¿Ya se ha lanzado la pregunta que venía en la URL? Solo una vez. */
  const lanzada = useRef(false);

  // El hilo guardado, al arrancar. Va en su propio efecto para no bloquear la
  // primera pintada esperando a nada.
  useEffect(() => {
    // El `setHilo` va tras un salto de tarea a propósito: llamarlo de forma
    // síncrona dentro del efecto es lo que React avisa como cascada de pintadas.
    let vivo = true;
    queueMicrotask(() => {
      if (!vivo) return;
      try {
        const crudo = localStorage.getItem(CLAVE_HILO(tenantId));
        if (crudo) {
          const leido = JSON.parse(crudo) as HiloGuardado | Turno[];
          // El formato viejo era un array pelado, sin fecha. No se sabe de qué
          // día es, así que se archiva igual y se empieza limpio: es justo lo
          // que va a pasar mañana de todas formas.
          const esViejo = Array.isArray(leido);
          const dia = esViejo ? "antiguo" : leido.dia;
          const turnos = esViejo ? leido : leido.turnos;
          if (dia === hoyMadrid()) {
            setHilo(turnos);
          } else if (turnos.length) {
            // ARCHIVAR, NO BORRAR. Se guarda con su fecha y se deja de pintar.
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
    // NO se guarda hasta haber leído lo que ya había.
    //
    // Sin esta guarda, al montar el componente el hilo vale [] y este efecto
    // corría ANTES que la lectura de arriba, así que escribía "[]" encima de lo
    // guardado y lo borraba: recargar la página vaciaba la libreta y parecía que
    // no se guardaba nada.
    if (!cargado.current) return;
    try {
      // Se guardan los últimos 40: la libreta no tiene por qué ser infinita y
      // un localStorage lleno deja de escribir sin avisar.
      const guardar: HiloGuardado = { dia: hoyMadrid(), turnos: hilo.slice(-40) };
      localStorage.setItem(CLAVE_HILO(tenantId), JSON.stringify(guardar));
    } catch { /* cuota llena: se sigue funcionando, solo que sin guardar */ }
  }, [hilo, tenantId]);

  /**
   * ATRÁS, con el hilo abierto, no te echa a la primera.
   *
   * Esta pantalla no navega: preguntar no cambia la URL, así que el botón de
   * volver del navegador te sacaba directamente a donde estuvieras antes —el
   * panel, o el redirector de ver-panel— y la conversación desaparecía de vista
   * de golpe. No se perdía nada (el hilo se guarda), pero da el susto.
   *
   * Se mete UNA entrada en el historial en cuanto hay conversación: el primer
   * Atrás la consume, se queda aquí y avisa; el segundo ya sale de verdad. Un
   * solo paso de más, y solo cuando hay algo que se pueda creer perdido.
   */
  useEffect(() => {
    if (!hilo.length) return;
    if (guardiaPuesta.current) return;
    guardiaPuesta.current = true;
    history.pushState({ portada: true }, "");

    const alVolver = () => {
      setAvisoSalida(true);
      // Se repone la entrada consumida: el siguiente Atrás sale de verdad
      // porque para entonces el aviso ya está delante.
      guardiaPuesta.current = false;
    };
    window.addEventListener("popstate", alVolver);
    return () => window.removeEventListener("popstate", alVolver);
  }, [hilo.length]);

  /**
   * La pregunta que llega desde otra pantalla (`/dashboard?preguntar=…`).
   *
   * Las tres pantallas de trabajo llevan arriba un cuadro que NO contesta ahí:
   * manda aquí con la pregunta puesta y se lanza sola. Se limpia la URL después
   * para que recargar no la vuelva a preguntar —y a cobrar— otra vez.
   */
  useEffect(() => {
    if (!hiloCargado || lanzada.current) return;
    const q = new URLSearchParams(window.location.search).get("preguntar");
    if (!q?.trim()) return;
    lanzada.current = true;
    // Se limpia la URL: recargar no puede volver a preguntar —y a pagar— lo
    // mismo otra vez.
    window.history.replaceState({}, "", window.location.pathname);
    enviar(q);
    // `enviar` cambia en cada tecla del cuadro; ponerlo aquí relanzaría esto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiloCargado]);

  /** Vuelve a pedir el resumen. Se llama al arrancar y después de cada acción. */
  async function refrescarResumen() {
    const res = await fetch("/api/gestoria/portada").catch(() => null);
    const j = res ? await res.json().catch(() => null) : null;
    if (j?.ok) { setUrgente(j.urgente); setResumen(j.resumen); setHoy(j.hoy); }
  }

  useEffect(() => {
    let vivo = true;
    (async () => {
      const res = await fetch("/api/gestoria/portada").catch(() => null);
      const j = res ? await res.json().catch(() => null) : null;
      if (!vivo) return;
      if (j?.ok) { setUrgente(j.urgente); setResumen(j.resumen); setHoy(j.hoy); }
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, []);

  // NO se hace scroll de la página al hilo.
  //
  // Antes sí, y era el motivo de que "desapareciera el resumen": al preguntar,
  // la página saltaba al final y el resumen quedaba arriba fuera de pantalla,
  // sin nada que dijera que seguía ahí. Ahora el que se mueve es el hilo dentro
  // de su propia caja; el resumen no se mueve nunca.
  useEffect(() => {
    if (!hilo.length) return;
    // Se mueve SOLO el hilo por dentro, no la página.
    //
    // Con `scrollIntoView` el navegador desplazaba la página entera para enseñar
    // la última respuesta, y el cuadro de preguntar —que ahora está arriba— se
    // iba de la pantalla justo después de escribir en él. Tocando el `scrollTop`
    // del contenedor, la conversación avanza y lo de fuera se queda quieto.
    const caja = finRef.current?.parentElement;
    if (caja) caja.scrollTop = caja.scrollHeight;
  }, [hilo, pensando]);

  /**
   * Le pega el cliente elegido a la pregunta del atajo.
   *
   * Se hace con palabras y no con un parámetro nuevo en la ruta a propósito: el
   * chat ya entiende "de Bar El Puerto" —es lo que se escribe a mano todo el
   * día— y meter un filtro por debajo obligaría a que el modelo y el código se
   * pusieran de acuerdo sobre a qué cliente se refiere cada frase.
   */
  function conCliente(pregunta: string): string {
    if (!clienteNombre) return pregunta;
    return `${pregunta} (solo de ${clienteNombre})`;
  }

  async function enviar(pregunta: string) {
    const q = pregunta.trim();
    if (!q || pensando) return;
    setTexto("");
    // La pregunta aparece al momento: esperar a la red para verla escrita hace
    // dudar de si se ha enviado.
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

  /** El "sí" del gestor. Es lo ÚNICO que cambia datos desde esta pantalla. */
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
        // La propuesta se apaga en el turno donde estaba: así el botón no se
        // queda vivo invitando a hacerlo dos veces.
        ...h.map((x) => (x === t ? { ...x, pendiente: null } : x)),
        { rol: "secretaria", texto: j.texto || j.error || "Hecho." },
      ]);
      // Lo de arriba tiene que reflejar lo que se acaba de hacer.
      await refrescarResumen();
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
      {/* 0. EL CLIENTE, ENCIMA DE TODO. Es el filtro que manda sobre lo que hay
          debajo: el saco, el aviso rojo y lo que conteste el chat. Va aquí y no
          dentro de la pantalla de Facturas porque no es de esa pantalla, es de
          toda la sesión de trabajo. */}
      {clientes.length > 0 && <SelectorCliente clientes={clientes} className="mb-3" />}

      {/* 1. LA BARRA Y EL CUADRO, PEGADOS Y LOS PRIMEROS.

          Es el MISMO componente que llevan las otras tres pantallas, con el
          mismo orden y el mismo ancho: las cuatro empiezan igual. Antes el
          saludo se metía entre la barra y el cuadro y partía el bloque en dos,
          y al cambiar de pantalla se notaba el salto. */}
      <BarraUrgente urgente={urgente} />

      {/* LOS TRES ATAJOS, PEGADOS ENCIMA DEL CAMPO.
          Estaban debajo, y debajo se leen como el resultado de algo en vez de
          como lo que se puede pedir. Aquí son el renglón anterior a escribir.
          Se ven siempre, con hilo o sin él: un botón que desaparece en cuanto lo
          usas obliga a acordarse de que existía. */}
      <div className={`flex gap-1.5 flex-wrap ${urgente ? "mt-3" : ""}`}>
        {EJEMPLOS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => enviar(conCliente(e))}
            title={clienteNombre ? `Solo de ${clienteNombre}` : "De todos los clientes"}
            className="text-[11px] border-2 border-black/20 px-2 py-1 text-black/50 hover:border-black hover:text-black"
          >
            {e}
          </button>
        ))}
      </div>

      <CuadroPreguntar
        texto={texto}
        onTexto={setTexto}
        onEnviar={enviar}
        pensando={pensando}
        className="mt-1.5"
      />

      {/* LAS TRES SECCIONES, JUSTO DEBAJO DEL CAMPO.
          Estaban al final de la página: con el hilo lleno había que bajar a
          buscarlas y en la práctica no existían. En una fila repartida de
          izquierda a derecha, se ven siempre y no compiten con el chat. */}
      <AccesosGestoria abierta={seccion} pagadosSinFactura={pagadosSinFactura} />



      {/* 2. EL SALUDO Y LA FECHA. Debajo del cuadro: lo primero que se ve
          es dónde escribir, como en cualquier chat. */}
      <div className="mt-8 mb-6">
        <div className="flex items-baseline gap-3">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-black/40 flex-1">
            {hoy ? fechaLarga(hoy) : " "}
          </div>
          {/* Aquí hubo un "Panel completo →". Se ha quitado: la portada YA es
              /dashboard, así que el enlace apuntaba a sí mismo. Y el panel de
              tarjetas ha dejado de estar en el camino a propósito — a las tres
              pantallas de trabajo se llega por los accesos de abajo y por el
              lateral, sin pasar por ningún intermedio. */}
        </div>
        <h1 className="font-stencil text-4xl md:text-5xl leading-none mt-1">
          {nombreGestor ? `Hola, ${nombreGestor}` : "Hola"}
        </h1>

      </div>

      {avisoSalida && (
        <div className="border-2 border-black bg-[color:var(--cream)] px-3 py-2 mb-2 text-sm flex items-center gap-3 flex-wrap">
          <span className="flex-1">
            Sigues en la portada. Tu conversación está guardada: vuelvas cuando vuelvas, la encontrarás aquí.
          </span>
          <button
            type="button"
            onClick={() => setAvisoSalida(false)}
            className="text-[10px] font-mono uppercase tracking-widest border-2 border-black px-2 py-1 hover:bg-black hover:text-white"
          >
            vale
          </button>
        </div>
      )}

      {hilo.length > 0 && (
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
      )}

      <div className="space-y-3 mt-3 max-h-[45vh] overflow-y-auto">
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
            {/* LA CONFIRMACIÓN. Nada cambia hasta que se pulsa aquí. Se pinta
                solo en el último turno: una propuesta de hace tres preguntas ya
                no se sabe sobre qué era. */}
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

            {/* Uno o dos botones, y solo cuando llevan a algo que existe. */}
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

      {/* 4. EL DÍA, EN PUNTOS. Debajo del chat a propósito.

          Antes iba arriba y el cuadro de preguntar quedaba al final de la
          página: había que bajar a buscar la herramienta principal del
          producto. Se invierte: lo primero que se ve es dónde escribir —como
          en cualquier chat—, y el día queda justo debajo, a un golpe de vista
          sin scroll cuando no hay conversación. */}
      <div className="mt-8">
        {/* EL DÍA, EN PUNTOS.
            Era un párrafo de cinco frases seguidas y no se leía: se empezaba, se
            perdía el hilo a la segunda y se abandonaba. Un punto por asunto, uno
            por línea, y se ve de un vistazo cuántas cosas hay sin contarlas.
            Ni tarjetas, ni números grandes, ni colores: solo texto. */}
        {cargando ? (
          <p className="text-lg text-black/30">Mirando cómo está el día…</p>
        ) : !resumen?.puntos?.length ? (
          <p className="text-lg text-black/80">Hoy no hay nada que reclame tu atención.</p>
        ) : (
          <ul className="space-y-2">
            {resumen.puntos.map((p, i) => (
              <li key={i} className="flex gap-2 text-base md:text-lg leading-snug text-black/80">
                <span className="text-black/30 select-none shrink-0">—</span>
                <span>{p}</span>
              </li>
            ))}
            {/* Lo que no cabe se dice, no se esconde: un tope callado parece que
                eso es todo lo que hay. */}
            {resumen.restantes > 0 && (
              <li className="text-sm text-black/45 pl-5">
                Y {resumen.restantes} {resumen.restantes === 1 ? "cosa más" : "cosas más"} sin tanta prisa.
              </li>
            )}
          </ul>
        )}
      </div>

      {/* LA SECCIÓN, DESPLEGADA DEBAJO. El chat se queda arriba: mirar una
          factura no puede costarte la conversación que llevas escrita. */}
      {contenidoSeccion && (
        <div className="mt-4 pt-4 border-t-[3px] border-black">{contenidoSeccion}</div>
      )}

    </div>
  );
}
