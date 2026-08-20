"use client";

// Las ventas, en la misma pantalla que la conciliación de compras.
//
// Misma pantalla y no una nueva: es el mismo trabajo —cuadrar el banco— visto
// por el otro lado. El gestor sube el extracto una vez y quiere ver de una vez
// qué le falta por los dos lados.
//
// EL ORDEN DE LOS BLOQUES ES EL ORDEN DE LA PREOCUPACIÓN. Arriba, en rojo, los
// ingresos que pueden ser ventas y no tienen factura: eso es un problema con
// Hacienda. Después lo que hay que revisar. Al final, lo que ya cuadra y lo que
// no es una venta. Nada se esconde: los bloques se pueden plegar, no filtrar.

import { useState, useEffect, useCallback } from "react";

type Ingreso = { id: string; fecha: string; importe: number; concepto: string; grupo: string | null; etiqueta: string | null; fueraDelPeriodo: boolean };
type Candidata = { id: string; numero: string; fecha: string; total: number; destinatario: string | null };
type Sugerencia = { id: string; fecha: string; importe: number; concepto: string; motivo: string; candidatas: Candidata[] };
type Cuadrado = { id: string; fecha: string; importe: number; concepto: string; numero: string; fechaFactura: string };
type SinCobrar = { id: string; numero: string; fecha: string; total: number; destinatario: string | null };

type Resumen = {
  abonos: number; cuadrados: number; porRevisar: number;
  ventasSinFacturar: number; importeSinFacturar: number; noSonVentas: number; sinListado: number;
  facturasSinCobrar: number; importeSinCobrar: number;
};

type Datos = {
  resumen: Resumen; ventas: number;
  sinFactura: Ingreso[]; sugerencias: Sugerencia[]; cuadrados: Cuadrado[]; sinCobrar: SinCobrar[];
};

const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const corta = (iso: string) => { const [a, m, d] = (iso || "").split("-"); return d ? `${d}/${m}/${a}` : iso; };

const MOTIVO: Record<string, string> = {
  varias: "hay varias facturas del mismo importe",
  centimos: "cuadra por céntimos",
  fuera_de_plazo: "cuadra el importe pero se cobró mucho después",
};

export default function VentasDelCliente({ clienteId, clienteNombre }: { clienteId: string; clienteNombre: string }) {
  const [d, setD] = useState<Datos | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<string[] | null>(null);
  const [abierto, setAbierto] = useState<Record<string, boolean>>({ cuadrados: false, noVentas: false, sinCobrar: false });

  const cargar = useCallback(async () => {
    if (!clienteId) return;
    const r = await fetch(`/api/gestoria/ventas?clienteId=${encodeURIComponent(clienteId)}`);
    if (r.ok) setD(await r.json());
  }, [clienteId]);

  useEffect(() => { cargar(); }, [cargar]);

  async function subir(files: FileList | File[]) {
    const f = Array.from(files)[0];
    if (!f) return;
    setSubiendo(true); setAviso(null); setDetalle(null);
    try {
      const form = new FormData();
      form.append("clienteId", clienteId);
      form.append("listado", f);
      const r = await fetch("/api/gestoria/ventas", { method: "POST", body: form });
      const j = await r.json();
      if (!r.ok) { setAviso(`No se ha podido leer: ${j.error}`); return; }
      setAviso(`${j.leidas} facturas leídas del listado · ${j.creadas} nuevas${j.repetidas ? ` · ${j.repetidas} que ya estaban` : ""}`);
      // Se enseña QUÉ COLUMNA ha usado para cada campo: si se ha equivocado, el
      // gestor lo ve aquí y no descubriéndolo en el cruce.
      setDetalle([
        `Columnas: fecha=${j.columnas?.fecha ?? "—"} · nº=${j.columnas?.numero ?? "—"} · base=${j.columnas?.base ?? "—"} · IVA=${j.columnas?.iva ?? "—"} · total=${j.columnas?.total ?? "—"}`,
        ...(j.descartadas?.length ? [`Filas no leídas: ${j.descartadas.map((x: { fila: number; motivo: string }) => `${x.fila} (${x.motivo})`).join(", ")}`] : []),
        ...(j.muestra ?? []).slice(0, 5).map((l: { numero: string; fecha: string | null; base: number | null; iva: number | null; total: number | null }) =>
          `${l.fecha ?? "sin fecha"} · ${l.numero} · base ${l.base ?? "—"} · IVA ${l.iva ?? "—"} · total ${l.total}`),
      ]);
      await cargar();
    } finally { setSubiendo(false); }
  }

  async function accion(movimientoId: string, accion: "enlazar" | "no_es_venta", ventaId?: string) {
    await fetch("/api/gestoria/ventas", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movimientoId, ventaId, accion }),
    });
    await cargar();
  }

  const r = d?.resumen;
  const sospechosos = (d?.sinFactura ?? []).filter((x) => !x.grupo && !x.fueraDelPeriodo);
  const sinListado = (d?.sinFactura ?? []).filter((x) => !x.grupo && x.fueraDelPeriodo);
  const noVentas = (d?.sinFactura ?? []).filter((x) => x.grupo);

  return (
    <div className="space-y-4">
      <div className="border-t-[3px] border-black pt-4 mt-6">
        <h2 className="font-stencil text-2xl leading-none">Ventas de {clienteNombre}</h2>
        <p className="text-sm text-black/60 mt-1">
          El otro lado del banco: los ingresos contra las facturas que el cliente ha emitido.
          Un cargo sin factura es IVA que pierde el cliente; <b>un ingreso sin factura es un problema con Hacienda</b>.
        </p>
      </div>

      {/* Subir el listado */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); subir(e.dataTransfer.files); }}
        className="card-hard bg-white p-4"
      >
        <p className="text-sm mb-2">
          <b>El listado de facturas emitidas del mes.</b> Como lo saque su programa: Excel, CSV o PDF.
          No hace falta que las mande una a una.
        </p>
        <label className="btn-mustard text-xs px-3 py-2 cursor-pointer inline-block">
          {subiendo ? "Leyendo…" : "Elegir listado"}
          <input type="file" className="hidden" accept=".xlsx,.xlsm,.csv,.txt,.pdf,application/pdf"
            onChange={(e) => e.target.files && subir(e.target.files)} />
        </label>
        {d && d.ventas > 0 && (
          <span className="ml-3 text-xs font-mono text-black/60">{d.ventas} facturas emitidas cargadas</span>
        )}
        {aviso && <p className="text-sm font-bold mt-2">{aviso}</p>}
        {detalle && (
          <ul className="mt-2 text-[11px] font-mono text-black/60 space-y-0.5">
            {detalle.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        )}
      </div>

      {!d ? null : d.ventas === 0 ? (
        <div className="card-hard bg-[color:var(--cream)] p-4 text-sm text-black/70">
          Todavía no hay ningún listado de ventas de este cliente. Hasta que lo subas, no se puede saber qué ingresos
          del banco tienen factura detrás.
        </div>
      ) : (
        <>
          {/* El titular */}
          <div className={`card-hard p-4 ${r && r.ventasSinFacturar > 0 ? "bg-[color:var(--red)] text-white" : "bg-green-700 text-white"}`}>
            <p className="font-stencil text-2xl leading-none">
              {r && r.ventasSinFacturar > 0
                ? `${r.ventasSinFacturar} ingreso${r.ventasSinFacturar === 1 ? "" : "s"} sin factura emitida · ${euros(r.importeSinFacturar)}`
                : "Todos los ingresos tienen su factura"}
            </p>
            <p className="text-xs mt-1 opacity-90">
              De {r?.abonos ?? 0} ingresos: {r?.cuadrados ?? 0} cuadrados, {r?.porRevisar ?? 0} por revisar,
              {" "}{r?.noSonVentas ?? 0} que no son ventas
              {r && r.sinListado > 0 ? `, ${r.sinListado} de meses sin listado` : ""}.
            </p>
          </div>

          {/* 1. LO GRAVE */}
          {sospechosos.length > 0 && (
            <div className="card-hard bg-white p-4">
              <h3 className="font-stencil text-xl leading-none mb-1">Ingresos sin factura emitida · {sospechosos.length}</h3>
              <p className="text-xs text-black/60 mb-3">
                Entró dinero y no hay factura que lo justifique. O falta la factura en el listado, o es una venta sin
                declarar. Si alguno no es una venta, quítalo y deja de salir.
              </p>
              <div className="space-y-2">
                {sospechosos.map((m) => (
                  <div key={m.id} className="border-2 border-[color:var(--red)] p-2 flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-xs w-20 shrink-0">{corta(m.fecha)}</span>
                    <span className="font-stencil text-lg w-28 shrink-0">{euros(m.importe)}</span>
                    <span className="flex-1 min-w-[10rem] text-sm">{m.concepto}</span>
                    <button onClick={() => accion(m.id, "no_es_venta")}
                      className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white">
                      no es una venta
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. POR REVISAR */}
          {d.sugerencias.length > 0 && (
            <div className="card-hard bg-[color:var(--mustard)] p-4">
              <h3 className="font-stencil text-xl leading-none mb-1">Por revisar · {d.sugerencias.length}</h3>
              <p className="text-xs text-black/70 mb-3">Cuadran, pero no del todo. Dime cuál es y lo enlazo.</p>
              <div className="space-y-2">
                {d.sugerencias.map((s) => (
                  <div key={s.id} className="border-2 border-black bg-white p-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-xs w-20 shrink-0">{corta(s.fecha)}</span>
                      <span className="font-stencil text-lg w-28 shrink-0">{euros(s.importe)}</span>
                      <span className="flex-1 min-w-[10rem] text-sm">{s.concepto}</span>
                      <span className="text-[10px] font-mono uppercase text-black/50">{MOTIVO[s.motivo] ?? s.motivo}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap mt-2 pl-2">
                      {s.candidatas.map((c) => (
                        <button key={c.id} onClick={() => accion(s.id, "enlazar", c.id)}
                          className="text-[11px] font-mono border-2 border-black px-2 py-1 hover:bg-black hover:text-white">
                          nº {c.numero} · {corta(c.fecha)} · {euros(c.total)}
                        </button>
                      ))}
                      <button onClick={() => accion(s.id, "no_es_venta")}
                        className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1">ninguna</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. MESES SIN LISTADO — ni problema ni cuadrado: falta el papel */}
          {sinListado.length > 0 && (
            <details className="card-hard bg-[color:var(--cream)] p-4">
              <summary className="font-stencil text-xl leading-none cursor-pointer">
                De meses sin listado · {sinListado.length}
              </summary>
              <p className="text-xs text-black/70 my-2">
                Ingresos de fechas que no cubre ningún listado cargado. No es que falten facturas: es que falta el
                listado de esos meses. Súbelos y estos ingresos se cruzarán solos.
              </p>
              <div className="space-y-1">
                {sinListado.slice(0, 25).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 flex-wrap text-sm border-b border-black/10 py-1">
                    <span className="font-mono text-xs w-20 shrink-0">{corta(m.fecha)}</span>
                    <span className="font-mono w-24 shrink-0">{euros(m.importe)}</span>
                    <span className="flex-1 min-w-[10rem] truncate">{m.concepto}</span>
                  </div>
                ))}
                {sinListado.length > 25 && (
                  <p className="text-xs text-black/50 pt-1">y {sinListado.length - 25} más.</p>
                )}
              </div>
            </details>
          )}

          {/* 4. LO QUE NO ES UNA VENTA */}
          {noVentas.length > 0 && (
            <details className="card-hard bg-white p-4" open={abierto.noVentas}
              onToggle={(e) => setAbierto((a) => ({ ...a, noVentas: (e.target as HTMLDetailsElement).open }))}>
              <summary className="font-stencil text-xl leading-none cursor-pointer">
                No son ventas · {noVentas.length}
              </summary>
              <p className="text-xs text-black/60 my-2">
                Traspasos, devoluciones, préstamos, subvenciones y abonos del banco. Entra dinero, pero no se factura.
              </p>
              <div className="space-y-1">
                {noVentas.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 flex-wrap text-sm border-b border-black/10 py-1">
                    <span className="font-mono text-xs w-20 shrink-0">{corta(m.fecha)}</span>
                    <span className="font-mono w-24 shrink-0">{euros(m.importe)}</span>
                    <span className="flex-1 min-w-[10rem]">{m.concepto}</span>
                    <span className="text-[10px] font-mono uppercase bg-black text-white px-2 py-0.5">{m.etiqueta}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* 4. FACTURAS EMITIDAS QUE NADIE HA COBRADO */}
          {d.sinCobrar.length > 0 && (
            <details className="card-hard bg-white p-4" open={abierto.sinCobrar}
              onToggle={(e) => setAbierto((a) => ({ ...a, sinCobrar: (e.target as HTMLDetailsElement).open }))}>
              <summary className="font-stencil text-xl leading-none cursor-pointer">
                Emitidas y sin cobrar · {d.sinCobrar.length} · {euros(r?.importeSinCobrar ?? 0)}
              </summary>
              <p className="text-xs text-black/60 my-2">
                Esto no es un fallo de papeles: son facturas que el cliente ha emitido y todavía no le han pagado.
                Al gestor le interesa saberlo, pero no hay nada que reclamar aquí.
              </p>
              <div className="space-y-1">
                {d.sinCobrar.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 flex-wrap text-sm border-b border-black/10 py-1">
                    <span className="font-mono text-xs w-20 shrink-0">{corta(v.fecha)}</span>
                    <span className="font-mono w-24 shrink-0">{euros(v.total)}</span>
                    <span className="flex-1 min-w-[8rem]">nº {v.numero}</span>
                    <span className="text-xs text-black/60">{v.destinatario ?? ""}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* 5. LO QUE YA CUADRA */}
          {d.cuadrados.length > 0 && (
            <details className="card-hard bg-white p-4" open={abierto.cuadrados}
              onToggle={(e) => setAbierto((a) => ({ ...a, cuadrados: (e.target as HTMLDetailsElement).open }))}>
              <summary className="font-stencil text-xl leading-none cursor-pointer">
                Cuadrados · {d.cuadrados.length}
              </summary>
              <div className="space-y-1 mt-2">
                {d.cuadrados.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 flex-wrap text-sm border-b border-black/10 py-1">
                    <span className="font-mono text-xs w-20 shrink-0">{corta(c.fecha)}</span>
                    <span className="font-mono w-24 shrink-0">{euros(c.importe)}</span>
                    <span className="flex-1 min-w-[10rem] truncate">{c.concepto}</span>
                    <span className="text-xs font-mono">nº {c.numero}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
