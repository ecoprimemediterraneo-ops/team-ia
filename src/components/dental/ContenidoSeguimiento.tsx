// El cuerpo de "Seguimiento": revisiones pendientes (con nombre y fecha, no
// solo una cifra) y presupuestos parados. Extraído de
// `dashboard/seguimiento/page.tsx` para que la nueva pestaña de dental
// "Presupuestos y revisiones" reutilice EXACTAMENTE la misma pantalla —no una
// copia que diverja la primera vez que alguien la retoque— sin arrastrar el
// título ni el ancho propios, que ahora pone el layout fijo.

import "server-only";
import { candidatosRecall, recallSendEnabled, DIAS_ENTRE_AVISOS } from "@/lib/recall";
import { listarProgramaciones } from "@/lib/recall-programado";
import { listarPresupuestos, presupuestosPendientes, presupuestosSendEnabled } from "@/lib/presupuestos";
import PresupuestosPanel from "@/components/PresupuestosPanel";
import RevisionAcciones from "@/components/dental/RevisionAcciones";
import type { Vocabulario } from "@/lib/sectores";

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ContenidoSeguimiento({
  tenantId,
  vocabulario: v,
  haceRecall,
  haceSeguimiento,
}: {
  tenantId: string;
  vocabulario: Vocabulario;
  haceRecall: boolean;
  haceSeguimiento: boolean;
}) {
  const candidatos = haceRecall ? await candidatosRecall(tenantId, { incluirAvisados: true }) : [];
  const sinAvisar = candidatos.filter((c) => !c.avisadoEn);
  const programaciones = haceRecall ? await listarProgramaciones(tenantId) : {};

  const presupuestos = haceSeguimiento ? await listarPresupuestos(tenantId) : [];
  const pendientes = haceSeguimiento ? await presupuestosPendientes(tenantId) : [];

  return (
    <div className="space-y-6">
      {haceRecall && (
        <section className="card-hard bg-white p-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
            <h2 className="font-stencil text-2xl leading-none">Revisiones pendientes</h2>
            <span className="text-xs font-mono uppercase tracking-widest text-black/60">
              {sinAvisar.length} sin avisar · {candidatos.length} en total
            </span>
          </div>
          <p className="text-sm text-black/60 mb-4">
            Sale quien lleva más tiempo del recomendado sin pasar (6 meses tras una limpieza o
            revisión, 12 tras un tratamiento largo) y no tiene nada en agenda. A cada {v.cliente} se
            le avisa como mucho una vez cada {DIAS_ENTRE_AVISOS} días.
          </p>

          {candidatos.length === 0 ? (
            <div className="border-2 border-dashed border-black p-4 text-sm text-black/60">
              Ahora mismo no le toca revisión a nadie. Esto se calcula con las {v.citaPlural} que ya
              están en la agenda: si acabas de empezar y todavía no hay historial, aquí no aparecerá
              nadie hasta que lo haya.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-black/50">
                    <th className="py-1 pr-3">{v.cliente}</th>
                    <th className="py-1 pr-3">Última visita</th>
                    <th className="py-1 pr-3">Fue por</th>
                    <th className="py-1 pr-3">Toca</th>
                    <th className="py-1 pr-3">Estado</th>
                    <th className="py-1">Aviso</th>
                  </tr>
                </thead>
                <tbody>
                  {candidatos.map((c) => (
                    <tr key={c.clave} className="border-t-2 border-black/10 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-bold">{c.nombre || "Sin nombre"}</div>
                        <div className="text-xs text-black/50 font-mono">{c.telefono || "sin teléfono"}</div>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fecha(c.ultimaVisita)}</td>
                      <td className="py-2 pr-3">{c.ultimoServicio}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span className="font-bold">{c.motivo}</span>
                        <div className="text-xs text-black/50">
                          {c.diasDeRetraso === 0 ? "justo hoy" : `${c.diasDeRetraso} días de retraso`}
                        </div>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {c.avisadoEn ? (
                          <span className="border-2 border-black bg-[color:var(--mustard)] px-1.5 py-0.5 text-[10px] font-bold uppercase">
                            Avisado {fecha(c.avisadoEn)}
                          </span>
                        ) : (
                          <span className="border-2 border-black px-1.5 py-0.5 text-[10px] font-bold uppercase">
                            Por avisar
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        {c.avisadoEn ? (
                          <span className="text-xs text-black/40">—</span>
                        ) : (
                          <RevisionAcciones clave={c.clave} programadaPara={programaciones[c.clave]?.fecha} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {haceSeguimiento && (
        <PresupuestosPanel
          vocabulario={{ cliente: v.cliente, servicio: v.servicio }}
          presupuestosIniciales={presupuestos}
          pendientesIniciales={pendientes.map((p) => p.id)}
        />
      )}

      <section className="border-2 border-dashed border-black p-4 text-sm">
        <div className="font-bold mb-1">Envío automático por WhatsApp</div>
        <ul className="space-y-1 text-black/70">
          {haceRecall && (
            <li>
              Avisos de revisión:{" "}
              {recallSendEnabled() ? (
                <strong>activados</strong>
              ) : (
                <>
                  <strong>apagados</strong>. Se calcula todo y se ve aquí, pero no se escribe a
                  nadie hasta que se encienda.
                </>
              )}
            </li>
          )}
          {haceSeguimiento && (
            <li>
              Recordatorios de presupuesto:{" "}
              {presupuestosSendEnabled() ? (
                <strong>activados</strong>
              ) : (
                <>
                  <strong>apagados</strong>. Igual: se calculan y se ven, no se envían.
                </>
              )}
            </li>
          )}
          <li className="text-black/50">
            Los dos avisos llegan meses después de la última conversación, así que WhatsApp exige
            una plantilla aprobada por Meta. Sin ella el mensaje no sale, y aquí se dirá tal cual en
            vez de darlo por enviado.
          </li>
        </ul>
      </section>
    </div>
  );
}
