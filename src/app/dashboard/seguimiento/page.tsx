// Seguimiento — recall de revisiones + presupuestos.
//
// Es la pantalla de las dos cosas que una clínica pierde por no tener a nadie
// detrás: el paciente que no volvió y el presupuesto que se quedó parado.
//
// Solo aparece en los sectores que tienen esas funciones encendidas
// (`recall` / `seguimientoPresupuestos` en sectores.ts → hoy, la clínica dental).
//
// Todo se lee por `ctx.tenantId`, nunca por el email de la sesión.

import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { candidatosRecall, recallSendEnabled, DIAS_ENTRE_AVISOS } from "@/lib/recall";
import {
  listarPresupuestos,
  presupuestosPendientes,
  presupuestosSendEnabled,
} from "@/lib/presupuestos";
import PresupuestosPanel from "@/components/PresupuestosPanel";

export const dynamic = "force-dynamic";

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function SeguimientoPage() {
  const ctx = await contextoPanelODefecto();
  const haceRecall = tieneFuncion(ctx.sector, "recall");
  const haceSeguimiento = tieneFuncion(ctx.sector, "seguimientoPresupuestos");
  const v = ctx.vocabulario;

  if (!haceRecall && !haceSeguimiento) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Seguimiento</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">
          Esta pantalla es para negocios con visitas que se repiten en el tiempo (revisiones) o con
          presupuestos que se dan y tardan en cerrarse. En {v.negocio} no aplica, así que no se
          enseña con datos vacíos.
        </div>
      </div>
    );
  }

  // incluirAvisados: en el panel interesa ver también a quien ya se avisó, para
  // saber que está en marcha. En el envío no se le vuelve a escribir.
  const candidatos = haceRecall ? await candidatosRecall(ctx.tenantId, { incluirAvisados: true }) : [];
  const sinAvisar = candidatos.filter((c) => !c.avisadoEn);

  const presupuestos = haceSeguimiento ? await listarPresupuestos(ctx.tenantId) : [];
  const pendientes = haceSeguimiento ? await presupuestosPendientes(ctx.tenantId) : [];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-black/40">Seguimiento</div>
        <h1 className="font-stencil text-3xl sm:text-4xl leading-none mt-1">
          Quién tiene que volver
        </h1>
        <p className="text-sm text-black/60 mt-2">
          Los {v.clientePlural} a los que les toca revisión y los presupuestos que siguen parados.
          Lo que aquí se ve es lo que Pablo va a recordar.
        </p>
      </div>

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
                    <th className="py-1">Estado</th>
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
                      <td className="py-2 whitespace-nowrap">
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

      {/* Sin adornos: si los envíos están apagados, se dice. Ver una lista de
          gente "por avisar" y creer que ya se les ha escrito sería peor que no
          tener la lista. */}
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
