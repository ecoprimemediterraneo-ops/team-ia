"use client";

// LA COLA DE LEADS — la pantalla propia de estética, la que dental no tiene.
//
// Qué contesta, en este orden: a quién hay que contestar YA (caliente y sin
// respuesta), quién ha preguntado y por qué tratamiento, si ya se le ofreció
// valoración (eso es el estado "cita_puesta") y cuánto lleva abierto.
//
// SOLO LEE. Mover un lead de estado se hace por el chat de arriba, que lo
// PROPONE y espera un sí — el mismo camino de confirmación que todo lo demás
// en estos paneles (`estetica-acciones.ts`). Un botón suelto aquí sería una
// segunda vía de escritura sin confirmación, y es justo lo que el patrón de
// dental evita.

import { useState } from "react";
// Desde el módulo PURO, no desde `estetica-leads.ts`: ese es `server-only`.
import { ESTADOS_LEAD, ETIQUETA_ESTADO, type EstadoLead } from "@/lib/estetica-leads-tipos";

export type LeadEnPantalla = {
  id: string;
  nombre: string;
  telefono: string;
  instagram?: string;
  tratamientoInteres?: string;
  estado: EstadoLead;
  caliente: boolean;
  motivoCaliente?: string;
  nota?: string;
  diasAbierto: number;
  /** Horas desde el último contacto (o desde que entró, si nunca se le contestó). */
  horasEsperando: number;
  sinContestar: boolean;
};

type Filtro = "todos" | EstadoLead;

function comoSeLlama(l: LeadEnPantalla): string {
  return l.nombre || (l.instagram ? `@${l.instagram.replace(/^@/, "")}` : l.telefono) || "Sin nombre";
}

function esperando(horas: number): string {
  if (horas < 1) return "ahora mismo";
  if (horas < 24) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  return `${dias} ${dias === 1 ? "día" : "días"}`;
}

export default function ColaLeads({ leads }: { leads: LeadEnPantalla[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const cuenta = (e: Filtro) => (e === "todos" ? leads.length : leads.filter((l) => l.estado === e).length);
  const visibles = filtro === "todos" ? leads : leads.filter((l) => l.estado === filtro);

  // Los calientes sin contestar van SIEMPRE arriba, filtre por lo que filtre:
  // es lo único de esta pantalla que cuesta dinero si se pasa por alto.
  const ordenados = [...visibles].sort((a, b) => {
    if (a.sinContestar !== b.sinContestar) return a.sinContestar ? -1 : 1;
    return b.horasEsperando - a.horasEsperando;
  });

  if (!leads.length) {
    return (
      <div className="border-2 border-dashed border-black p-6 text-sm text-black/60 leading-snug">
        Todavía no hay ningún lead apuntado. Se apuntan solos en cuanto Pablo o Marta detectan a alguien
        con interés real por WhatsApp o Instagram, y también puedes apuntar uno a mano desde el chat de
        arriba (&ldquo;apúntame un lead: Ana, 600111222, pregunta por láser facial&rdquo;).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {(["todos", ...ESTADOS_LEAD] as Filtro[]).map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setFiltro(e)}
            className={`text-[10px] font-mono uppercase tracking-widest border-2 px-2 py-1 ${
              filtro === e ? "bg-black text-white border-black" : "border-black/25 text-black/55 hover:border-black hover:text-black bg-white"
            }`}
          >
            {e === "todos" ? "Todos" : ETIQUETA_ESTADO[e]} · {cuenta(e)}
          </button>
        ))}
      </div>

      {ordenados.length === 0 ? (
        <div className="border-2 border-dashed border-black p-4 text-sm text-black/60">
          No hay ningún lead en ese estado.
        </div>
      ) : (
        <div className="space-y-2">
          {ordenados.map((l) => (
            <div
              key={l.id}
              className={`card-hard p-3 ${l.sinContestar ? "bg-[color:var(--red)] text-white" : "bg-white"}`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-bold text-sm">{comoSeLlama(l)}</div>
                  <div className={`text-xs ${l.sinContestar ? "opacity-90" : "text-black/60"}`}>
                    {l.tratamientoInteres || "Sin tratamiento concreto todavía"}
                    {l.telefono && l.nombre ? ` · ${l.telefono}` : ""}
                    {l.instagram && l.nombre ? ` · @${l.instagram.replace(/^@/, "")}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  {l.caliente && (
                    <span
                      className={`text-[10px] font-mono uppercase tracking-widest border-2 px-1.5 py-0.5 ${
                        l.sinContestar ? "border-white" : "border-black bg-[color:var(--red)] text-white"
                      }`}
                    >
                      Caliente
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-mono uppercase tracking-widest border-2 px-1.5 py-0.5 ${
                      l.sinContestar ? "border-white" : "border-black bg-[color:var(--mustard)]"
                    }`}
                  >
                    {ETIQUETA_ESTADO[l.estado]}
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-widest border-2 px-1.5 py-0.5 whitespace-nowrap ${
                      l.sinContestar ? "border-white" : "border-black/25 text-black/55"
                    }`}
                    title={l.sinContestar ? "Sin contestar desde" : "Abierto desde hace"}
                  >
                    {l.sinContestar ? `${esperando(l.horasEsperando)} sin contestar` : `${l.diasAbierto} d`}
                  </span>
                </div>
              </div>
              {(l.motivoCaliente || l.nota) && (
                <div className={`text-xs mt-1 leading-snug ${l.sinContestar ? "opacity-90" : "text-black/55"}`}>
                  {l.motivoCaliente || l.nota}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-black/45 leading-snug">
        Para mover un lead de estado, pídeselo al chat de arriba (&ldquo;a Ana ya la he llamado&rdquo;,
        &ldquo;Ana ya tiene la valoración puesta&rdquo;). Te lo propone y no cambia nada hasta que lo confirmes.
      </p>
    </div>
  );
}
