"use client";

// Subida de facturas y listado del saco de un cliente.
//
// Arrastrar y soltar, y `capture` en móvil para tirar la foto directamente: el
// gestor está delante del montón de tickets con el teléfono en la mano, no
// buscando ficheros en un explorador.

import { useCallback, useEffect, useRef, useState } from "react";
import LecturaDocumento, { type Lectura as LecturaTipo } from "./LecturaDocumento";
import EnviarDocumento from "./EnviarDocumento";

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
  clase?: string;
  contable?: boolean;
};

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
        if (vivo) setSinAsignar(porEntradaReciente(json.facturas ?? []));
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
    const destinoId = destino[f.id] || clientes[0]?.id;
    if (!destinoId) return;
    await fetch("/api/gestoria/facturas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id, cliente_id: destinoId }),
    });
    recargar();
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
      {/* BANDEJA SIN ASIGNAR — solo aparece si hay algo. Va la primera porque es
          trabajo parado: hasta que no tengan dueño no entran en ninguna
          conciliación y no le cuadran a nadie. */}
      {sinAsignar.length > 0 && (
        <div className="card-hard bg-[color:var(--mustard)] p-4">
          <h2 className="font-stencil text-2xl leading-none mb-1">
            Facturas sin asignar · {sinAsignar.length}
          </h2>
          <p className="text-xs text-black/70 mb-3">
            Llegaron de un número o un correo que no está en ninguna ficha. Diles de quién son para que cuenten en su cuadre.
          </p>
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
                </div>
                <div className="flex gap-1 items-center flex-wrap">
                  {f.verUrl && (
                    <a href={f.verUrl} target="_blank" rel="noreferrer"
                      className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white">ver</a>
                  )}
                  <select
                    value={destino[f.id] ?? clientes[0]?.id ?? ""}
                    onChange={(e) => setDestino((d) => ({ ...d, [f.id]: e.target.value }))}
                    className="border-2 border-black px-2 py-1 text-xs bg-white"
                  >
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  <button type="button" onClick={() => asignar(f)} disabled={!clientes.length}
                    className="btn-mustard text-[10px] px-2 py-1 disabled:opacity-60">asignar</button>
                  <button type="button" onClick={() => descartar(f)}
                    className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white">descartar</button>
                </div>
                {/* Qué es y qué pone. En la MISMA tarjeta: si hay que abrir otra
                    pestaña para comprobar un NIF, se deja de comprobar. */}
                <div className="w-full">
                  <LecturaDocumento facturaId={f.id} lectura={f.lectura} error={f.lectura_error} onCambio={recargar} />
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
        <h2 className="font-stencil text-2xl leading-none mb-3">
          Facturas de este cliente {cargando ? "· cargando…" : `· ${facturas.length}`}
        </h2>
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
                    <span className="text-[11px] font-mono text-black/60">
                      Entró: {entradaCorta(f.fecha_recepcion)} · {ESTADO_TEXTO[f.estado]}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-black/60">
                    {f.importe != null ? euros(f.importe) : "sin importe todavía"}
                    {f.fecha_factura ? ` · Factura: ${fechaCorta(f.fecha_factura)}` : ""}
                    {f.proveedor ? ` · ${f.proveedor}` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  {f.verUrl && (
                    <a href={f.verUrl} target="_blank" rel="noreferrer"
                      className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white">ver</a>
                  )}
                  <button type="button" onClick={() => editar(f)}
                    className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white">editar</button>
                  <button type="button" onClick={() => descartar(f)}
                    className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white">descartar</button>
                </div>
                <div className="w-full">
                  <LecturaDocumento facturaId={f.id} lectura={f.lectura} error={f.lectura_error} onCambio={recargar} />
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
