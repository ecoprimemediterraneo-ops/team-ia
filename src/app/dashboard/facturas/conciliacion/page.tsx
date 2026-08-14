import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { listarClientes, canalDe } from "@/lib/gestoria-clientes";
import {
  listarFacturas, listarMovimientos, listarSinAsignar, listarPasadas, listarConceptos,
} from "@/lib/gestoria-facturas";
import { resumenConciliacion, reclamacionSendEnabled, textoReclamacion } from "@/lib/gestoria-conciliacion";
import { bloqueDe } from "@/lib/gestoria-bloques";
import { ETIQUETA_GRUPO, type GrupoSinFactura } from "@/lib/gestoria-clasificacion";
import PanelConciliacion from "@/components/gestoria/PanelConciliacion";

export const dynamic = "force-dynamic";

export default async function ConciliacionPage({
  searchParams,
}: { searchParams: Promise<{ clienteId?: string }> }) {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();
  if (!tieneFuncion(ctx.sector, "estadoExpediente")) {
    return <div className="card-hard bg-white p-6 text-sm text-black/70">Esta pantalla es para gestorías.</div>;
  }

  const clientes = await listarClientes(ctx.tenantId);
  const sp = await searchParams;
  const clienteId = sp.clienteId || clientes[0]?.id || "";
  const cliente = clientes.find((c) => c.id === clienteId);

  const movimientos = await listarMovimientos(ctx.tenantId, clienteId);
  const facturas = await listarFacturas(ctx.tenantId, clienteId);
  const r = resumenConciliacion(movimientos, facturas);
  const pasadas = await listarPasadas(ctx.tenantId, clienteId);

  // El orden real del módulo: sin extracto no hay nada contra lo que cuadrar, y
  // una factura sin dueño hace que su cargo salga como no justificado aunque el
  // papel esté ahí. Se avisa aquí, que es donde duele.
  const hayExtracto = movimientos.length > 0;
  const sinAsignar = (await listarSinAsignar(ctx.tenantId)).length;
  const bloqueado = !hayExtracto || sinAsignar > 0;

  // El reparto en tres bloques. Se hace aquí, en el servidor, porque la regla
  // de qué lleva factura y qué no vive en un solo sitio y no se duplica en el
  // navegador. NADA se esconde: los tres bloques se pintan enteros.
  const aprendidos = await listarConceptos(ctx.tenantId, clienteId);
  const cargos = movimientos.filter((m) => m.signo === "cargo");
  const porJustificante = new Map(facturas.filter((f) => f.es_justificante).map((f) => [f.id, f]));

  const bloque3 = cargos
    .filter((m) => bloqueDe(m, aprendidos).bloque === 3)
    .map((m) => {
      const b = bloqueDe(m, aprendidos) as { bloque: 3; grupo: GrupoSinFactura; aMano: boolean };
      return {
        id: m.id, fecha: m.fecha, importe: m.importe, concepto: m.concepto,
        grupo: b.grupo, etiqueta: ETIQUETA_GRUPO[b.grupo], aMano: b.aMano,
        justificante: m.justificante_id ? porJustificante.get(m.justificante_id)?.nombre_original ?? "documento" : null,
      };
    });

  const idsBloque3 = new Set(bloque3.map((m) => m.id));

  // Lo que necesita el panel de cada cargo que SÍ hay que pedir.
  const sinJustificar = r.cargosSinFactura
    .filter((m) => !idsBloque3.has(m.id))
    .map((m) => ({
      id: m.id, fecha: m.fecha, importe: m.importe, concepto: m.concepto,
      veces: m.veces_sin_justificar ?? 0,
      pedidoEn: m.pedido_en ?? null,
      pedidoA: m.pedido_a ?? null,
      motivo: m.motivo ?? null,
      texto: textoReclamacion(m),
    }));

  const sugerencias = r.sugerencias.filter((sg) => !idsBloque3.has(sg.movimiento.id)).map((sg) => ({
    id: sg.movimiento.id, fecha: sg.movimiento.fecha, importe: sg.movimiento.importe,
    concepto: sg.movimiento.concepto, motivo: sg.motivo, enBloque: !!sg.enBloque,
    candidatas: sg.candidatas.map((c) => ({
      id: c.id, nombre: c.nombre_original, importe: c.importe, fecha: c.fecha_factura, proveedor: c.proveedor,
    })),
  }));

  const conciliados = r.conciliados.map((c) => ({
    id: c.movimiento.id, fecha: c.movimiento.fecha, importe: c.movimiento.importe,
    concepto: c.movimiento.concepto, factura: c.factura?.nombre_original ?? "factura enlazada",
    resueltoTras: c.movimiento.resuelto_tras ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-black/50">{ctx.tenant?.name}</div>
        <h1 className="font-stencil text-3xl md:text-4xl leading-none">Conciliación</h1>
        <p className="text-sm text-black/60 mt-1">
          {reclamacionSendEnabled()
            ? "Las reclamaciones al cliente se envían solas."
            : "El envío automático está apagado: el mensaje se prepara y lo mandas tú."}
        </p>
      </div>

      {/* La regla, en una línea. */}
      <div className="border-2 border-black bg-[color:var(--cream)] px-3 py-2 text-sm">
        🏦 Cruza los cargos del banco con las facturas recibidas. Cada cargo sin factura es lo que se reclama al cliente.
      </div>

      {/* Estado 1 — sin extracto no se puede empezar. Bloquea. */}
      {clientes.length > 0 && !hayExtracto && (
        <div className="card-hard bg-[color:var(--red)] text-white p-4 flex items-center gap-3 flex-wrap">
          <span className="text-3xl shrink-0" aria-hidden>🏦</span>
          <div className="flex-1 min-w-[14rem]">
            <p className="font-stencil text-2xl leading-none">Primero sube el extracto del banco</p>
            <p className="text-sm mt-1 opacity-90">
              De {cliente?.nombre ?? "este cliente"} todavía no hay ningún movimiento. Sin el extracto no hay contra
              qué cuadrar las facturas.
            </p>
          </div>
          <a href="/dashboard/facturas/banco"
            className="bg-white text-black font-mono uppercase tracking-widest text-xs border-2 border-black px-3 py-2 whitespace-nowrap shrink-0 hover:bg-[color:var(--mustard)]">
            Subir el extracto →
          </a>
        </div>
      )}

      {/* Estado 2 — quedan facturas sin dueño. También BLOQUEA: cruzar con
          facturas huérfanas da un resultado falso —sus cargos salen como no
          justificados— y sobre ese resultado se le reclama al cliente algo que
          ya había pagado. Vale más parar aquí. */}
      {hayExtracto && sinAsignar > 0 && (
        <div className="card-hard bg-[color:var(--red)] text-white p-4 flex items-center gap-3 flex-wrap">
          <span className="text-3xl shrink-0" aria-hidden>⚠</span>
          <div className="flex-1 min-w-[14rem]">
            <p className="font-stencil text-2xl leading-none">
              Antes, asigna {sinAsignar === 1 ? "la factura que está" : `las ${sinAsignar} facturas que están`} sin cliente
            </p>
            <p className="text-sm mt-1 opacity-90">
              Si cruzas ahora, sus cargos saldrán como no justificados y acabarías reclamándole al cliente algo que ya
              tienes.
            </p>
          </div>
          <a href="/dashboard/facturas"
            className="bg-white text-black font-mono uppercase tracking-widest text-xs border-2 border-black px-3 py-2 whitespace-nowrap shrink-0 hover:bg-[color:var(--mustard)]">
            Asignarlas →
          </a>
        </div>
      )}

      {clientes.length === 0 ? (
        <div className="card-hard bg-white p-6 text-sm text-black/60">No hay clientes con expediente todavía.</div>
      ) : (
        <PanelConciliacion
          clientes={clientes}
          clienteId={clienteId}
          clienteNombre={cliente?.nombre ?? ""}
          canal={cliente ? canalDe(cliente) : null}
          totalPagos={cargos.length}
          sinJustificar={sinJustificar}
          noLlevanFactura={bloque3}
          sugerencias={sugerencias}
          conciliados={conciliados}
          pasadas={pasadas}
          bloqueado={bloqueado}
          motivoBloqueo={!hayExtracto
            ? "Primero sube el extracto del banco"
            : "Primero asigna las facturas que están sin cliente"}
          envioEncendido={reclamacionSendEnabled()}
        />
      )}
    </div>
  );
}
