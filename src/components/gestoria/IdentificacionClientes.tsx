"use client";

// "Cómo identificamos sus facturas": los datos duros de cada cliente.
//
// POR QUÉ ESTA PANTALLA EXISTE
// ----------------------------
// El sistema ya sabe leer una factura que entra sola y proponerle un dueño
// comparando el NIF del papel con el del cliente. Pero no había ningún sitio
// donde escribir ese NIF, así que la comparación no se hacía nunca y todas las
// facturas caían en "sin asignar". Esto es la pieza que hace útil a la otra.
//
// TRES DATOS Y NINGUNO MÁS: el NIF que viene impreso en el papel, los teléfonos
// desde los que manda cosas y los correos desde los que las manda. No es una
// agenda de contactos; es con qué se reconoce un documento.
//
// LOS TRES SON OPCIONALES. Una gestoría con cincuenta clientes no va a rellenar
// esto de una sentada, y un formulario que obliga es un formulario que se queda
// vacío. Se rellena a trozos, y sobre todo se rellena solo con el uso desde la
// pantalla de facturas.

import { useEffect, useState } from "react";

type Cliente = {
  id: string;
  nombre: string;
  telefono: string;
  nif: string;
  telefonos: string[];
  emails: string[];
  modelos: string[];
  aviso: string | null;
};

/** Los cuatro que se presentan cada trimestre. Casillas, no formulario. */
const MODELOS = [
  { id: "111", que: "Retenciones de trabajo" },
  { id: "115", que: "Retenciones de alquiler" },
  { id: "303", que: "IVA" },
  { id: "130", que: "Pago fraccionado IRPF" },
];

/** Una lista de valores que se edita como texto, uno por línea. Es lo más simple
 *  que funciona: nada de añadir y quitar filas con botoncitos para meter dos
 *  teléfonos. */
function ListaTexto({
  etiqueta,
  ayuda,
  valor,
  onChange,
}: {
  etiqueta: string;
  ayuda: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-widest text-black/60">{etiqueta}</span>
      <textarea
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={ayuda}
        className="w-full border-2 border-black px-2 py-1 text-xs bg-white font-mono mt-0.5"
      />
      <span className="text-[10px] text-black/45">{ayuda}</span>
    </label>
  );
}

export default function IdentificacionClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [sinNif, setSinNif] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<{ nif: string; telefonos: string; emails: string; modelos: string[] }>({
    nif: "", telefonos: "", emails: "", modelos: [],
  });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "aviso" | "error"; texto: string } | null>(null);

  /**
   * Trae la lista. El `setCargando(true)` va DESPUÉS del primer `await` a
   * propósito: llamarlo antes hacía que el efecto de abajo tocara el estado de
   * forma síncrona en el montaje, que es lo que React avisa como cascada de
   * pintadas. La pantalla arranca ya en "cargando", así que no se ve nada raro.
   */
  async function cargar() {
    try {
      const res = await fetch("/api/gestoria/clientes/identidad");
      const j = await res.json();
      if (j.ok) {
        setClientes(j.clientes);
        setTotal(j.total);
        setSinNif(j.sinNif);
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    let vivo = true;
    (async () => {
      const res = await fetch("/api/gestoria/clientes/identidad").catch(() => null);
      const j = res ? await res.json().catch(() => null) : null;
      if (!vivo) return;
      if (j?.ok) {
        setClientes(j.clientes);
        setTotal(j.total);
        setSinNif(j.sinNif);
      }
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, []);

  function abrir(c: Cliente) {
    setMensaje(null);
    setAbierto(c.id);
    setBorrador({
      nif: c.nif,
      telefonos: c.telefonos.join("\n"),
      emails: c.emails.join("\n"),
      modelos: c.modelos ?? [],
    });
  }

  async function guardar(c: Cliente) {
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/gestoria/clientes/identidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: c.id,
          nif: borrador.nif,
          telefonos: borrador.telefonos.split(/[\n,;]/).map((x) => x.trim()).filter(Boolean),
          emails: borrador.emails.split(/[\n,;]/).map((x) => x.trim()).filter(Boolean),
          modelos: borrador.modelos,
        }),
      });
      const j = await res.json();
      if (j.error) {
        // El NIF repetido NO guarda: es un error de verdad, no un aviso.
        setMensaje({ tipo: "error", texto: j.error });
        return;
      }
      // Guardado, pero con el formato regular. Amarillo, no rojo: el dato está.
      setMensaje(j.aviso ? { tipo: "aviso", texto: `Guardado. ${j.aviso}` } : { tipo: "ok", texto: "Guardado." });
      setAbierto(null);
      await cargar();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="card-hard bg-white p-4">
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h2 className="font-stencil text-2xl leading-none">Cómo identificamos sus facturas</h2>
        {!cargando && (
          <span
            className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-1 border-2 border-black ${
              sinNif === 0 ? "bg-green-700 text-white" : "bg-[color:var(--mustard)] text-black"
            }`}
          >
            {sinNif === 0 ? `Los ${total} tienen NIF` : `${sinNif} de ${total} clientes sin NIF`}
          </span>
        )}
      </div>
      <p className="text-xs text-black/60 mb-3">
        Con el NIF, cuando entra una factura a nombre de un cliente se reconoce sola y solo tienes que confirmarla.
        Sin él, cae en &quot;sin asignar&quot; y hay que decir de quién es a mano. Los tres datos son opcionales.
      </p>

      {cargando ? (
        <p className="text-sm text-black/60">Cargando…</p>
      ) : clientes.length === 0 ? (
        <p className="text-sm text-black/60">
          Todavía no hay clientes. Se crean dando de alta un expediente aquí arriba.
        </p>
      ) : (
        <div className="space-y-2">
          {clientes.map((c) => (
            <div
              key={c.id}
              className={`border-2 border-black p-2 ${c.nif ? "bg-white" : "bg-[color:var(--cream)]"}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm flex-1 min-w-[9rem]">{c.nombre}</span>
                {c.nif ? (
                  <span className="text-[11px] font-mono">{c.nif}</span>
                ) : (
                  /* La consecuencia, escrita. "Sin NIF" a secas no dice por qué
                     debería importarle a nadie. */
                  <span className="text-[10px] font-bold bg-[color:var(--mustard)] border-2 border-black px-1.5 py-0.5">
                    SIN NIF: sus facturas no se reconocen solas
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => (abierto === c.id ? setAbierto(null) : abrir(c))}
                  className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white"
                >
                  {abierto === c.id ? "cerrar" : c.nif ? "editar" : "poner NIF"}
                </button>
              </div>

              {/* El aviso de formato se ve SIEMPRE, no solo al guardar: un NIF
                  que se metió mal hace un mes sigue estando mal hoy. */}
              {c.aviso && abierto !== c.id && (
                <p className="text-[11px] bg-[color:var(--mustard)] border-2 border-black px-2 py-1 mt-1">
                  ⚠️ {c.aviso}
                </p>
              )}

              {(c.telefonos.length > 0 || c.emails.length > 0) && abierto !== c.id && (
                <p className="text-[11px] font-mono text-black/55 mt-1">
                  También manda desde: {[...c.telefonos, ...c.emails].join(" · ")}
                </p>
              )}
              {abierto !== c.id && (
                <p className="text-[11px] font-mono mt-1">
                  {c.modelos?.length ? (
                    <span className="text-black/55">Presenta: {c.modelos.map((m) => `modelo ${m}`).join(" · ")}</span>
                  ) : (
                    <span className="text-black/40">Sin modelos marcados: no le salen vencimientos en la agenda.</span>
                  )}
                </p>
              )}

              {abierto === c.id && (
                <div className="mt-2 space-y-2 border-t-2 border-black/15 pt-2">
                  <label className="block">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-black/60">
                      NIF o DNI
                    </span>
                    <input
                      autoFocus
                      value={borrador.nif}
                      onChange={(e) => setBorrador((b) => ({ ...b, nif: e.target.value }))}
                      placeholder="B12345678 · 12345678Z"
                      className="w-full border-2 border-black px-2 py-1 text-sm bg-white font-mono mt-0.5"
                    />
                    <span className="text-[10px] text-black/45">
                      Un autónomo lleva DNI (8 números y letra). Una sociedad, NIF que empieza por letra.
                      Da igual con puntos o guiones.
                    </span>
                  </label>

                  <ListaTexto
                    etiqueta="Teléfonos desde los que manda facturas"
                    ayuda="Uno por línea, formato 34XXXXXXXXX. El suyo de siempre ya cuenta."
                    valor={borrador.telefonos}
                    onChange={(v) => setBorrador((b) => ({ ...b, telefonos: v }))}
                  />

                  <ListaTexto
                    etiqueta="Correos desde los que manda facturas"
                    ayuda="Uno por línea. El del dueño, el de administración…"
                    valor={borrador.emails}
                    onChange={(v) => setBorrador((b) => ({ ...b, emails: v }))}
                  />

                  {/* QUÉ PRESENTA ESTE CLIENTE. De aquí salen sus obligaciones
                      del trimestre en la agenda: se marca una casilla y
                      aparecen las cuatro fechas del año; se desmarca y
                      desaparecen. Casillas y no un formulario porque esto se
                      rellena cien veces, una por cliente. */}
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-black/60">
                      Qué presenta cada trimestre
                    </span>
                    <div className="flex gap-3 flex-wrap mt-1">
                      {MODELOS.map((m) => (
                        <label key={m.id} className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={borrador.modelos.includes(m.id)}
                            onChange={(e) =>
                              setBorrador((b) => ({
                                ...b,
                                modelos: e.target.checked
                                  ? [...b.modelos, m.id]
                                  : b.modelos.filter((x) => x !== m.id),
                              }))
                            }
                          />
                          <span className="font-mono font-bold">{m.id}</span>
                          <span className="text-black/50">{m.que}</span>
                        </label>
                      ))}
                    </div>
                    <span className="text-[10px] text-black/45">
                      Vencen el 20 de enero, abril, julio y octubre. Salen solas en la agenda.
                    </span>
                  </div>

                  <div className="flex gap-2 items-center flex-wrap">
                    <button
                      type="button"
                      onClick={() => guardar(c)}
                      disabled={guardando}
                      className="btn-mustard text-xs px-3 py-1.5 disabled:opacity-50"
                    >
                      {guardando ? "Guardando…" : "Guardar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAbierto(null); setMensaje(null); }}
                      className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white"
                    >
                      cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {mensaje && (
        <p
          className={`text-xs font-bold border-2 border-black px-2 py-1 mt-3 ${
            mensaje.tipo === "error"
              ? "bg-[color:var(--red)] text-white"
              : mensaje.tipo === "aviso"
                ? "bg-[color:var(--mustard)] text-black"
                : "bg-green-700 text-white"
          }`}
        >
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}
