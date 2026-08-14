"use client";

// Panel de conciliación.
//
// La pantalla cuenta una historia en tres actos, y ese es todo el diseño:
//   1. CONCILIAR. Un botón que Jose pulsa cuando quiere. Cada pasada recalcula.
//   2. Lo que ha quedado sin justificar, y cuánto dinero es.
//   3. Pedírselo al cliente, marcando una a una las que quiera pedir.
//
// El histórico de pasadas va arriba porque es lo único que dice si el trabajo
// avanza: "24 feb: 5 · 26 feb: 2 · 2 mar: 1". Lo que quede al final del mes son
// las facturas que de verdad no existen.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Cargo = {
  id: string; fecha: string; importe: number; concepto: string;
  veces: number; pedidoEn: string | null; pedidoA: string | null;
  motivo: "la_tengo" | "no_corresponde" | "ahora_no" | null;
  texto: string;
};

/** Un cargo del bloque 3: no lleva factura de proveedor. */
type SinFactura = {
  id: string; fecha: string; importe: number; concepto: string;
  grupo: string; etiqueta: string; aMano: boolean; justificante: string | null;
};

type Candidata = { id: string; nombre: string; importe: number | null; fecha: string | null; proveedor: string | null };

type Sugerencia = {
  id: string; fecha: string; importe: number; concepto: string;
  motivo: "varias" | "otro_asunto" | "centimos" | "agrupada";
  enBloque: boolean; candidatas: Candidata[];
};

type Conciliado = {
  id: string; fecha: string; importe: number; concepto: string; factura: string; resueltoTras: number;
};

type Pasada = {
  fecha: string; sinJustificar: number; importeSinJustificar: number;
  conciliados: number; sugerencias: number;
  motivos: { la_tengo: number; no_corresponde: number; ahora_no: number };
};

const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const dia = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const diasDesde = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));

const POR_QUE_SUGERENCIA = {
  varias: "cuadran varias facturas",
  otro_asunto: "el concepto del banco no habla de ese proveedor",
  centimos: "cuadra por céntimos, no exacto",
  agrupada: "varias facturas suman este cargo",
} as const;

export default function PanelConciliacion({
  clientes, clienteId, clienteNombre, canal,
  totalPagos, sinJustificar, noLlevanFactura, sugerencias, conciliados, pasadas,
  bloqueado = false, motivoBloqueo = "Primero sube el extracto del banco", envioEncendido,
}: {
  clientes: { id: string; nombre: string }[];
  clienteId: string;
  clienteNombre: string;
  canal: "whatsapp" | "email" | null;
  /** Cargos del extracto. El "de N pagos" del titular. */
  totalPagos: number;
  sinJustificar: Cargo[];
  noLlevanFactura: SinFactura[];
  sugerencias: Sugerencia[];
  conciliados: Conciliado[];
  pasadas: Pasada[];
  bloqueado?: boolean;
  motivoBloqueo?: string;
  envioEncendido: boolean;
}) {
  const router = useRouter();
  const [corriendo, setCorriendo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [pidiendo, setPidiendo] = useState(false);

  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [preguntando, setPreguntando] = useState<string | null>(null);
  const [subiendoPara, setSubiendoPara] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Array<{ movimientoId: string; texto: string; canal: string | null; enviado: boolean }>>([]);

  // Sin filtros: aquí no se esconde nada. Lo que antes quitaban los filtros
  // ahora está en su bloque, a la vista y sumado.
  const visibles = sinJustificar;
  const sumaVisible = visibles.reduce((s, c) => s + c.importe, 0);
  const sumaSinFactura = noLlevanFactura.reduce((s, c) => s + c.importe, 0);

  // El bloque 3, por motivo. En lista plana son 59 líneas seguidas de nóminas y
  // recibos que nadie lee; agrupado se entiende de un vistazo.
  const grupos = useMemo(() => {
    const m = new Map<string, { etiqueta: string; cargos: SinFactura[] }>();
    for (const c of noLlevanFactura) {
      const g = m.get(c.grupo) ?? { etiqueta: c.etiqueta, cargos: [] };
      g.cargos.push(c);
      m.set(c.grupo, g);
    }
    return [...m.entries()]
      .map(([k, v]) => ({ grupo: k, ...v, total: v.cargos.reduce((s, c) => s + c.importe, 0) }))
      .sort((a, b) => b.cargos.length - a.cargos.length);
  }, [noLlevanFactura]);

  const [abierto, setAbierto] = useState<Set<string>>(new Set());
  const [subiendoGrupo, setSubiendoGrupo] = useState<string | null>(null);
  const ultima = pasadas[pasadas.length - 1];
  const resueltos = conciliados.filter((c) => c.resueltoTras > 0);

  async function conciliar() {
    setCorriendo(true); setAviso(""); setMensajes([]);
    try {
      const res = await fetch("/api/gestoria/facturas/conciliar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId }),
      });
      const j = await res.json();
      if (!res.ok) { setAviso(j.mensaje || "No se ha podido conciliar."); return; }
      setAviso(
        `${j.sinJustificar} ${j.sinJustificar === 1 ? "cargo se queda" : "cargos se quedan"} sin justificar` +
        ` · ${eur(j.importeSinJustificar)}` +
        (j.conciliados ? ` · ${j.conciliados} cuadrados` : "") +
        (j.sugerencias ? ` · ${j.sugerencias} por decidir` : "") +
        (j.resueltos ? ` · ${j.resueltos} resueltos de pasadas anteriores` : ""),
      );
      setMarcados(new Set());
      router.refresh();
    } finally {
      setCorriendo(false);
    }
  }

  async function decidir(movimientoId: string, cuerpo: Record<string, unknown>) {
    await fetch("/api/gestoria/facturas/decidir", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movimientoId, ...cuerpo }),
    });
    router.refresh();
  }

  function alternar(id: string, marcar: boolean) {
    setMarcados((prev) => {
      const n = new Set(prev);
      if (marcar) n.add(id); else n.delete(id);
      return n;
    });
    // Desmarcar pide el motivo. Marcar no pregunta nada.
    setPreguntando(marcar ? null : id);
  }

  /** "La tengo yo": sube la FACTURA de un cargo del bloque 2 y lo cierra. */
  async function subirFacturaDelCargo(movimientoId: string, f: File) {
    setSubiendoPara(movimientoId);
    try {
      const fd = new FormData();
      fd.append("movimientoId", movimientoId);
      fd.append("fichero", f);
      const res = await fetch("/api/gestoria/facturas/justificar", { method: "POST", body: fd });
      if (res.ok) {
        setPreguntando(null);
        setMarcados((p) => { const n = new Set(p); n.delete(movimientoId); return n; });
        setAviso("Factura subida y cargo justificado.");
        router.refresh();
      } else {
        setAviso("No se ha podido subir esa factura.");
      }
    } finally {
      setSubiendoPara(null);
    }
  }

  async function mover(movimientoId: string, destino: "lleva" | "no_lleva") {
    await fetch("/api/gestoria/facturas/bloque", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movimientoId, destino }),
    });
    setMarcados((p) => { const n = new Set(p); n.delete(movimientoId); return n; });
    setAviso(destino === "no_lleva"
      ? "Movido a «no lleva factura». La próxima vez se coloca solo."
      : "Movido a «hay que pedir la factura».");
    router.refresh();
  }

  async function subirJustificante(ids: string[], f: File, clave: string) {
    setSubiendoGrupo(clave);
    try {
      const fd = new FormData();
      fd.append("movimientos", ids.join(","));
      fd.append("fichero", f);
      const res = await fetch("/api/gestoria/facturas/justificante", { method: "POST", body: fd });
      const j = await res.json();
      setAviso(res.ok
        ? `Justificante guardado para ${j.cubre} ${j.cubre === 1 ? "cargo" : "cargos"}.`
        : "No se ha podido guardar el justificante.");
      router.refresh();
    } finally {
      setSubiendoGrupo(null);
    }
  }

  async function pedir() {
    const ids = [...marcados];
    if (!ids.length) return;
    setPidiendo(true);
    try {
      const res = await fetch("/api/gestoria/facturas/reclamar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, textos }),
      });
      const j = await res.json();
      if (!res.ok) { setAviso(j.error || "No se ha podido pedir."); return; }
      setMensajes(j.mensajes ?? []);
      setAviso(
        (envioEncendido
          ? `${j.enviados} de ${j.total} enviados`
          : `${j.total} aviso(s) preparados · el envío está apagado, cópialos y mándalos tú`) +
        (j.aviso ? ` · ${j.aviso}` : ""),
      );
      setMarcados(new Set());
      router.refresh();
    } finally {
      setPidiendo(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs font-mono uppercase tracking-widest text-black/60">Cliente</label>
        <select
          value={clienteId}
          onChange={(e) => { window.location.href = `/dashboard/facturas/conciliacion?clienteId=${e.target.value}`; }}
          className="card-hard px-3 py-2 bg-white text-sm"
        >
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>

        {bloqueado ? (
          <span title={motivoBloqueo}
            className="ml-auto text-xs font-mono uppercase tracking-widest border-2 border-black px-3 py-2 opacity-40 cursor-not-allowed">
            Descargar en Excel
          </span>
        ) : (
          <a href={`/api/gestoria/facturas/exportar?clienteId=${clienteId}`}
            className="ml-auto text-xs font-mono uppercase tracking-widest border-2 border-black px-3 py-2 hover:bg-black hover:text-white">
            Descargar en Excel
          </a>
        )}
        {/* Visible y DESACTIVADO: no hay integración con Bilky ni se ha
            inventado su formato. La exportación ya está hecha; solo falta
            enchufarle el formato cuando se conozca. */}
        <button type="button" disabled title="Todavía no está enchufado con Bilky"
          className="text-xs font-mono uppercase tracking-widest border-2 border-black px-3 py-2 opacity-40 cursor-not-allowed">
          Pasar a Bilky
        </button>
      </div>

      {/* ---------- EL TITULAR ----------
          Esto no es una herramienta contable con sello: es la secretaria del
          gestor. Su trabajo es decirle en UNA frase qué le falta. Por eso el
          titular va primero y en grande, y las tablas debajo para quien quiera
          el detalle: la pantalla tiene que entenderse sin leer una tabla.

          Se dice "justificantes" y no "facturas" a propósito: una multa o una
          tasa no tienen factura, pero sí un papel que las respalde. */}
      <div className="card-hard bg-white p-5 md:p-6">
        {visibles.length === 0 ? (
          <p className="font-stencil text-3xl md:text-5xl leading-none">Están todos los pagos justificados</p>
        ) : (
          <>
            <p className="font-stencil text-3xl md:text-5xl leading-none">
              Te faltan {visibles.length} {visibles.length === 1 ? "justificante" : "justificantes"} de {totalPagos} pagos
            </p>
            <p className="text-sm text-black/60 mt-2">{eur(sumaVisible)}</p>
          </>
        )}
        {noLlevanFactura.length > 0 && (
          <p className="text-xs text-black/50 mt-1">
            Otros {noLlevanFactura.length} pagos no llevan justificante de proveedor · {eur(sumaSinFactura)}
          </p>
        )}
        {sugerencias.length > 0 && (
          <p className="text-xs text-black/50 mt-1">
            {sugerencias.length} {sugerencias.length === 1 ? "espera" : "esperan"} un clic tuyo, más abajo.
          </p>
        )}
      </div>

      {/* ---------- 1. EL BOTÓN ---------- */}
      <div className="card-hard bg-white p-5 text-center">
        <button
          type="button" onClick={conciliar} disabled={bloqueado || corriendo}
          title={bloqueado ? motivoBloqueo : undefined}
          className="btn-mustard font-stencil text-3xl md:text-4xl leading-none px-8 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {corriendo ? "CRUZANDO…" : "CONCILIAR"}
        </button>
        <p className="text-xs text-black/60 mt-2">(cruce de facturas con extracto bancario)</p>
        <p className="text-[11px] text-black/50 mt-1">
          Púlsalo las veces que quieras. Cada pasada vuelve a cruzar con las facturas que haya en ese momento.
        </p>
        {aviso && (
          <p className="mt-3 inline-block border-2 border-black bg-[color:var(--cream)] px-3 py-1.5 text-sm font-bold">
            {aviso}
          </p>
        )}
      </div>

      {/* ---------- Histórico de pasadas ---------- */}
      {pasadas.length > 0 && (
        <div className="border-2 border-black bg-white px-3 py-2 text-sm">
          <span className="font-mono text-[10px] uppercase tracking-widest text-black/50 mr-2">Pasadas</span>
          {pasadas.map((p, i) => (
            <span key={i}>
              {i > 0 && <span className="text-black/30"> · </span>}
              <b>{dia(p.fecha)}</b>: {p.sinJustificar}{i === 0 ? " sin justificar" : ""}
            </span>
          ))}
          {ultima && (ultima.motivos.la_tengo + ultima.motivos.no_corresponde + ultima.motivos.ahora_no > 0) && (
            <span className="block text-[11px] font-mono text-black/60 mt-1">
              motivos: {ultima.motivos.la_tengo} la tenía · {ultima.motivos.no_corresponde} no correspondía ·{" "}
              {ultima.motivos.ahora_no} no se pide ahora
            </span>
          )}
        </div>
      )}

      {/* ---------- El detalle, para quien lo quiera ---------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card-hard bg-white p-3 border-l-[10px] border-l-green-700">
          <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">Cuadrados</div>
          <div className="font-stencil text-3xl leading-none mt-1">{conciliados.length}</div>
          <div className="text-[11px] font-mono text-black/50">cargo con su factura</div>
        </div>
        <div className="card-hard bg-[color:var(--mustard)] p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest">Hay que pedir la factura</div>
          <div className="font-stencil text-3xl leading-none mt-1">{visibles.length}</div>
          <div className="text-[11px] font-mono">{eur(sumaVisible)}</div>
        </div>
        <div className="card-hard bg-white p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">No llevan factura</div>
          <div className="font-stencil text-3xl leading-none mt-1">{noLlevanFactura.length}</div>
          <div className="text-[11px] font-mono text-black/50">{eur(sumaSinFactura)}</div>
        </div>
      </div>

      {/* ---------- Sugerencias: ni cuadradas ni reclamadas ---------- */}
      {sugerencias.length > 0 && (
        <div className="card-hard bg-white p-4 border-l-[10px] border-l-[color:var(--mustard)]">
          <h2 className="font-stencil text-2xl leading-none mb-1">Hay que decidir · {sugerencias.length}</h2>
          <p className="text-xs text-black/60 mb-3">
            Ni cuadrados ni reclamados: esperan un clic tuyo. Hasta que no los aceptes no cuentan como justificados.
          </p>
          <div className="space-y-2">
            {sugerencias.map((s) => (
              <div key={s.id} className="border-2 border-black p-2">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <b className="font-stencil text-xl">{eur(s.importe)}</b>
                  <span className="text-sm">{s.concepto || "(sin concepto)"}</span>
                  <span className="text-[11px] font-mono text-black/60">{s.fecha}</span>
                  <span className="text-[10px] font-mono uppercase border-2 border-black px-1.5 py-0.5 bg-[color:var(--cream)]">
                    {POR_QUE_SUGERENCIA[s.motivo]}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {s.enBloque ? (
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-mono flex-1 min-w-[12rem]">
                        {s.candidatas.map((c) => `${c.nombre} (${c.importe != null ? eur(c.importe) : "?"})`).join(" + ")}
                      </span>
                      <button type="button" onClick={() => decidir(s.id, { aceptar: s.candidatas.map((c) => c.id) })}
                        className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white">
                        aceptar las {s.candidatas.length} juntas
                      </button>
                      <button type="button" onClick={() => decidir(s.id, { rechazar: s.candidatas.map((c) => c.id) })}
                        className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-[color:var(--red)] hover:text-white">
                        no
                      </button>
                    </div>
                  ) : (
                    s.candidatas.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-mono flex-1 min-w-[12rem]">
                          {c.nombre} · {c.importe != null ? eur(c.importe) : "sin importe"} · {c.fecha ?? "sin fecha"}
                          {c.proveedor ? ` · ${c.proveedor}` : ""}
                        </span>
                        <button type="button" onClick={() => decidir(s.id, { aceptar: [c.id] })}
                          className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white">
                          es esta
                        </button>
                        <button type="button" onClick={() => decidir(s.id, { rechazar: [c.id] })}
                          className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-[color:var(--red)] hover:text-white">
                          no
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- 2 y 3. Lo que falta y cómo pedirlo ---------- */}
      <div className="card-hard bg-white p-4">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h2 className="font-stencil text-2xl leading-none">Hay que pedir la factura · {visibles.length}</h2>
          {marcados.size > 0 && (
            <button type="button" onClick={pedir} disabled={bloqueado || pidiendo}
              title={bloqueado ? motivoBloqueo : undefined}
              className="btn-mustard text-xs px-3 py-1.5 ml-auto disabled:opacity-50">
              {pidiendo ? "PREPARANDO…" : marcados.size === 1 ? "Enviar el aviso marcado" : `Enviar los ${marcados.size} avisos marcados`}
            </button>
          )}
        </div>

        {visibles.length === 0 ? (
          <p className="text-sm text-black/60">
            {bloqueado
              ? "Sube el extracto del banco y aquí saldrá lo que no cuadra."
              : sinJustificar.length > 0
                ? "Nada por encima del filtro. Quítalo para ver el resto."
                : "Ni un cargo sin su factura. Todo cuadrado."}
          </p>
        ) : (
          <div className="space-y-2">
            {visibles.map((c) => {
              const marcado = marcados.has(c.id);
              return (
                <div key={c.id} className={`border-2 border-black p-2 ${marcado ? "bg-[color:var(--mustard)]/25" : ""}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <input type="checkbox" checked={marcado} disabled={bloqueado}
                      onChange={(e) => alternar(c.id, e.target.checked)}
                      aria-label={`Pedir la factura de ${eur(c.importe)}`} />
                    <div className="font-stencil text-xl leading-none w-28">{eur(c.importe)}</div>
                    <div className="flex-1 min-w-[10rem]">
                      <div className="text-sm">{c.concepto || "(sin concepto)"}</div>
                      <div className="text-[11px] font-mono text-black/60">
                        {c.fecha} · {clienteNombre}
                        {c.veces > 1 ? ` · lleva ${c.veces} pasadas sin factura` : ""}
                      </div>
                    </div>
                    <button type="button" onClick={() => mover(c.id, "no_lleva")}
                      className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white whitespace-nowrap">
                      no lleva factura
                    </button>
                    {c.pedidoEn ? (
                      <span className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 bg-[color:var(--cream)]">
                        {diasDesde(c.pedidoEn) === 0
                          ? "pedido hoy"
                          : `pedido hace ${diasDesde(c.pedidoEn)} ${diasDesde(c.pedidoEn) === 1 ? "día" : "días"}`}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono uppercase text-black/40 px-2 py-1">
                        {canal === "whatsapp" ? "irá por WhatsApp" : canal === "email" ? "irá por correo" : "sin contacto en la ficha"}
                      </span>
                    )}
                  </div>

                  {/* El motivo, al desmarcar. Un clic, nada obligatorio de escribir. */}
                  {preguntando === c.id && (
                    <div className="mt-2 border-2 border-black bg-[color:var(--cream)] p-2 flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-bold">¿Por qué no se la pides?</span>
                      <label className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 cursor-pointer hover:bg-black hover:text-white">
                        {subiendoPara === c.id ? "subiendo…" : "la tengo yo"}
                        <input type="file" accept="image/*,application/pdf" className="hidden"
                          onChange={(e) => e.target.files?.[0] && subirFacturaDelCargo(c.id, e.target.files[0])} />
                      </label>
                      <button type="button"
                        onClick={() => { decidir(c.id, { motivo: "no_corresponde" }); setPreguntando(null); }}
                        className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white">
                        no corresponde
                      </button>
                      <button type="button"
                        onClick={() => { decidir(c.id, { motivo: "ahora_no" }); setPreguntando(null); }}
                        className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-white">
                        ahora no se la pido
                      </button>
                      <button type="button" onClick={() => setPreguntando(null)} className="ml-auto text-xs">×</button>
                    </div>
                  )}

                  {/* El texto que se va a mandar, a la vista y editable. */}
                  {marcado && (
                    <textarea
                      value={textos[c.id] ?? c.texto}
                      onChange={(e) => setTextos((t) => ({ ...t, [c.id]: e.target.value }))}
                      rows={2}
                      className="mt-2 w-full border-2 border-black/40 p-2 text-xs bg-white"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lo que se ha preparado para mandar */}
      {mensajes.length > 0 && (
        <div className="card-hard bg-white p-4">
          <h2 className="font-stencil text-2xl leading-none mb-1">Avisos preparados</h2>
          <p className="text-xs text-black/60 mb-3">
            {envioEncendido ? "Los marcados como enviados ya han salido." : "El envío está apagado: cópialos y mándalos tú."}
          </p>
          {mensajes.map((m) => (
            <div key={m.movimientoId} className="border-2 border-black p-2 mb-2 text-sm">
              {m.texto}
              <div className="text-[10px] font-mono uppercase mt-1 text-black/50">
                {m.enviado
                  ? `enviado por ${m.canal}`
                  : `sin enviar${m.canal ? ` · iría por ${m.canal}` : " · este cliente no tiene contacto en su ficha"}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- 3. NO LLEVA FACTURA ---------- */}
      {noLlevanFactura.length > 0 && (
        <div className="card-hard bg-white p-4">
          <h2 className="font-stencil text-2xl leading-none mb-1">
            No lleva factura · {noLlevanFactura.length} · {eur(sumaSinFactura)}
          </h2>
          <p className="text-xs text-black/60 mb-3">
            Estos cargos no llevan factura de proveedor, no hay nada que pedirle al cliente. Se ven todos, suman su
            total y no cuentan como pendientes. Si alguno sí lleva factura, súbelo con un clic.
          </p>
          <div className="space-y-2">
            {grupos.map((g) => {
              const abiertoG = abierto.has(g.grupo);
              const conDoc = g.cargos.filter((c) => c.justificante).length;
              return (
                <div key={g.grupo} className="border-2 border-black">
                  <div className="flex items-center gap-2 flex-wrap p-2 bg-[color:var(--cream)]">
                    <button type="button"
                      onClick={() => setAbierto((p) => { const n = new Set(p); if (n.has(g.grupo)) n.delete(g.grupo); else n.add(g.grupo); return n; })}
                      className="font-stencil text-xl leading-none text-left flex-1 min-w-[12rem]">
                      {abiertoG ? "▾" : "▸"} {g.etiqueta} · {g.cargos.length} {g.cargos.length === 1 ? "cargo" : "cargos"} · {eur(g.total)}
                    </button>
                    <span className="text-[10px] font-mono uppercase text-black/50">
                      {conDoc === 0 ? "sin justificante" : `${conDoc} con justificante`}
                    </span>
                    {/* Un mismo documento cubre todo el grupo: un TC cubre las
                        cuotas del mes entero. */}
                    <label className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 cursor-pointer hover:bg-black hover:text-white whitespace-nowrap">
                      {subiendoGrupo === g.grupo ? "subiendo…" : "adjuntar al grupo"}
                      <input type="file" accept="image/*,application/pdf" className="hidden"
                        onChange={(e) => e.target.files?.[0] && subirJustificante(g.cargos.map((c) => c.id), e.target.files[0], g.grupo)} />
                    </label>
                  </div>

                  {abiertoG && (
                    <div className="p-2 space-y-1">
                      {g.cargos.map((c) => (
                        <div key={c.id} className="border-2 border-black/20 p-2 flex items-center gap-2 flex-wrap text-xs">
                          <b className="w-24 font-stencil text-base">{eur(c.importe)}</b>
                          <span className="flex-1 min-w-[10rem]">
                            {c.concepto || "(sin concepto)"}
                            <span className="block font-mono text-black/50">
                              {c.fecha}{c.aMano ? " · lo moviste tú" : ""}
                            </span>
                          </span>
                          {c.justificante ? (
                            <span className="text-[10px] font-mono uppercase border-2 border-green-700 text-green-800 px-1.5 py-0.5">
                              justificante: {c.justificante}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono uppercase text-black/35">sin justificante</span>
                          )}
                          <label className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 cursor-pointer hover:bg-black hover:text-white">
                            {subiendoGrupo === c.id ? "subiendo…" : "adjuntar"}
                            <input type="file" accept="image/*,application/pdf" className="hidden"
                              onChange={(e) => e.target.files?.[0] && subirJustificante([c.id], e.target.files[0], c.id)} />
                          </label>
                          <button type="button" onClick={() => mover(c.id, "lleva")}
                            className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-[color:var(--mustard)]">
                            esto sí lleva factura
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cuadrados */}
      <div className="card-hard bg-white p-4 border-l-[10px] border-l-green-700">
        <h2 className="font-stencil text-2xl leading-none mb-3">Cuadrados · {conciliados.length}</h2>
        {conciliados.length === 0 ? <p className="text-sm text-black/60">Nada cuadrado todavía.</p> : (
          <div className="space-y-1">
            {conciliados.slice(0, 40).map((c) => (
              <div key={c.id} className="border-2 border-black p-2 text-xs flex items-center gap-2 flex-wrap">
                <b>{eur(c.importe)}</b> · {c.fecha} · {c.concepto}
                <span className="font-mono text-black/60">↳ {c.factura}</span>
                {c.resueltoTras > 0 && (
                  <span className="text-[10px] font-mono uppercase border-2 border-green-700 text-green-800 px-1.5 py-0.5">
                    resuelto tras {c.resueltoTras} {c.resueltoTras === 1 ? "pasada" : "pasadas"}
                  </span>
                )}
              </div>
            ))}
            {conciliados.length > 40 && <p className="text-xs text-black/50">y {conciliados.length - 40} más.</p>}
          </div>
        )}
        {resueltos.length > 0 && (
          <p className="text-xs text-black/60 mt-2">
            {resueltos.length} {resueltos.length === 1 ? "cargo llevaba" : "cargos llevaban"} varias pasadas esperando y ya
            {resueltos.length === 1 ? " está" : " están"} justificados.
          </p>
        )}
      </div>
    </div>
  );
}
