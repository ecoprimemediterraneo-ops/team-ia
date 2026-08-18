"use client";

// El alta de expediente, plegada por defecto.
//
// Plegada porque la pantalla de expedientes se abre veinte veces al día para
// MIRAR y dos para dar de alta: un formulario desplegado arriba empuja hacia
// abajo lo que de verdad se viene a ver.

import { useState, useTransition } from "react";
import { crearExpediente } from "@/app/dashboard/expedientes/actions";

type Tramite = { id: string; nombre: string; precioEUR: number };

const ESTADOS = [
  { id: "recibido", label: "Recibido" },
  { id: "esperando_documentacion", label: "Esperando documentación" },
  { id: "en_curso", label: "En curso" },
  { id: "presentado", label: "Presentado" },
];

export default function NuevoExpediente({ tramites }: { tramites: Tramite[] }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [enviando, empezar] = useTransition();

  const [f, setF] = useState({
    clienteNombre: "",
    telefono: "",
    tramite: tramites[0]?.id ?? "renta",
    estado: "esperando_documentacion",
    periodo: "",
    vence: "",
    documentos: "",
  });

  const cambiar = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((v) => ({ ...v, [k]: e.target.value }));

  const enviar = () => {
    setError(null);
    setHecho(null);
    empezar(async () => {
      const r = await crearExpediente(f);
      if (!r.ok) { setError(r.error); return; }
      setHecho(`${f.clienteNombre} dado de alta.`);
      setF((v) => ({ ...v, clienteNombre: "", telefono: "", periodo: "", vence: "", documentos: "" }));
    });
  };

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="btn-mustard text-xs px-3 py-2">
        ＋ NUEVO EXPEDIENTE
      </button>
    );
  }

  const campo = "w-full border-2 border-black px-2 py-1.5 text-sm bg-white";
  const etiqueta = "text-xs font-mono uppercase tracking-wide text-black/60";

  return (
    <div className="card-hard bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-stencil text-xl">Nuevo expediente</h3>
        <button onClick={() => setAbierto(false)} className="text-xs font-mono underline text-black/50">
          cerrar
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={etiqueta}>Cliente</label>
          <input className={campo} value={f.clienteNombre} onChange={cambiar("clienteNombre")} placeholder="Talleres Ruiz SL" />
        </div>
        <div>
          <label className={etiqueta}>Teléfono</label>
          <input className={campo} value={f.telefono} onChange={cambiar("telefono")} placeholder="600110011" inputMode="tel" />
          {/* Se dice para qué sirve: es lo que hace que la factura que manda por
              WhatsApp caiga sola en su ficha. */}
          <p className="text-[11px] text-black/50 mt-1">
            Con este número se le reconoce cuando manda una factura por WhatsApp.
          </p>
        </div>
        <div>
          <label className={etiqueta}>Trámite</label>
          <select className={campo} value={f.tramite} onChange={cambiar("tramite")}>
            {tramites.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre} · {t.precioEUR} €</option>
            ))}
          </select>
        </div>
        <div>
          <label className={etiqueta}>Estado</label>
          <select className={campo} value={f.estado} onChange={cambiar("estado")}>
            {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </div>
        <div>
          <label className={etiqueta}>Periodo</label>
          <input className={campo} value={f.periodo} onChange={cambiar("periodo")} placeholder="1T 2026" />
        </div>
        <div>
          <label className={etiqueta}>Vence</label>
          <input className={campo} type="date" value={f.vence} onChange={cambiar("vence")} />
        </div>
      </div>

      <div>
        <label className={etiqueta}>Documentos que faltan (uno por línea)</label>
        <textarea className={`${campo} h-20`} value={f.documentos} onChange={cambiar("documentos")}
          placeholder={"facturas de gastos del trimestre\nextracto bancario"} />
      </div>

      {error && <p className="text-sm text-[color:var(--red)] font-bold">{error}</p>}
      {hecho && <p className="text-sm text-green-700 font-bold">{hecho}</p>}

      <button onClick={enviar} disabled={enviando} className="btn-mustard text-xs px-4 py-2 disabled:opacity-50">
        {enviando ? "GUARDANDO…" : "DAR DE ALTA"}
      </button>
    </div>
  );
}
