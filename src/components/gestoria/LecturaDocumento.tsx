"use client";

// Lo que la IA ha leído del documento, AL LADO de la imagen.
//
// Al lado y no en otra pantalla: el gestor comprueba mirando el papel y el dato
// a la vez. Si para verificar un NIF tiene que abrir el fichero en otra pestaña
// y volver, deja de comprobar a los tres documentos.
//
// LO PRIMERO DE TODO ES LA CLASE. Antes que el proveedor y antes que el importe:
// un ticket con pinta de factura es lo que le cuesta dinero al cliente meses
// después, cuando Hacienda le quita una deducción que nunca tuvo.
//
// Lo que la IA no ha leído con seguridad va marcado, discreto: un punto y el
// dato en gris. No en rojo — si se pinta de alarma lo que solo es "compruébalo",
// la pantalla entera parece rota.

import { useState } from "react";

export type LineaIVA = { tipo: number | null; base: number | null; cuota: number | null };
export type Campo<T> = { valor: T | null; seguro: boolean };

export type Lectura = {
  clase: "factura_completa" | "ticket" | "albaran" | "abono" | "presupuesto" | "otro";
  confianza: "alta" | "media" | "baja";
  porQue: string;
  emisor: Campo<string>;
  nifEmisor: Campo<string>;
  nifDestinatario: Campo<string>;
  numero: Campo<string>;
  fecha: Campo<string>;
  lineas: LineaIVA[];
  total: Campo<number>;
  rectificaA: Campo<string>;
  degradadaSinIva?: boolean;
  avisos: string[];
};

// CUATRO tipos en pantalla, no seis. Dentro se siguen distinguiendo el abono y
// el presupuesto —la regla del IVA y el cruce con el banco los necesitan— pero
// al gestor se le enseñan cuatro cajas. Un abono es una FACTURA en negativo: es
// la misma factura corrigiéndose, y darle caja propia obligaba a explicar una
// diferencia a alguien que ya sabe lo que es una rectificativa.
const ETIQUETA: Record<Lectura["clase"], string> = {
  factura_completa: "FACTURA",
  abono: "FACTURA (ABONO, EN NEGATIVO)",
  ticket: "TICKET",
  albaran: "ALBARÁN",
  presupuesto: "OTROS",
  otro: "OTROS",
};

// Verde solo lo que sirve para deducir. Mostaza: guárdalo pero ojo. Rojo: no es
// documento contable. El color dice qué hacer, no qué es.
const COLOR: Record<Lectura["clase"], string> = {
  factura_completa: "bg-green-700 text-white",
  abono: "bg-green-700 text-white",
  ticket: "bg-[color:var(--mustard)] text-black",
  albaran: "bg-[color:var(--red)] text-white",
  presupuesto: "bg-black/70 text-white",
  otro: "bg-black/70 text-white",
};

const euros = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });


/**
 * Un dato, editable con un clic. En gris y con un punto si la IA dudó.
 *
 * Va FUERA del componente padre a propósito: declarado dentro, React lo ve como
 * un tipo distinto en cada pintada, lo desmonta y lo vuelve a montar — y el
 * campo de texto pierde el foco a la primera tecla que escribes.
 */
function Dato({ etiqueta, campo, c, texto, editando, borrador, guardando, onEditar, onBorrador, onGuardar, onCancelar }: {
  etiqueta: string;
  campo: string;
  c: Campo<string | number>;
  texto?: string;
  editando: string | null;
  borrador: string;
  guardando: boolean;
  onEditar: (campo: string, valor: string) => void;
  onBorrador: (v: string) => void;
  onGuardar: (campo: string, valor: string) => void;
  onCancelar: () => void;
}) {
  const mostrado = texto ?? (c.valor === null || c.valor === "" ? "—" : String(c.valor));
  if (editando === campo) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-mono uppercase text-black/50 w-24 shrink-0">{etiqueta}</span>
        <input
          autoFocus
          value={borrador}
          onChange={(e) => onBorrador(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onGuardar(campo, borrador); if (e.key === "Escape") onCancelar(); }}
          className="border-2 border-black px-1 py-0.5 text-xs flex-1 min-w-0"
        />
        <button onClick={() => onGuardar(campo, borrador)} disabled={guardando}
          className="text-[10px] font-mono border-2 border-black px-1.5 py-0.5">ok</button>
      </div>
    );
  }
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[10px] font-mono uppercase text-black/50 w-24 shrink-0">{etiqueta}</span>
      <button
        type="button"
        onClick={() => onEditar(campo, c.valor === null ? "" : String(c.valor))}
        title="Clic para corregir"
        className={`text-xs text-left hover:underline decoration-dotted ${c.seguro ? "" : "text-black/45"}`}
      >
        {!c.seguro && <span title="La IA no lo ha leído con seguridad" className="mr-1">•</span>}
        {mostrado}
      </button>
    </div>
  );
}

export default function LecturaDocumento({
  facturaId,
  lectura,
  error,
  estado,
  onCambio,
}: {
  facturaId: string;
  lectura?: Lectura | null;
  error?: string;
  /** En qué punto va la lectura. Distingue "espera" de "no se ha leído". */
  estado?: "leyendo" | "hecha" | "error";
  onCambio?: () => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(campo: string, valor: string) {
    setGuardando(true);
    try {
      await fetch("/api/gestoria/facturas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: facturaId, campo, valor }),
      });
      setEditando(null);
      onCambio?.();
    } finally {
      setGuardando(false);
    }
  }

  if (error) {
    return (
      <div className="border-2 border-black bg-[color:var(--cream)] p-2 text-[11px]">
        <span className="font-bold">No se ha podido leer.</span> {error}
      </div>
    );
  }
  if (!lectura) {
    // "Leyendo" y "sin leer" NO son lo mismo: uno se resuelve solo en unos
    // segundos y el otro no se resuelve nunca si nadie hace nada.
    if (estado === "leyendo") {
      return (
        <div className="border-2 border-dashed border-black/30 p-2 text-[11px] text-black/60 animate-pulse">
          Leyendo… la IA está sacando el proveedor, el importe y el tipo.
        </div>
      );
    }
    return (
      <div className="border-2 border-dashed border-black/30 p-2 text-[11px] text-black/50">
        Sin leer todavía.
      </div>
    );
  }

  return (
    <div className="border-2 border-black bg-white p-2 space-y-1.5 min-w-[16rem] flex-1">
      {/* LA CLASE, LO PRIMERO */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-mono font-bold px-2 py-1 ${COLOR[lectura.clase]}`}>
          {ETIQUETA[lectura.clase]}
        </span>
        {lectura.confianza !== "alta" && (
          <span className="text-[10px] font-mono uppercase text-black/50">
            confianza {lectura.confianza}
          </span>
        )}
        {/* AQUÍ HABÍA UN DESPLEGABLE para cambiar el tipo a mano. Se ha quitado:
            clasificar no es trabajo del gestor, es trabajo del sistema. Con cien
            facturas al mes por cliente, un desplegable por documento es una
            decisión que se le pide diez mil veces al mes y que además invita a
            "corregir" a la IA cuando la IA tenía razón. La corrección sigue
            existiendo por la API (`PATCH campo=clase`) para administración. */}
      </div>

      {lectura.porQue && <p className="text-[11px] text-black/60 leading-snug">{lectura.porQue}</p>}

      {/* LOS AVISOS, que se vean. Nada de letra pequeña: si un ticket no deduce
          IVA, eso es lo más importante de la tarjeta. */}
      {lectura.avisos.map((a, i) => (
        <p key={i} className="text-[11px] font-bold bg-[color:var(--mustard)] border-2 border-black px-2 py-1 leading-snug">
          {a}
        </p>
      ))}

      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5 pt-1">
        <Dato etiqueta="Proveedor" campo="emisor" c={lectura.emisor}  editando={editando} borrador={borrador} guardando={guardando}
          onEditar={(campo, v) => { setEditando(campo); setBorrador(v); }}
          onBorrador={setBorrador} onGuardar={guardar} onCancelar={() => setEditando(null)} />
        <Dato etiqueta="NIF emisor" campo="nifEmisor" c={lectura.nifEmisor}  editando={editando} borrador={borrador} guardando={guardando}
          onEditar={(campo, v) => { setEditando(campo); setBorrador(v); }}
          onBorrador={setBorrador} onGuardar={guardar} onCancelar={() => setEditando(null)} />
        <Dato etiqueta="Nº factura" campo="numero" c={lectura.numero}  editando={editando} borrador={borrador} guardando={guardando}
          onEditar={(campo, v) => { setEditando(campo); setBorrador(v); }}
          onBorrador={setBorrador} onGuardar={guardar} onCancelar={() => setEditando(null)} />
        <Dato etiqueta="NIF cliente" campo="nifDestinatario" c={lectura.nifDestinatario}  editando={editando} borrador={borrador} guardando={guardando}
          onEditar={(campo, v) => { setEditando(campo); setBorrador(v); }}
          onBorrador={setBorrador} onGuardar={guardar} onCancelar={() => setEditando(null)} />
        <Dato etiqueta="Fecha" campo="fecha" c={lectura.fecha}  editando={editando} borrador={borrador} guardando={guardando}
          onEditar={(campo, v) => { setEditando(campo); setBorrador(v); }}
          onBorrador={setBorrador} onGuardar={guardar} onCancelar={() => setEditando(null)} />
        <Dato etiqueta="Total" campo="total" c={lectura.total as Campo<string | number>} texto={euros(lectura.total.valor)}  editando={editando} borrador={borrador} guardando={guardando}
          onEditar={(campo, v) => { setEditando(campo); setBorrador(v); }}
          onBorrador={setBorrador} onGuardar={guardar} onCancelar={() => setEditando(null)} />
      </div>

      {lectura.lineas.length > 0 && (
        <table className="w-full text-[11px] font-mono border-t border-black/20 pt-1">
          <thead>
            <tr className="text-black/50 text-left">
              <th className="font-normal">IVA</th><th className="font-normal text-right">Base</th><th className="font-normal text-right">Cuota</th>
            </tr>
          </thead>
          <tbody>
            {lectura.lineas.map((l, i) => (
              <tr key={i}>
                <td>{l.tipo == null ? "—" : `${l.tipo}%`}</td>
                <td className="text-right">{euros(l.base)}</td>
                <td className="text-right">{euros(l.cuota)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {lectura.rectificaA.valor && (
        <p className="text-[11px] font-mono text-black/60">Rectifica a: {lectura.rectificaA.valor}</p>
      )}
    </div>
  );
}
