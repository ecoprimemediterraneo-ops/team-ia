"use client";

// Subida de facturas y listado del saco de un cliente.
//
// Arrastrar y soltar, y `capture` en móvil para tirar la foto directamente: el
// gestor está delante del montón de tickets con el teléfono en la mano, no
// buscando ficheros en un explorador.

import { useCallback, useEffect, useRef, useState } from "react";
import LecturaDocumento, { type Lectura as LecturaTipo } from "./LecturaDocumento";
import EnviarDocumento from "./EnviarDocumento";
import VisorDocumento from "./VisorDocumento";

type Factura = {
  id: string;
  cliente_id: string | null;
  origen: "whatsapp" | "email" | "manual";
  fecha_recepcion: string;
  tipo: "imagen" | "pdf";
  nombre_original: string;
  importe: number | null;
  fecha_factura: string | null;
  proveedor: string | null;
  estado: "sin_asignar" | "pendiente" | "conciliada" | "descartada";
  verUrl: string | null;
  remitente?: string;
  asunto?: string;
  lectura?: LecturaTipo | null;
  lectura_error?: string;
  lectura_estado?: "leyendo" | "hecha" | "error";
  clase?: string;
  contable?: boolean;
  duplicado_de?: string;
  duplicado_certeza?: "seguro" | "probable";
  duplicado_detalle?: string;
  /** Cómo se colocó sola, si se colocó. */
  asignado_por?: "nif" | "telefono" | "email" | "manual";
  asignado_motivo?: string;
  /** El mismo NIF o teléfono en dos fichas: no se asigna, se declara. */
  conflicto?: {
    motivo: "nif" | "telefono" | "email";
    valor: string;
    clientes: Array<{ id: string; nombre: string }>;
    detalle: string;
  };
};

/**
 * El cartel de DUPLICADO. Negro, no rojo: no es un error del sistema, es un
 * papel que ha llegado dos veces, y pasa todos los días.
 *
 * Lleva SIEMPRE el botón de "no es duplicado": la detección acierta casi
 * siempre, pero un bar puede emitir dos tickets iguales el mismo día y eso son
 * dos gastos de verdad. Quien decide es Jose; el sistema solo avisa.
 */
function AvisoDuplicado({ f, onNoEsDuplicado }: {
  f: { duplicado_de?: string; duplicado_certeza?: "seguro" | "probable"; duplicado_detalle?: string };
  onNoEsDuplicado: () => void;
}) {
  if (!f.duplicado_de) return null;
  return (
    <div className="text-[11px] bg-black text-white border-2 border-black px-2 py-1 mt-1">
      <span className="font-mono font-bold uppercase tracking-widest mr-1">
        {f.duplicado_certeza === "seguro" ? "DUPLICADO" : "¿DUPLICADO?"}
      </span>
      {f.duplicado_detalle}{" "}
      <span className="opacity-70">No cuenta en los totales ni cruza con el banco.</span>{" "}
      <button
        type="button"
        onClick={onNoEsDuplicado}
        className="underline font-bold hover:opacity-70"
      >
        No es duplicado
      </button>
    </div>
  );
}

// La clase del documento, con el MISMO código de color que la ficha de lectura:
// verde solo lo que deduce IVA, mostaza lo que se guarda pero no deduce, rojo lo
// que ni siquiera es contable. Si el color cambiara entre la lista y la ficha,
// el gestor tendría que volver a mirarlo todo cada vez que abre una.
const CLASE_ETIQUETA: Record<string, string> = {
  factura_completa: "FACTURA",
  abono: "FACTURA",
  ticket: "TICKET",
  albaran: "ALBARÁN",
  presupuesto: "OTROS",
  otro: "OTROS",
};

const CLASE_COLOR: Record<string, string> = {
  factura_completa: "bg-green-700 text-white",
  abono: "bg-green-700 text-white",
  ticket: "bg-[color:var(--mustard)] text-black",
  albaran: "bg-[color:var(--red)] text-white",
  presupuesto: "bg-black/70 text-white",
  otro: "bg-black/70 text-white",
};

function ClaseEtiqueta({ clase }: { clase?: string }) {
  if (!clase) return null;
  return (
    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 ${CLASE_COLOR[clase] ?? CLASE_COLOR.otro}`}>
      {CLASE_ETIQUETA[clase] ?? clase}
    </span>
  );
}

/**
 * Lo que la IA ha sacado del papel, en una línea: proveedor · importe · tipo.
 *
 * Los tres estados se dicen distinto A PROPÓSITO. "Sin leer todavía" servía
 * para todo y no distinguía entre "espera dos segundos" y "esto ha fallado,
 * haz algo": el gestor no sabía si refrescar o reintentar.
 */
function ResumenLeido({
  f,
  onReintentar,
  reintentando,
}: {
  f: { lectura?: LecturaTipo | null; lectura_error?: string; lectura_estado?: string; clase?: string; importe: number | null; proveedor: string | null };
  onReintentar: () => void;
  reintentando: boolean;
}) {
  if (f.lectura_estado === "leyendo" && !f.lectura) {
    return (
      <div className="text-[11px] font-mono text-black/60 mt-0.5 animate-pulse">
        Leyendo… (unos segundos)
      </div>
    );
  }

  if (f.lectura_error || (f.lectura_estado === "error" && !f.lectura)) {
    return (
      <div className="flex items-center gap-2 flex-wrap mt-0.5">
        <span className="text-[11px] font-bold text-[color:var(--red)]">
          No se ha podido leer. El documento está guardado igual.
        </span>
        <button
          type="button"
          onClick={onReintentar}
          disabled={reintentando}
          className="text-[9px] font-mono uppercase border-2 border-black px-1.5 py-0.5 bg-white hover:bg-black hover:text-white disabled:opacity-50"
        >
          {reintentando ? "leyendo…" : "reintentar"}
        </button>
      </div>
    );
  }

  if (!f.lectura) {
    return (
      <div className="flex items-center gap-2 flex-wrap mt-0.5">
        <span className="text-[11px] font-mono text-black/50">Sin leer todavía.</span>
        <button
          type="button"
          onClick={onReintentar}
          disabled={reintentando}
          className="text-[9px] font-mono uppercase border-2 border-black px-1.5 py-0.5 bg-white hover:bg-black hover:text-white disabled:opacity-50"
        >
          {reintentando ? "leyendo…" : "leerlo ahora"}
        </button>
      </div>
    );
  }

  const total = f.lectura.total?.valor ?? f.importe;
  return (
    <div className="flex items-center gap-2 flex-wrap mt-0.5">
      <ClaseEtiqueta clase={f.clase ?? f.lectura.clase} />
      <span className="text-[11px] font-mono text-black/70 truncate">
        {f.lectura.emisor?.valor || f.proveedor || "proveedor sin leer"}
        {total != null ? ` · ${euros(total)}` : ""}
      </span>
    </div>
  );
}

// Por dónde entró cada factura. Se dice con el nombre del agente que la recogió
// ("Pablo", "Lucía") porque es como el gestor los tiene en la cabeza: no le
// suena "canal whatsapp", le suena "eso lo pilló Pablo".
const ORIGEN = {
  whatsapp: { icono: "💬", texto: "Por WhatsApp (Pablo)" },
  email: { icono: "✉️", texto: "Por correo (Lucía)" },
  manual: { icono: "📎", texto: "Subida a mano" },
} as const;

/** Etiqueta de origen. Emoji, no librería de iconos: el panel ya va así. */
function Origen({ origen }: { origen: keyof typeof ORIGEN }) {
  const o = ORIGEN[origen];
  return (
    <span className="inline-flex items-center gap-1 border-2 border-black bg-[color:var(--cream)] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider whitespace-nowrap">
      <span aria-hidden>{o.icono}</span>
      {o.texto}
    </span>
  );
}

// Los estados se guardan en corto, pero al gestor se le enseñan en cristiano:
// "sin_asignar" no significa nada para quien no ha escrito el código.
const ESTADO_TEXTO = {
  sin_asignar: "Sin asignar",
  pendiente: "Pendiente de cuadrar",
  conciliada: "Cuadrada con el banco",
  descartada: "Descartada",
} as const;

/** Importe con coma decimal, como se escribe aquí: 84,50 € y no 84.50. */
const euros = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

/**
 * Lo último que ha entrado, arriba. Se ordena AQUÍ además de en el servidor: la
 * lista se repinta al asignar o editar documentos sin volver a preguntar, y sin
 * esto lo recién llegado se quedaba donde estuviera.
 */
function porEntradaReciente(lista: Factura[]): Factura[] {
  return [...lista].sort((a, b) => b.fecha_recepcion.localeCompare(a.fecha_recepcion));
}

/** Fecha corta en español. Acepta AAAA-MM-DD o fecha completa. */
function fechaCorta(valor: string): string {
  const d = new Date(valor);
  return isNaN(d.getTime()) ? valor : d.toLocaleDateString("es-ES");
}

/**
 * CUÁNDO ENTRÓ el documento, con hora y en hora de Madrid.
 *
 * Es un dato distinto de la fecha de la factura y hacía falta: en la lista solo
 * se veía la fecha del papel, así que una factura de marzo que acababa de llegar
 * por WhatsApp hace dos minutos parecía vieja, y no había forma de saber qué era
 * lo último que había caído. Con hora, porque el gestor mira esto varias veces
 * al día. En `Europe/Madrid` explícito: el servidor va en UTC y sin decírselo
 * enseñaría dos horas menos en verano.
 */
function entradaCorta(valor: string): string {
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  return d.toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ¿Ha entrado en las últimas 24 h? Es lo que el gestor no ha visto todavía. */
function esReciente(valor: string): boolean {
  const d = new Date(valor).getTime();
  return !isNaN(d) && Date.now() - d < 24 * 60 * 60 * 1000;
}

/** El cartelito de recién llegado. */
function Nuevo() {
  return (
    <span
      title="Ha entrado en las últimas 24 horas"
      className="text-[9px] font-mono font-bold uppercase tracking-widest bg-[color:var(--mustard)] border-2 border-black px-1.5 py-0.5"
    >
      NUEVO
    </span>
  );
}

type ExtractoPrevio = { total: number; desde: string; hasta: string; ultimaImportacion: string; lotes: number };

export default function FacturasCliente({
  clientes, yaSubido = {},
}: {
  clientes: { id: string; nombre: string }[];
  /** Extracto ya importado de cada cliente, para el bloque de la segunda fase. */
  yaSubido?: Record<string, ExtractoPrevio>;
}) {
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? "");
  const [facturas, setFacturas] = useState<Factura[]>([]);
  // Bandeja de las que entraron sin dueño. Va aparte de `facturas` porque no son
  // de ningún cliente: mezclarlas en el saco de quien esté seleccionado sería
  // exactamente el error que esta pantalla existe para evitar.
  const [sinAsignar, setSinAsignar] = useState<Factura[]>([]);
  /** Qué documento se está releyendo ahora ("todos" = la tanda entera). */
  const [releyendo, setReleyendo] = useState<string | null>(null);
  /** Lo que se ofrece apuntar en la ficha del cliente tras asignar a mano. */
  const [aprender, setAprender] = useState<
    { clienteId: string; clienteNombre: string; nif: string; telefono: string } | null
  >(null);
  const [guardandoAprendido, setGuardandoAprendido] = useState(false);
  /** El documento que se está mirando en el visor. null = ninguno. */
  const [viendo, setViendo] = useState<Factura | null>(null);
  /** Cuántas se han colocado solas y cuántas no. Lo calcula el servidor. */
  const [recuento, setRecuento] = useState<{ asignadas: number; sinIdentificar: number; conflictos: number; duplicadosMes: number } | null>(null);
  const [destino, setDestino] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // `recarga` es un contador: subir o editar lo incrementa y el efecto vuelve a
  // pedir la lista. Así el efecto NO llama a setState de forma síncrona —que es
  // lo que dispara renders en cascada— y la carga vive en un solo sitio.
  const [recarga, setRecarga] = useState(0);
  const recargar = useCallback(() => setRecarga((n) => n + 1), []);

  /** El extracto del cliente que está seleccionado ahora mismo. */
  const extracto = yaSubido[clienteId];

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/gestoria/facturas?sinAsignar=1");
        const json = await res.json();
        if (vivo) {
          setSinAsignar(porEntradaReciente(json.facturas ?? []));
          if (json.recuento) setRecuento(json.recuento);
        }
      } catch {
        // La bandeja no es crítica: si falla, el saco del cliente sigue igual.
      }
    })();
    return () => { vivo = false; };
  }, [recarga]);

  useEffect(() => {
    if (!clienteId) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/gestoria/facturas?clienteId=${encodeURIComponent(clienteId)}`);
        const json = await res.json();
        if (vivo) setFacturas(porEntradaReciente(json.facturas ?? []));
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [clienteId, recarga]);

  async function asignar(f: Factura) {
    // En conflicto, solo vale lo que haya elegido el gestor: nada de coger el
    // primer candidato por defecto.
    const destinoId = destino[f.id] || (f.conflicto ? "" : clientes[0]?.id);
    if (!destinoId) return;
    await fetch("/api/gestoria/facturas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id, cliente_id: destinoId }),
    });

    // APRENDER DEL CLIC: este documento traía un NIF (o venía de un teléfono)
    // que no estaba en la ficha de nadie, y el gestor acaba de decir de quién
    // es. Se le ofrece guardarlo para que la próxima se reconozca sola. Así la
    // ficha se rellena con el uso y nadie tiene que picar cincuenta NIF.
    //
    // Se OFRECE, no se guarda: si el gestor se equivoca de cliente al asignar y
    // encima le pegáramos el NIF a la ficha, el error quedaría escrito y a
    // partir de ahí se repetiría solo en todas las facturas siguientes.
    const cliente = clientes.find((c) => c.id === destinoId);
    const nifDelPapel = f.lectura?.nifDestinatario?.valor?.trim() || "";
    const telefonoDelEnvio = f.origen === "whatsapp" ? (f.remitente || "").replace(/\D/g, "") : "";
    // Si llegó aquí es que el dato duro NO resolvió: o no estaba en ninguna
    // ficha, o estaba en dos. En los dos casos merece la pena ofrecer apuntarlo.
    const yaSeSabiaPorNif = false;
    const yaSeSabiaPorTel = false;

    if (cliente && ((nifDelPapel && !yaSeSabiaPorNif) || (telefonoDelEnvio && !yaSeSabiaPorTel))) {
      setAprender({
        clienteId: destinoId,
        clienteNombre: cliente.nombre,
        nif: yaSeSabiaPorNif ? "" : nifDelPapel,
        telefono: yaSeSabiaPorTel ? "" : telefonoDelEnvio,
      });
    }

    recargar();
  }

  /** Guarda en la ficha del cliente lo que traía el documento. Un clic, el suyo. */
  async function guardarAprendido() {
    if (!aprender) return;
    setGuardandoAprendido(true);
    try {
      // Se lee la ficha actual para AÑADIR, no para pisar: un cliente puede
      // tener ya tres teléfonos apuntados y guardar solo el nuevo los borraría.
      const actual = await fetch("/api/gestoria/clientes/identidad")
        .then((r) => r.json())
        .then((j) => (j.clientes || []).find((c: { id: string }) => c.id === aprender.clienteId))
        .catch(() => null);

      const res = await fetch("/api/gestoria/clientes/identidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: aprender.clienteId,
          nif: aprender.nif || actual?.nif || "",
          telefonos: [...(actual?.telefonos ?? []), ...(aprender.telefono ? [aprender.telefono] : [])],
          emails: actual?.emails ?? [],
        }),
      });
      const j = await res.json();
      setAviso(
        j.error
          ? j.error
          : `Guardado en la ficha de ${aprender.clienteNombre}. Sus próximas facturas se reconocerán solas.`,
      );
      if (!j.error) setAprender(null);
    } finally {
      setGuardandoAprendido(false);
    }
  }

  async function subir(lista: FileList | File[]) {
    const ficheros = Array.from(lista);
    if (!ficheros.length || !clienteId) return;
    setSubiendo(true);
    setAviso("");
    try {
      const fd = new FormData();
      fd.append("clienteId", clienteId);
      for (const f of ficheros) fd.append("ficheros", f);
      const res = await fetch("/api/gestoria/facturas", { method: "POST", body: fd });
      const json = await res.json();
      const fuera = json.rechazadas?.length ?? 0;
      setAviso(
        json.ok
          ? `${json.creadas} ${json.creadas === 1 ? "factura subida" : "facturas subidas"}` +
            (fuera
              ? ` · ${fuera === 1 ? "1 no se pudo subir" : `${fuera} no se pudieron subir`}: solo valen fotos y PDF`
              : "")
          // El error que devuelve el servidor está escrito para quien programa
          // ("falta clienteId"). Aquí se dice lo que el gestor puede hacer.
          : "No se pudieron subir. Inténtalo otra vez; si sigue fallando, avísanos.",
      );
      recargar();
    } finally {
      setSubiendo(false);
    }
  }

  async function editar(f: Factura) {
    // Deliberadamente a mano: no hay OCR y el importe lo teclea el gestor.
    const importe = prompt(`Importe en euros de "${f.nombre_original}"`, f.importe?.toString() ?? "");
    if (importe === null) return;
    const fecha = prompt("Fecha de la factura, con el formato año-mes-día (2026-08-12)", f.fecha_factura ?? "");
    if (fecha === null) return;
    const proveedor = prompt("Quién la emite (proveedor)", f.proveedor ?? "");

    await fetch("/api/gestoria/facturas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: f.id,
        importe: importe.trim() ? Number(importe.replace(",", ".")) : null,
        fecha_factura: fecha.trim() || null,
        proveedor: proveedor?.trim() || null,
      }),
    });
    recargar();
  }

  /** Volver a leer UNO. El botón de reintentar de la tarjeta. */
  async function releer(id: string) {
    setReleyendo(id);
    try {
      const res = await fetch("/api/gestoria/facturas/leer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await res.json();
      if (j.error) setAviso(j.error);
      await recargar();
    } finally {
      setReleyendo(null);
    }
  }

  /** Ponerse al día con los que entraron antes de que esto se leyera solo. */
  async function releerPendientes() {
    setReleyendo("todos");
    setAviso("Leyendo los que faltan… esto tarda unos segundos por documento.");
    try {
      const res = await fetch("/api/gestoria/facturas/leer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendientes: true }),
      });
      const j = await res.json();
      if (j.error) setAviso(j.error);
      else {
        // Se dice lo que ha fallado y lo que queda: un tope callado parece
        // "ya está todo leído" cuando no lo está.
        const partes = [`Leídos ${j.leidos}.`];
        if (j.colocados) partes.push(`${j.colocados} colocados solos en su cliente.`);
        if (j.conflictos) partes.push(`${j.conflictos} en conflicto: mira las fichas.`);
        if (j.fallos?.length) partes.push(`${j.fallos.length} no se han podido leer.`);
        if (j.quedan > 0) partes.push(`Quedan ${j.quedan} por leer: dale otra vez.`);
        setAviso(partes.join(" "));
      }
      await recargar();
    } finally {
      setReleyendo(null);
    }
  }

  /**
   * Mover un documento a otro cliente cuando la máquina se equivocó.
   *
   * Discreto a propósito: no es una decisión que haya que tomar por documento,
   * es un arreglo para el caso raro. Y al mover a mano se marca `manual`, para
   * que la asignación automática no vuelva a tocarlo nunca.
   */
  async function reasignar(f: Factura) {
    const opciones = clientes.map((c, i) => `${i + 1}. ${c.nombre}`).join("\n");
    const elegido = prompt(
      `¿A qué cliente va "${f.nombre_original}"?\n\n${opciones}\n\nEscribe el número:`,
      "",
    );
    if (!elegido) return;
    const idx = Number(elegido.trim()) - 1;
    const destinoCliente = clientes[idx];
    if (!destinoCliente) { setAviso("Ese número no está en la lista."); return; }
    await fetch("/api/gestoria/facturas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id, cliente_id: destinoCliente.id }),
    });
    setAviso(`Movido a ${destinoCliente.nombre}.`);
    recargar();
  }

  /** "No es duplicado": lo devuelve a normal y no se le vuelve a marcar. */
  async function noEsDuplicado(f: Factura) {
    await fetch("/api/gestoria/facturas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id, no_es_duplicado: true }),
    });
    setAviso(`"${f.nombre_original}" vuelve a contar como documento normal.`);
    recargar();
  }

  async function descartar(f: Factura) {
    if (!confirm(`¿Descartar "${f.nombre_original}"? No se borra: se guarda igual, pero deja de cuadrarse con el banco.`)) return;
    await fetch("/api/gestoria/facturas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id, estado: "descartada" }),
    });
    recargar();
  }

  return (
    <div className="space-y-4">
      {/* El documento, encima del listado y no en otra pestaña. La página no se
          recarga, así que al cerrar se vuelve justo a donde estabas. */}
      {viendo?.verUrl && (
        <VisorDocumento
          url={viendo.verUrl}
          nombre={viendo.nombre_original}
          tipo={viendo.tipo}
          onCerrar={() => setViendo(null)}
        />
      )}

      {/* BANDEJA SIN ASIGNAR — solo aparece si hay algo. Va la primera porque es
          trabajo parado: hasta que no tengan dueño no entran en ninguna
          conciliación y no le cuadran a nadie. */}
      {/* LO QUE SE ACABA DE APRENDER. Sale después de asignar a mano y se guarda
          SOLO si el gestor le da al botón. */}
      {aprender && (
        <div className="card-hard bg-white p-3 border-4">
          <div className="font-bold text-sm mb-1">
            ¿Lo apunto en la ficha de {aprender.clienteNombre}?
          </div>
          <p className="text-xs text-black/70 mb-2">
            Este documento traía {aprender.nif ? <>el NIF <b className="font-mono">{aprender.nif}</b></> : null}
            {aprender.nif && aprender.telefono ? " y " : null}
            {aprender.telefono ? <>el teléfono <b className="font-mono">{aprender.telefono}</b></> : null}
            , y no estaba en la ficha de nadie. Si lo guardo, la próxima factura suya se reconoce sola y no
            tendrás que asignarla a mano.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={guardarAprendido}
              disabled={guardandoAprendido}
              className="btn-mustard text-xs px-3 py-1.5 disabled:opacity-50"
            >
              {guardandoAprendido ? "Guardando…" : `Guardar en la ficha de ${aprender.clienteNombre}`}
            </button>
            <button
              type="button"
              onClick={() => setAprender(null)}
              className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white"
            >
              ahora no
            </button>
          </div>
        </div>
      )}

      {/* EL CONTADOR, siempre visible aunque la bandeja esté vacía. Es lo que
          convierte "18 documentos pendientes" en "18 de 1.258": sin el número
          grande al lado, dieciocho parece un problema y es el 1%. */}
      {recuento && (recuento.asignadas > 0 || recuento.sinIdentificar > 0) && (
        <div className="border-2 border-black bg-white px-3 py-2 text-sm flex items-center gap-2 flex-wrap">
          <span className="font-bold">{recuento.asignadas.toLocaleString("es-ES")} asignadas solas</span>
          <span className="text-black/40">·</span>
          <span className={recuento.sinIdentificar > 0 ? "font-bold" : "text-black/60"}>
            {recuento.sinIdentificar.toLocaleString("es-ES")} sin identificar
          </span>
          {recuento.conflictos > 0 && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-[color:var(--red)] text-white border-2 border-black px-1.5 py-0.5">
              {recuento.conflictos} en conflicto
            </span>
          )}
          {/* Los duplicados, contados aparte: es el error que más caro sale
              —deducir el mismo IVA dos veces— y el que menos se ve. */}
          {recuento.duplicadosMes > 0 && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-black text-white border-2 border-black px-1.5 py-0.5">
              {recuento.duplicadosMes} duplicado{recuento.duplicadosMes === 1 ? "" : "s"} este mes
            </span>
          )}
          <span className="text-[11px] text-black/50 ml-auto">
            Se colocan solas por NIF o por teléfono. Aquí solo cae lo que no se ha podido resolver.
          </span>
        </div>
      )}

      {sinAsignar.length > 0 && (
        <div className="card-hard bg-[color:var(--mustard)] p-4">
          <h2 className="font-stencil text-2xl leading-none mb-1">
            Sin identificar · {sinAsignar.length}
          </h2>
          <p className="text-xs text-black/70 mb-2">
            La excepción, no la norma: lo que no trae un NIF ni un teléfono que esté en ninguna ficha.
            Si le pones el NIF al cliente, las siguientes se colocan solas.
          </p>
          {/* Ponerse al día: los documentos que entraron ANTES de que esto se
              leyera solo siguen en blanco, y no se arreglan con esperar. */}
          {sinAsignar.length > 0 && (
            <button
              type="button"
              onClick={releerPendientes}
              disabled={releyendo !== null}
              className="text-[10px] font-mono uppercase tracking-widest border-2 border-black bg-white px-2 py-1 mb-3 hover:bg-black hover:text-white disabled:opacity-50"
            >
              {releyendo === "todos" ? "Leyendo…" : "Leer y colocar los que faltan"}
            </button>
          )}
          <div className="space-y-2">
            {sinAsignar.map((f) => (
              <div key={f.id} className="border-2 border-black bg-white p-2 flex items-center gap-3 flex-wrap">
                <div className="w-14 h-14 border-2 border-black bg-[color:var(--cream)] grid place-items-center shrink-0 overflow-hidden">
                  {f.tipo === "imagen" && f.verUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.verUrl} alt={f.nombre_original} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">📄</span>
                  )}
                </div>
                <div className="flex-1 min-w-[10rem]">
                  <div className="text-sm font-bold truncate">{f.nombre_original}</div>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <Origen origen={f.origen} />
                    {esReciente(f.fecha_recepcion) && <Nuevo />}
                    <span className="text-[11px] font-mono text-black/60 truncate">
                      Entró: {entradaCorta(f.fecha_recepcion)}
                      {f.remitente ? ` · ${f.remitente}` : ""}
                    </span>
                  </div>
                  {f.asunto && (
                    <div className="text-[11px] font-mono text-black/60 truncate">Asunto: {f.asunto}</div>
                  )}
                  {/* LO QUE DICE EL PAPEL, aquí arriba. Antes solo se veía el
                      nombre del fichero, así que había que decidir de quién era
                      un documento sin ver ni el proveedor ni el importe. */}
                  <ResumenLeido f={f} onReintentar={() => releer(f.id)} reintentando={releyendo === f.id} />
                  {/* CONFLICTO: el dato duro apunta a dos clientes a la vez, así
                      que no se ha asignado. Elegir uno a cara o cruz dejaría un
                      error escrito y silencioso; se dice y se arregla en las
                      fichas, que es donde está el fallo de verdad. */}
                  <AvisoDuplicado f={f} onNoEsDuplicado={() => noEsDuplicado(f)} />
                  {f.conflicto && (
                    <div className="text-[11px] font-bold bg-[color:var(--red)] text-white border-2 border-black px-2 py-1 mt-1">
                      ⚠️ {f.conflicto.detalle}{" "}
                      <a href="/dashboard/expedientes" className="underline">Arreglar las fichas</a>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 items-center flex-wrap">
                  {f.verUrl && (
                    <button type="button" onClick={() => setViendo(f)}
                      className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white">ver</button>
                  )}
                  {/* En un CONFLICTO no viene nada elegido, y el botón no deja
                      asignar hasta que el gestor elige. Preseleccionar a uno de
                      los dos candidatos sería ofrecerle que acepte una moneda al
                      aire de un clic — justo lo que la máquina se ha negado a
                      hacer dos pasos antes. Sin conflicto sí se preselecciona:
                      ahí no hay ambigüedad, solo falta el dato. */}
                  <select
                    value={destino[f.id] ?? (f.conflicto ? "" : clientes[0]?.id ?? "")}
                    onChange={(e) => setDestino((d) => ({ ...d, [f.id]: e.target.value }))}
                    className="border-2 border-black px-2 py-1 text-xs bg-white"
                  >
                    {f.conflicto && <option value="">— elige tú —</option>}
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => asignar(f)}
                    disabled={!clientes.length || (!!f.conflicto && !destino[f.id])}
                    title={f.conflicto && !destino[f.id] ? "Elige tú de quién es: el NIF está en dos fichas" : undefined}
                    className="btn-mustard text-[10px] px-2 py-1 disabled:opacity-60"
                  >
                    asignar
                  </button>
                  <button type="button" onClick={() => descartar(f)}
                    className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white">descartar</button>
                </div>
                {/* Qué es y qué pone. En la MISMA tarjeta: si hay que abrir otra
                    pestaña para comprobar un NIF, se deja de comprobar. */}
                <div className="w-full">
                  <LecturaDocumento facturaId={f.id} lectura={f.lectura} error={f.lectura_error} estado={f.lectura_estado} onCambio={recargar} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Solo el cliente. Los botones del banco estaban aquí y hacían creer que
          la pantalla empezaba por ahí: se han bajado al final, que es cuando
          toca usarlos. */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs font-mono uppercase tracking-widest text-black/60">Cliente</label>
        <select
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          className="card-hard px-3 py-2 bg-white text-sm"
        >
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {/* La vuelta: del gestor al cliente. Va aquí, en la ficha del cliente,
          porque es donde el gestor ya está cuando le escriben "mandame el 303". */}
      <EnviarDocumento clienteId={clienteId} clienteNombre={clientes.find((c) => c.id === clienteId)?.nombre ?? ""} />

      {/* Zona de arrastre */}
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastrando(false); subir(e.dataTransfer.files); }}
        className={`card-hard p-6 text-center ${arrastrando ? "bg-[color:var(--mustard)]" : "bg-white"}`}
      >
        <p className="font-stencil text-2xl leading-none mb-1">Arrastra las facturas aquí</p>
        <p className="text-xs text-black/60 mb-3">Imagen o PDF · varias a la vez</p>
        <div className="flex gap-2 justify-center flex-wrap">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={subiendo}
            className="btn-mustard text-xs px-3 py-2 disabled:opacity-60">
            {subiendo ? "Subiendo…" : "Elegir factura(s)"}
          </button>
          {/* `capture` abre la cámara directamente en el móvil. */}
          <label className="text-xs font-mono uppercase tracking-widest border-2 border-black px-3 py-2 cursor-pointer hover:bg-black hover:text-white">
            Hacer foto
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => e.target.files && subir(e.target.files)} />
          </label>
        </div>
        <input ref={inputRef} type="file" multiple accept="image/*,application/pdf" className="hidden"
          onChange={(e) => e.target.files && subir(e.target.files)} />
        {aviso && <p className="text-xs font-mono mt-3">{aviso}</p>}
      </div>

      <div className="card-hard bg-white p-4">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <h2 className="font-stencil text-2xl leading-none">
            Facturas de este cliente {cargando ? "· cargando…" : `· ${facturas.length}`}
          </h2>
          {facturas.some((f) => !f.lectura) && (
            <button
              type="button"
              onClick={releerPendientes}
              disabled={releyendo !== null}
              className="text-[10px] font-mono uppercase tracking-widest border-2 border-black bg-white px-2 py-1 hover:bg-black hover:text-white disabled:opacity-50"
            >
              {releyendo === "todos" ? "Leyendo…" : "Leer los que faltan"}
            </button>
          )}
        </div>
        {facturas.length === 0 ? (
          <p className="text-sm text-black/60">Todavía no hay facturas de este cliente.</p>
        ) : (
          <div className="space-y-2">
            {facturas.map((f) => (
              <div key={f.id} className="border-2 border-black p-2 flex items-center gap-3 flex-wrap">
                <div className="w-14 h-14 border-2 border-black bg-[color:var(--cream)] grid place-items-center shrink-0 overflow-hidden">
                  {f.tipo === "imagen" && f.verUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.verUrl} alt={f.nombre_original} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">📄</span>
                  )}
                </div>
                <div className="flex-1 min-w-[10rem]">
                  <div className="text-sm font-bold truncate">{f.nombre_original}</div>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <Origen origen={f.origen} />
                    {esReciente(f.fecha_recepcion) && <Nuevo />}
                    {/* Las DOS fechas van etiquetadas. Sin etiqueta, "12/08" y
                        "03/03" seguidas no dicen cuál es cuál, y confundir la
                        fecha de la factura con la de entrada es lo que hace que
                        se cuele una factura en el trimestre que no toca. */}
                    <ClaseEtiqueta clase={f.clase} />
                    <span className="text-[11px] font-mono text-black/60">
                      Entró: {entradaCorta(f.fecha_recepcion)} · {ESTADO_TEXTO[f.estado]}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-black/60">
                    {f.importe != null ? euros(f.importe) : "sin importe todavía"}
                    {f.fecha_factura ? ` · Factura: ${fechaCorta(f.fecha_factura)}` : ""}
                    {f.proveedor ? ` · ${f.proveedor}` : ""}
                  </div>
                  {!f.lectura && (
                    <ResumenLeido f={f} onReintentar={() => releer(f.id)} reintentando={releyendo === f.id} />
                  )}
                  <AvisoDuplicado f={f} onNoEsDuplicado={() => noEsDuplicado(f)} />
                  {/* POR QUÉ está en este cliente. En pequeño, porque el 99% de
                      las veces está bien y no hay nada que hacer; pero cuando
                      está mal, el gestor tiene que poder ver de dónde salió la
                      decisión sin preguntarle a nadie. */}
                  {f.asignado_motivo && (
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-[10px] font-mono text-black/45">
                        Se colocó solo · {f.asignado_motivo}
                      </span>
                      <button
                        type="button"
                        onClick={() => reasignar(f)}
                        className="text-[9px] font-mono uppercase border border-black/30 px-1 py-0.5 text-black/50 hover:border-black hover:text-black"
                      >
                        cambiar de cliente
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  {f.verUrl && (
                    <button type="button" onClick={() => setViendo(f)}
                      className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white">ver</button>
                  )}
                  <button type="button" onClick={() => editar(f)}
                    className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white">editar</button>
                  <button type="button" onClick={() => descartar(f)}
                    className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white">descartar</button>
                </div>
                <div className="w-full">
                  <LecturaDocumento facturaId={f.id} lectura={f.lectura} error={f.lectura_error} estado={f.lectura_estado} onCambio={recargar} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SEGUNDA FASE. Separada por una línea a propósito: durante el mes esto
          no se toca, las facturas entran solas. Se baja aquí para que el orden
          de la pantalla sea el orden real del trabajo. */}
      <div className="border-t-[3px] border-black pt-4 mt-6">
        <h2 className="font-stencil text-2xl leading-none">Cuando ya estén todas las facturas</h2>
        <p className="text-sm text-black/60 mt-1">
          {extracto
            ? <>Extracto subido: del <b>{fechaCorta(extracto.desde)}</b> al <b>{fechaCorta(extracto.hasta)}</b>.</>
            : "Todavía no has subido el extracto de este cliente."}
        </p>
        <div className="flex gap-2 flex-wrap mt-3">
          <a href="/dashboard/facturas/banco"
            className="text-xs font-mono uppercase tracking-widest border-2 border-black px-3 py-2 hover:bg-black hover:text-white">
            Subir extracto del banco
          </a>
          {extracto ? (
            <a href={`/dashboard/facturas/conciliacion?clienteId=${encodeURIComponent(clienteId)}`}
              className="text-xs font-mono uppercase tracking-widest border-2 border-black px-3 py-2 hover:bg-black hover:text-white">
              Conciliación
            </a>
          ) : (
            <span title="Primero sube el extracto del banco"
              className="text-xs font-mono uppercase tracking-widest border-2 border-black px-3 py-2 opacity-40 cursor-not-allowed">
              Conciliación
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
