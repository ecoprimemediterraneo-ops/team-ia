"use client";

// Subida del extracto Norma 43 y control de lo importado.
//
// El bloque de CONTROL es lo importante de esta pantalla: sin él, el gestor no
// tiene forma de saber si el fichero que ha subido es el que creía. Con el
// número de movimientos, el rango de fechas y la suma de cargos puede
// contrastarlo contra su banco en diez segundos.

import { useRef, useState } from "react";

type Respuesta = {
  ok?: boolean;
  error?: string;
  loteId?: string;
  control?: {
    total: number; desde: string | null; hasta: string | null;
    cargos: number; sumaCargos: number; abonos: number; sumaAbonos: number; lineasIgnoradas: number;
  };
  importados?: number;
  duplicadosDescartados?: number;
  cruce?: { conciliadosAutomaticamente: number; sugerencias: number; cargosSinFactura: number };
};

type ExtractoPrevio = { total: number; desde: string; hasta: string; ultimaImportacion: string; lotes: number };

export default function SubirExtracto({
  clientes, yaSubido = {},
}: {
  clientes: { id: string; nombre: string }[];
  /** Lo que ya está importado de cada cliente, para avisar antes de repetir. */
  yaSubido?: Record<string, ExtractoPrevio>;
}) {
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? "");
  const [res, setRes] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function subir(f: File) {
    setCargando(true); setRes(null);
    try {
      const fd = new FormData();
      fd.append("clienteId", clienteId);
      fd.append("fichero", f);
      const r = await fetch("/api/gestoria/facturas/banco", { method: "POST", body: fd });
      setRes(await r.json());
    } finally {
      setCargando(false);
    }
  }

  const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
  const fechaCorta = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-ES");
  };

  const previo = yaSubido[clienteId];
  const nombreCliente = clientes.find((c) => c.id === clienteId)?.nombre ?? "este cliente";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs font-mono uppercase tracking-widest text-black/60">Cliente</label>
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}
          className="card-hard px-3 py-2 bg-white text-sm">
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {previo && (
        <div className="border-2 border-black bg-[color:var(--mustard)] px-3 py-2 text-sm">
          ⚠ De <b>{nombreCliente}</b> ya hay un extracto: del <b>{fechaCorta(previo.desde)}</b> al <b>{fechaCorta(previo.hasta)}</b> ({previo.total} movimientos,
          subido el {fechaCorta(previo.ultimaImportacion)}). Si vuelves a subir esas mismas fechas no se duplica nada —
          los movimientos repetidos se reconocen y se dejan fuera—, pero mira que sea el periodo siguiente.
        </div>
      )}

      <div className="card-hard bg-white p-6 text-center">
        <p className="font-stencil text-2xl leading-none mb-1">Extracto del banco</p>
        <p className="text-xs text-black/60 mb-3">Descárgalo de tu banca online en Norma 43 (.csb, .n43 o .txt). Es el mismo formato en todos los bancos.</p>
        <button type="button" onClick={() => ref.current?.click()} disabled={cargando || !clienteId}
          className="btn-mustard text-xs px-3 py-2 disabled:opacity-60">
          {cargando ? "Leyendo el extracto…" : "Elegir extracto"}
        </button>
        <input ref={ref} type="file" accept=".csb,.n43,.txt" className="hidden"
          onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
      </div>

      {res?.error && (
        <div className="card-hard bg-white p-4 text-sm border-[3px] border-[color:var(--red)]">
          ⚠ {res.error === "falta clienteId"
            ? "Elige antes de qué cliente es el extracto."
            : res.error === "falta el fichero"
              ? "No ha llegado el extracto. Vuelve a elegirlo."
              : res.error}
        </div>
      )}

      {res?.ok && res.control && (
        <div className="card-hard bg-white p-4 space-y-3">
          <h2 className="font-stencil text-2xl leading-none">Repaso de lo importado</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Dato label="Movimientos" valor={String(res.control.total)} />
            <Dato label="Desde" valor={res.control.desde ? fechaCorta(res.control.desde) : "—"} />
            <Dato label="Hasta" valor={res.control.hasta ? fechaCorta(res.control.hasta) : "—"} />
            <Dato label="Cargos" valor={String(res.control.cargos)} />
            <Dato label="Suma de cargos" valor={eur(res.control.sumaCargos)} destacado />
            <Dato label="Abonos" valor={String(res.control.abonos)} />
            <Dato label="Suma de abonos" valor={eur(res.control.sumaAbonos)} />
            <Dato label="Líneas que no son movimientos" valor={String(res.control.lineasIgnoradas)} />
          </div>
          <div className="text-sm border-t-2 border-black pt-3">
            <b>{res.importados}</b> movimientos leídos
            {res.duplicadosDescartados ? ` · ${res.duplicadosDescartados} repetidos, que no se han vuelto a meter` : ""}
            {res.cruce && (
              <> · <b>{res.cruce.conciliadosAutomaticamente}</b> conciliados solos ·{" "}
              <b>{res.cruce.sugerencias}</b> sugerencias · <b>{res.cruce.cargosSinFactura}</b> cargos sin factura que los justifique</>
            )}
          </div>
          <a href="/dashboard/facturas/conciliacion" className="btn-mustard text-xs px-3 py-2 inline-block">
            Ver la conciliación →
          </a>
        </div>
      )}
    </div>
  );
}

function Dato({ label, valor, destacado }: { label: string; valor: string; destacado?: boolean }) {
  return (
    <div className={`border-2 border-black p-2 ${destacado ? "bg-[color:var(--mustard)]" : ""}`}>
      <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">{label}</div>
      <div className="font-bold">{valor}</div>
    </div>
  );
}
