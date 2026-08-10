// Expedientes — la pantalla de la gestoría.
//
// Solo existe donde el sector la enciende (`estadoExpediente`). En un salón o en
// un restaurante no se enseña: allí no hay trámites ni documentación pendiente.
//
// Lo que se ve aquí es exactamente lo que Pablo contesta por WhatsApp cuando el
// cliente pregunta "¿cómo va lo mío?". Si el panel y el agente dijeran cosas
// distintas, el que perdería la confianza sería el dueño.

import { getSessionLocal } from "@/lib/auth";
import { redirect } from "next/navigation";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import {
  listarExpedientes, resumenExpedientes, reclamacionesPendientes,
  ESTADO_LABEL, tramiteById, reclamacionDocsEnabled, calendarioFiscalEnabled,
  type EstadoExpediente,
} from "@/lib/gestoria";

export const dynamic = "force-dynamic";

const COLOR: Record<EstadoExpediente, string> = {
  recibido: "bg-white",
  esperando_documentacion: "bg-[color:var(--mustard)]",
  en_curso: "bg-white",
  presentado: "bg-green-700 text-white",
  cerrado: "bg-black/10",
};

export default async function ExpedientesPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");

  const ctx = await contextoPanelODefecto();
  if (!tieneFuncion(ctx.sector, "estadoExpediente")) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Expedientes</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">
          Esta pantalla es para gestorías, que trabajan por trámites con estado. En {ctx.vocabulario.negocio} no
          aplica, así que no se enseña con datos vacíos.
        </div>
      </div>
    );
  }

  const lista = await listarExpedientes(ctx.tenantId);
  const resumen = resumenExpedientes(lista);
  const reclamaciones = reclamacionesPendientes(lista);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-black/50">{ctx.tenant?.name}</div>
        <h1 className="font-stencil text-3xl md:text-4xl leading-none">Expedientes</h1>
        <p className="text-sm text-black/60 mt-1">
          Lo que Pablo contesta cuando un cliente pregunta cómo va lo suyo.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card-hard bg-white p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-black/50">Expedientes vivos</div>
          <div className="font-stencil text-3xl leading-none mt-1">{resumen.total}</div>
        </div>
        <div className="card-hard bg-[color:var(--mustard)] p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest">Falta documentación</div>
          <div className="font-stencil text-3xl leading-none mt-1">{resumen.esperandoDocs}</div>
        </div>
        <div className="card-hard bg-white p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-black/50">Documentos pendientes</div>
          <div className="font-stencil text-3xl leading-none mt-1">{resumen.documentosPendientes}</div>
        </div>
        <div className="card-hard bg-white p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-black/50">Vencen esta semana</div>
          <div className="font-stencil text-3xl leading-none mt-1">{resumen.venceEstaSemana}</div>
        </div>
      </div>

      {/* A quién se le reclamaría HOY. Se enseña aunque el envío esté apagado:
          es justo lo que el dueño quiere ver antes de encenderlo. */}
      <div className="card-hard bg-white p-4">
        <h2 className="font-stencil text-2xl leading-none mb-1">Reclamaciones de hoy</h2>
        <p className="text-xs text-black/60 mb-3">
          {reclamacionDocsEnabled()
            ? "El envío automático está ENCENDIDO."
            : "El envío automático está APAGADO (GESTORIA_DOCS_SEND_ENABLED). Aquí ves a quién se le escribiría."}
        </p>
        {reclamaciones.length === 0 ? (
          <p className="text-sm text-black/60">Hoy no hay que reclamar nada.</p>
        ) : (
          <ul className="space-y-2">
            {reclamaciones.map((r) => (
              <li key={r.expediente.id} className="border-2 border-black p-2 text-xs">
                <b>{r.expediente.clienteNombre}</b>
                {r.esRecordatorio && (
                  <span className="ml-2 text-[10px] font-mono uppercase bg-black text-white px-1">recordatorio</span>
                )}
                <div className="text-black/60 mt-0.5">{r.texto}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        {lista.length === 0 ? (
          <div className="card-hard bg-white p-6 text-sm text-black/60">
            Todavía no hay expedientes cargados en esta cuenta.
          </div>
        ) : (
          lista.map((e) => {
            const faltan = e.documentos.filter((d) => !d.recibido);
            return (
              <div key={e.id} className="card-hard bg-white p-3 flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-[12rem]">
                  <div className="font-bold text-sm">{e.clienteNombre}</div>
                  <div className="text-xs text-black/60 font-mono">
                    {tramiteById(e.tramite)?.nombre ?? e.tramite}
                    {e.periodo ? ` · ${e.periodo}` : ""}
                    {e.vence ? ` · vence ${e.vence}` : ""}
                  </div>
                  {faltan.length > 0 && (
                    <div className="text-xs text-black/60 mt-1">
                      Falta: {faltan.map((d) => d.nombre).join(", ")}
                    </div>
                  )}
                  {e.nota && <div className="text-xs text-black/50 mt-0.5">{e.nota}</div>}
                </div>
                <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 border-2 border-black ${COLOR[e.estado]}`}>
                  {ESTADO_LABEL[e.estado]}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="card-hard bg-white p-3 text-[11px] font-mono text-black/60">
        Calendario fiscal:{" "}
        {calendarioFiscalEnabled() ? "avisos ENCENDIDOS" : "avisos APAGADOS (GESTORIA_FISCAL_SEND_ENABLED)"}
      </div>
    </div>
  );
}
