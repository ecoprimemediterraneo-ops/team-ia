"use client";

// "Pagado sin factura": lo que Jose puede arreglar hoy con una llamada.
//
// Un albarán no deduce IVA y un ticket tampoco. Cuando uno de ellos cuadra con
// un pago del banco, ese gasto está pagado pero NO está justificado: falta la
// factura de verdad, y a Hacienda no le vale el albarán. Antes esto se perdía
// dentro del montón de "cargos sin justificar", mezclado con cosas de las que no
// se sabe nada.
//
// La diferencia es que aquí SÍ se sabe todo: de qué proveedor, de cuánto, de qué
// día y de qué cliente. No es un misterio que investigar, es una factura que
// pedir. Por eso se saca del montón y se dice con nombre y cifra —"Bar El
// Puerto: 5 albaranes pagados sin factura · 1.240 €"—: el nombre dice a quién
// llamar y la cifra dice si merece la pena llamar hoy o el viernes.

import { useState } from "react";

type Documento = {
  movimientoId: string;
  fecha: string;
  concepto: string;
  importe: number;
  tipo: "ALBARAN" | "TICKET";
  documentoNombre: string;
  proveedor: string | null;
  fechaDocumento: string | null;
};

type Grupo = {
  clienteId: string;
  clienteNombre: string;
  cuantos: number;
  total: number;
  albaranes: number;
  tickets: number;
  documentos: Documento[];
};

const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const fechaCorta = (f: string) => {
  const d = new Date(f);
  return isNaN(d.getTime()) ? f : d.toLocaleDateString("es-ES");
};

/** "5 albaranes" · "3 albaranes y 2 tickets" · "2 tickets". */
function queSon(g: Grupo): string {
  const partes: string[] = [];
  if (g.albaranes) partes.push(`${g.albaranes} ${g.albaranes === 1 ? "albarán" : "albaranes"}`);
  if (g.tickets) partes.push(`${g.tickets} ${g.tickets === 1 ? "ticket" : "tickets"}`);
  return partes.join(" y ");
}

export default function PagadoSinFactura({ grupos }: { grupos: Grupo[] }) {
  const [abierto, setAbierto] = useState<string | null>(null);

  // Sin nada que reclamar no se enseña una tarjeta vacía diciendo que todo va
  // bien: ocupa sitio arriba del todo y no cambia nada de lo que Jose hace.
  if (!grupos.length) return null;

  const totalDocs = grupos.reduce((s, g) => s + g.cuantos, 0);
  const totalEuros = grupos.reduce((s, g) => s + g.total, 0);

  return (
    <div className="card-hard bg-[color:var(--red)] text-white p-4">
      <h2 className="font-stencil text-2xl leading-none mb-1">
        Pagado sin factura · {totalDocs} {totalDocs === 1 ? "documento" : "documentos"} · {euros(totalEuros)}
      </h2>
      <p className="text-xs opacity-90 mb-3">
        Estos pagos cuadran con un albarán o un ticket, no con una factura. Están pagados pero no deducen IVA:
        hay que pedirle al cliente la factura buena.
      </p>

      <div className="space-y-2">
        {grupos.map((g) => (
          <div key={g.clienteId} className="bg-white text-black border-2 border-black">
            <button
              type="button"
              onClick={() => setAbierto(abierto === g.clienteId ? null : g.clienteId)}
              className="w-full text-left p-2 flex items-center gap-2 flex-wrap hover:bg-[color:var(--cream)]"
            >
              <span className="font-bold text-sm flex-1 min-w-[10rem]">
                {g.clienteNombre}: {queSon(g)} {g.cuantos === 1 ? "pagado" : "pagados"} sin factura ·{" "}
                {euros(g.total)}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest border-2 border-black px-1.5 py-0.5">
                {abierto === g.clienteId ? "ocultar" : "ver cuáles"}
              </span>
            </button>

            {abierto === g.clienteId && (
              <div className="border-t-2 border-black p-2 space-y-1">
                {g.documentos.map((d) => (
                  <div key={d.movimientoId} className="border-2 border-black/15 px-2 py-1 text-[11px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 ${
                          d.tipo === "ALBARAN"
                            ? "bg-[color:var(--red)] text-white"
                            : "bg-[color:var(--mustard)] text-black"
                        }`}
                      >
                        {d.tipo === "ALBARAN" ? "ALBARÁN" : "TICKET"}
                      </span>
                      <span className="font-bold">{d.proveedor || d.documentoNombre}</span>
                      <span className="font-mono ml-auto">{euros(d.importe)}</span>
                    </div>
                    <div className="font-mono text-black/60 mt-0.5">
                      Pagado el {fechaCorta(d.fecha)}
                      {d.fechaDocumento ? ` · documento del ${fechaCorta(d.fechaDocumento)}` : ""}
                      {` · ${d.concepto}`}
                    </div>
                  </div>
                ))}
                {/* La reclamación NO se inventa aquí: se hace donde ya se hacía,
                    con sus tres candados y su plantilla de Meta. Desde aquí solo
                    se señala el camino. */}
                <a
                  href={`/dashboard/facturas/conciliacion?clienteId=${encodeURIComponent(g.clienteId)}`}
                  className="inline-block text-[10px] font-mono uppercase tracking-widest border-2 border-black px-2 py-1 mt-1 hover:bg-black hover:text-white"
                >
                  Reclamar estas facturas →
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
