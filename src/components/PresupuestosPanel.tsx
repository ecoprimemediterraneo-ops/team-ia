"use client";

// Seguimiento de presupuestos — la parte que el dueño toca.
//
// Todo pasa por /api/seguimiento/presupuestos, que resuelve el tenant por sesión.
// Este componente NUNCA manda un tenantId: no tiene forma de escribir en otro
// panel aunque se manipule desde el navegador.

import { useCallback, useMemo, useState } from "react";

export type Presupuesto = {
  id: string;
  paciente: { nombre: string; telefono: string };
  concepto: string;
  importeEUR?: number;
  estado: "dado" | "aceptado" | "ejecutado" | "descartado";
  creadoEn: string;
  nota?: string;
  recordadoEn?: string;
  recordatorios: number;
};

const ETIQUETA: Record<Presupuesto["estado"], string> = {
  dado: "Dado",
  aceptado: "Aceptado",
  ejecutado: "Hecho",
  descartado: "Descartado",
};

const COLOR: Record<Presupuesto["estado"], string> = {
  dado: "bg-white",
  aceptado: "bg-[color:var(--mustard)]",
  ejecutado: "bg-green-200",
  descartado: "bg-black/10",
};

function dias(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

// La lista llega ya pintada desde el servidor (la página es un server component
// y lee del disco/KV directamente). Aquí solo se refresca después de tocar algo:
// así no hay una petición al montar ni un parpadeo de "cargando".
export default function PresupuestosPanel({
  vocabulario,
  presupuestosIniciales,
  pendientesIniciales,
}: {
  vocabulario: { cliente: string; servicio: string };
  presupuestosIniciales: Presupuesto[];
  pendientesIniciales: string[];
}) {
  const [lista, setLista] = useState<Presupuesto[]>(presupuestosIniciales);
  const [pendientes, setPendientes] = useState<string[]>(pendientesIniciales);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [concepto, setConcepto] = useState("");
  const [importe, setImporte] = useState("");

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/seguimiento/presupuestos", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "error");
      setLista(j.presupuestos as Presupuesto[]);
      setPendientes(j.pendientes as string[]);
      setError(null);
    } catch {
      setError("No se ha podido refrescar la lista. Recarga la página.");
    }
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !concepto.trim()) return;
    setGuardando(true);
    try {
      const r = await fetch("/api/seguimiento/presupuestos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, telefono, concepto, importeEUR: importe }),
      });
      if (!r.ok) throw new Error();
      setNombre("");
      setTelefono("");
      setConcepto("");
      setImporte("");
      await cargar();
    } catch {
      setError("No se ha podido guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function mover(id: string, estado: Presupuesto["estado"]) {
    await fetch("/api/seguimiento/presupuestos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado }),
    });
    await cargar();
  }

  async function borrar(id: string) {
    await fetch(`/api/seguimiento/presupuestos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await cargar();
  }

  const vivos = useMemo(() => lista.filter((p) => p.estado !== "descartado"), [lista]);
  const hechos = vivos.filter((p) => p.estado === "ejecutado").length;
  const setPendientes_ = new Set(pendientes);

  return (
    <section className="card-hard bg-white p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h2 className="font-stencil text-2xl leading-none">Presupuestos</h2>
        {vivos.length > 0 && (
          <span className="text-xs font-mono uppercase tracking-widest text-black/60">
            {hechos} de {vivos.length} ya hechos
          </span>
        )}
      </div>
      <p className="text-sm text-black/60 mb-4">
        Apunta el presupuesto que das. A los 15 días, si sigue parado, se le recuerda solo.
      </p>

      <form onSubmit={crear} className="grid sm:grid-cols-[1.2fr_1fr_1.4fr_0.7fr_auto] gap-2 mb-5">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={`Nombre del ${vocabulario.cliente}`}
          className="border-2 border-black px-2 py-1.5 text-sm"
          required
        />
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="Teléfono"
          inputMode="tel"
          className="border-2 border-black px-2 py-1.5 text-sm"
        />
        <input
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder={`${vocabulario.servicio[0].toUpperCase()}${vocabulario.servicio.slice(1)}`}
          className="border-2 border-black px-2 py-1.5 text-sm"
          required
        />
        <input
          value={importe}
          onChange={(e) => setImporte(e.target.value)}
          placeholder="€"
          inputMode="decimal"
          className="border-2 border-black px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={guardando}
          className="border-[3px] border-black bg-[color:var(--mustard)] px-3 py-1.5 text-xs font-bold uppercase tracking-widest disabled:opacity-50"
        >
          {guardando ? "…" : "Añadir"}
        </button>
      </form>

      {error && <div className="border-2 border-black bg-red-100 px-3 py-2 text-sm mb-3">{error}</div>}

      {lista.length === 0 ? (
        <div className="border-2 border-dashed border-black p-4 text-sm text-black/60">
          Todavía no hay ningún presupuesto apuntado. En cuanto apuntes el primero, el KPI de
          «Presupuestos convertidos» deja de salir con guion.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-black/50">
                <th className="py-1 pr-3">{vocabulario.cliente}</th>
                <th className="py-1 pr-3">Concepto</th>
                <th className="py-1 pr-3">Importe</th>
                <th className="py-1 pr-3">Dado</th>
                <th className="py-1 pr-3">Estado</th>
                <th className="py-1">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className="border-t-2 border-black/10 align-top">
                  <td className="py-2 pr-3">
                    <div className="font-bold">{p.paciente.nombre}</div>
                    <div className="text-xs text-black/50 font-mono">{p.paciente.telefono || "sin teléfono"}</div>
                  </td>
                  <td className="py-2 pr-3">{p.concepto}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {typeof p.importeEUR === "number" ? `${p.importeEUR} €` : "—"}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {fecha(p.creadoEn)}
                    <div className="text-xs text-black/50">hace {dias(p.creadoEn)} d</div>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <span className={`border-2 border-black px-1.5 py-0.5 text-[10px] font-bold uppercase ${COLOR[p.estado]}`}>
                      {ETIQUETA[p.estado]}
                    </span>
                    {setPendientes_.has(p.id) && (
                      <div className="text-[10px] text-black/60 mt-1">toca recordar</div>
                    )}
                    {p.recordatorios > 0 && (
                      <div className="text-[10px] text-black/50 mt-0.5">
                        {p.recordatorios} recordatorio{p.recordatorios > 1 ? "s" : ""}
                      </div>
                    )}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.estado === "dado" && (
                        <>
                          <button onClick={() => mover(p.id, "aceptado")} className="border-2 border-black px-1.5 py-0.5 text-[10px] font-bold uppercase hover:bg-[color:var(--mustard)]">Aceptado</button>
                          <button onClick={() => mover(p.id, "descartado")} className="border-2 border-black px-1.5 py-0.5 text-[10px] font-bold uppercase hover:bg-black hover:text-white">Descartar</button>
                        </>
                      )}
                      {p.estado === "aceptado" && (
                        <button onClick={() => mover(p.id, "ejecutado")} className="border-2 border-black px-1.5 py-0.5 text-[10px] font-bold uppercase hover:bg-green-200">Ya hecho</button>
                      )}
                      <button onClick={() => borrar(p.id)} className="border-2 border-black px-1.5 py-0.5 text-[10px] font-bold uppercase text-black/50 hover:bg-black hover:text-white">Borrar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
