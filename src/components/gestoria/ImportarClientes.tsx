"use client";

// Traerse los clientes desde un Excel, en tres pasos y sin sustos.
//
//   1. Se sube el fichero.
//   2. Se dice qué es cada columna (se propone, se corrige).
//   3. Se enseña qué va a pasar y ENTONCES se confirma.
//
// El paso 3 no es un adorno. Esto escribe sobre las fichas de cien clientes de
// una vez y no hay deshacer: enseñar antes cuántos se crean, cuántos se tocan y
// cuántos se saltan —y por qué— es la diferencia entre una herramienta y una
// ruleta.

import { useRef, useState } from "react";

type Campo = "nombre" | "nif" | "telefono" | "email";

const ETIQUETA: Record<Campo, string> = {
  nombre: "Nombre del cliente",
  nif: "NIF o DNI",
  telefono: "Teléfono(s)",
  email: "Correo(s)",
};

type FilaLeida = {
  fila: number; nombre: string; nif: string;
  telefonos: string[]; emails: string[];
  clienteNombre?: string;
};

type Plan = {
  nuevos: number;
  actualizar: number;
  saltadas: number;
  avisos: string[];
  ejemploNuevos: FilaLeida[];
  ejemploActualizar: FilaLeida[];
  listaSaltadas: Array<{ fila: number; motivo: string; datos: string }>;
  saltadasCsv: string | null;
};

type Resultado = {
  creados: number; actualizados: number; saltados: number;
  fallos: string[]; saltadasCsv: string | null;
};

export default function ImportarClientes() {
  const [cabecera, setCabecera] = useState<string[] | null>(null);
  const [filas, setFilas] = useState<string[][]>([]);
  const [mapa, setMapa] = useState<Array<Campo | null>>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [nombreFichero, setNombreFichero] = useState("");
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function subir(f: File) {
    setCargando(true); setAviso(""); setResultado(null); setPlan(null);
    try {
      const fd = new FormData();
      fd.append("fichero", f);
      const res = await fetch("/api/gestoria/clientes/importar", { method: "POST", body: fd });
      const j = await res.json();
      if (j.error) { setAviso(j.error); return; }
      setCabecera(j.cabecera); setFilas(j.filas); setMapa(j.mapa);
      setPlan(j.plan); setNombreFichero(j.nombre);
    } finally { setCargando(false); }
  }

  /** Al cambiar el emparejamiento se recalcula la vista previa. Nada se guarda. */
  async function recalcular(nuevoMapa: Array<Campo | null>) {
    setMapa(nuevoMapa);
    setCargando(true);
    try {
      const res = await fetch("/api/gestoria/clientes/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filas, mapa: nuevoMapa }),
      });
      const j = await res.json();
      if (j.error) setAviso(j.error); else setPlan(j.plan);
    } finally { setCargando(false); }
  }

  async function confirmar() {
    if (!plan) return;
    setCargando(true); setAviso("");
    try {
      const res = await fetch("/api/gestoria/clientes/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filas, mapa, aplicar: true }),
      });
      const j = await res.json();
      if (j.error) { setAviso(j.error); return; }
      setResultado(j);
      setPlan(null); setCabecera(null); setFilas([]);
    } finally { setCargando(false); }
  }

  function descargar(csv: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "filas-sin-importar.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function empezarDeCero() {
    setCabecera(null); setFilas([]); setMapa([]); setPlan(null);
    setResultado(null); setAviso(""); setNombreFichero("");
  }

  // --- Terminado ---
  if (resultado) {
    return (
      <div className="card-hard bg-white p-4 space-y-3">
        <h2 className="font-stencil text-2xl leading-none">Importación terminada</h2>
        <p className="text-sm">
          <b>{resultado.creados}</b> clientes nuevos · <b>{resultado.actualizados}</b> actualizados ·{" "}
          <b>{resultado.saltados}</b> saltados.
        </p>
        {resultado.fallos.length > 0 && (
          <div className="border-2 border-black bg-[color:var(--mustard)] px-3 py-2 text-xs">
            <b>{resultado.fallos.length} no se pudieron guardar:</b>
            <ul className="mt-1 space-y-0.5">
              {resultado.fallos.slice(0, 10).map((f, i) => <li key={i}>· {f}</li>)}
            </ul>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          {resultado.saltadasCsv && (
            <button type="button" onClick={() => descargar(resultado.saltadasCsv!)}
              className="text-[10px] font-mono uppercase tracking-widest border-2 border-black px-3 py-2 hover:bg-black hover:text-white">
              Descargar las saltadas
            </button>
          )}
          <button type="button" onClick={empezarDeCero} className="btn-mustard text-xs px-3 py-2">
            Importar otro fichero
          </button>
        </div>
      </div>
    );
  }

  // --- Paso 1: subir ---
  if (!cabecera) {
    return (
      <div className="card-hard bg-white p-5">
        <h2 className="font-stencil text-2xl leading-none mb-1">Traerte tus clientes</h2>
        <p className="text-sm text-black/60 mb-4">
          Exporta la lista de clientes de tu programa a Excel o CSV y súbela aquí. No hace falta que tenga un
          formato concreto: tú me dices qué es cada columna. <b>No se guarda nada hasta que lo confirmes.</b>
        </p>
        <input ref={input} type="file" accept=".xlsx,.xls,.csv,.txt,.tsv" className="hidden"
          onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
        <button type="button" disabled={cargando} onClick={() => input.current?.click()}
          className="btn-mustard text-xs px-4 py-2 disabled:opacity-50">
          {cargando ? "Leyendo…" : "Elegir fichero"}
        </button>
        {aviso && <p className="text-sm text-[color:var(--red)] font-bold mt-3">{aviso}</p>}
      </div>
    );
  }

  // --- Pasos 2 y 3: emparejar y confirmar ---
  return (
    <div className="space-y-4">
      <div className="card-hard bg-white p-4">
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          <h2 className="font-stencil text-2xl leading-none">Qué es cada columna</h2>
          <span className="text-[11px] font-mono text-black/50">{nombreFichero} · {filas.length - 1} filas</span>
        </div>
        <p className="text-xs text-black/60 mb-3">
          He adivinado esto por el nombre de la columna. Cámbialo si me he equivocado; lo que dejes en
          “(ignorar)” no se importa.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {cabecera.map((col, i) => (
            <label key={i} className="flex items-center gap-2 border-2 border-black px-2 py-1.5">
              <span className="text-xs font-bold flex-1 min-w-0 truncate" title={col}>{col || `(columna ${i + 1})`}</span>
              <select
                value={mapa[i] ?? ""}
                onChange={(e) => {
                  const m = [...mapa];
                  m[i] = (e.target.value || null) as Campo | null;
                  recalcular(m);
                }}
                className="border-2 border-black px-1 py-0.5 text-[11px] bg-white"
              >
                <option value="">(ignorar)</option>
                {(Object.keys(ETIQUETA) as Campo[]).map((c) => (
                  <option key={c} value={c}>{ETIQUETA[c]}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      {plan && (
        <div className="card-hard bg-white p-4 space-y-3">
          <h2 className="font-stencil text-2xl leading-none">Qué va a pasar</h2>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="border-2 border-black p-2">
              <div className="font-stencil text-3xl leading-none">{plan.nuevos}</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">nuevos</div>
            </div>
            <div className="border-2 border-black p-2">
              <div className="font-stencil text-3xl leading-none">{plan.actualizar}</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">se actualizan</div>
            </div>
            <div className={`border-2 border-black p-2 ${plan.saltadas ? "bg-[color:var(--mustard)]" : ""}`}>
              <div className="font-stencil text-3xl leading-none">{plan.saltadas}</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">se saltan</div>
            </div>
          </div>

          <p className="text-[11px] text-black/55">
            Los que ya tienes se <b>fusionan</b>: no se borra ningún dato que ya estuviera aunque la columna
            venga vacía.
          </p>

          {plan.ejemploNuevos.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-black/50 mb-1">
                Ejemplo de lo que se creará
              </div>
              <ul className="text-[11px] font-mono space-y-0.5">
                {plan.ejemploNuevos.map((n) => (
                  <li key={n.fila} className="border-b border-black/10 pb-0.5">
                    {n.nombre} · NIF {n.nif || "—"} · tel {n.telefonos.join(", ") || "—"} · {n.emails.join(", ") || "sin correo"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {plan.ejemploActualizar.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-black/50 mb-1">
                Ejemplo de lo que se actualizará
              </div>
              <ul className="text-[11px] font-mono space-y-0.5">
                {plan.ejemploActualizar.map((n) => (
                  <li key={n.fila} className="border-b border-black/10 pb-0.5">
                    {n.clienteNombre} ← fila {n.fila} ({n.nombre})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {plan.listaSaltadas.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-black/50 mb-1">
                Por qué se saltan
              </div>
              <ul className="text-[11px] font-mono space-y-0.5 max-h-40 overflow-y-auto">
                {plan.listaSaltadas.map((s) => (
                  <li key={s.fila} className="border-b border-black/10 pb-0.5">
                    Fila {s.fila}: <b>{s.motivo}</b> · <span className="text-black/50">{s.datos}</span>
                  </li>
                ))}
              </ul>
              {plan.saltadasCsv && (
                <button type="button" onClick={() => descargar(plan.saltadasCsv!)}
                  className="text-[10px] font-mono uppercase tracking-widest border-2 border-black px-2 py-1 mt-2 hover:bg-black hover:text-white">
                  Descargarlas para corregirlas
                </button>
              )}
            </div>
          )}

          {plan.avisos.length > 0 && (
            <div className="border-2 border-black bg-[color:var(--mustard)] px-3 py-2 text-[11px] space-y-0.5">
              <b>Avisos (no impiden importar):</b>
              {plan.avisos.map((a, i) => <div key={i}>· {a}</div>)}
            </div>
          )}

          <div className="flex gap-2 flex-wrap pt-1">
            <button type="button" onClick={confirmar} disabled={cargando || (!plan.nuevos && !plan.actualizar)}
              className="btn-mustard text-xs px-4 py-2 disabled:opacity-50">
              {cargando ? "Guardando…" : `Importar ${plan.nuevos + plan.actualizar} clientes`}
            </button>
            <button type="button" onClick={empezarDeCero}
              className="text-[10px] font-mono uppercase tracking-widest border-2 border-black px-3 py-2 hover:bg-black hover:text-white">
              cancelar
            </button>
          </div>
        </div>
      )}

      {aviso && <p className="text-sm text-[color:var(--red)] font-bold">{aviso}</p>}
    </div>
  );
}
