// CITAS EN SERIE: tratamientos de varias sesiones (p. ej. 6 sesiones cada 3 semanas).
//
// La dueña define en cada servicio cuántas sesiones tiene y cada cuántos días
// (`BookingService.sesiones`). Cuando Pablo o Carmen reservan la PRIMERA, se
// reservan también las demás de una vez, a la misma hora y con la misma
// profesional, cada una por el motor de siempre (horario, candado, huecos). Si
// alguna fecha no tiene hueco, se coge el más cercano a esa fecha y se dice.

import "server-only";
import { getBusinessByTenant, servicioParaTexto } from "./booking";
import { reservarSlot } from "./orchestrator";
import { huecosCercanos, cuandoHablado } from "./guion-huecos";
import type { EventChannel } from "./event-log";

const REDIRECT = "https://aiteam.marketing/api/lucia/callback";

export type SesionSerie = { n: number; pedida: string; iso?: string; ok: boolean; movida: boolean };

function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return `${d.toISOString().slice(0, 10)}T${iso.slice(11, 19) || "10:00:00"}`;
}

/** Reserva las sesiones 2..N tras la primera. null si el servicio no es de varias sesiones. */
export async function completarSerie(o: {
  tenantId: string; primeraIso: string; motivo: string; nombre: string; telefono?: string; empleadoId?: string; agenteOrigen: EventChannel;
}): Promise<{ total: number; cadaDias: number; sesiones: SesionSerie[] } | null> {
  const negocio = await getBusinessByTenant(o.tenantId);
  if (!negocio) return null;
  const sv = servicioParaTexto(negocio, o.motivo);
  const n = sv?.sesiones?.numero ?? 0;
  const cada = sv?.sesiones?.cadaDias ?? 0;
  if (!sv || n <= 1 || cada <= 0) return null;
  const sesiones: SesionSerie[] = [];
  for (let i = 1; i < n; i++) {
    const pedida = sumarDias(o.primeraIso, i * cada);
    const base = {
      tenantId: o.tenantId, userEmail: process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com", redirectUri: REDIRECT,
      nombre: o.nombre, motivo: sv.nombre, agenteOrigen: o.agenteOrigen, customerPhone: o.telefono, empleadoId: o.empleadoId,
      confirmacionEnConversacion: true,
    };
    let r = await reservarSlot({ ...base, startIso: pedida });
    if (r.ok) { sesiones.push({ n: i + 1, pedida, iso: pedida, ok: true, movida: false }); continue; }
    // Sin hueco ese día a esa hora: la más cercana a esa fecha.
    const cerca = await huecosCercanos(o.tenantId, { startIso: pedida, motivo: sv.nombre, empleadoId: o.empleadoId, n: 1 }).catch(() => [] as string[]);
    if (cerca[0]) {
      r = await reservarSlot({ ...base, startIso: cerca[0] });
      if (r.ok) { sesiones.push({ n: i + 1, pedida, iso: cerca[0], ok: true, movida: true }); continue; }
    }
    sesiones.push({ n: i + 1, pedida, ok: false, movida: false });
  }
  return { total: n, cadaDias: cada, sesiones };
}

/** Lo que se le dice a la clienta de las demás sesiones (WhatsApp o voz). */
export function textoSerie(s: { total: number; sesiones: SesionSerie[] }, idioma: "es" | "en" = "es"): string {
  const ok = s.sesiones.filter((x) => x.ok);
  const mal = s.sesiones.filter((x) => !x.ok);
  const lineas = ok.map((x) => `${x.n}ª: ${cuandoHablado(x.iso!)}${x.movida ? ` (el ${x.pedida.slice(8, 10)}/${x.pedida.slice(5, 7)} no había hueco, es la más cercana)` : ""}`);
  if (idioma === "en") {
    return `The other sessions are booked too:\n${ok.map((x) => `Session ${x.n}: ${x.iso!.slice(0, 10)} at ${x.iso!.slice(11, 16)}${x.movida ? " (closest available)" : ""}`).join("\n")}${mal.length ? `\nI couldn't find a slot for session ${mal.map((x) => x.n).join(", ")}; we'll call you to fix it.` : ""}`;
  }
  return `Te dejo reservadas también las demás sesiones (${s.total} en total):\n${lineas.join("\n")}${mal.length ? `\nPara la sesión ${mal.map((x) => x.n).join(", ")} no he encontrado hueco; te la cerramos desde el salón.` : ""}`;
}
