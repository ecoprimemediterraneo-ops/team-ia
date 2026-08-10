// El paso que da un restaurante cuando la hora pedida no está libre.
//
// Vive aparte del webhook de Pablo por dos motivos: Carmen (voz) comparte motor
// y tiene que hacer exactamente lo mismo, y el webhook ya es largo de sobra.
//
// La decisión —ofrecer horas o pasar a lista de espera— la toma
// `siguientePasoSinHueco` en restaurante.ts. Aquí solo se reúnen los datos que
// necesita (horas libres reales del día) y se ejecuta.

import "server-only";
import type { AppointmentIntent } from "./appointment-intent";
import {
  getBusinessByTenant, computeFreeSlots, crearEspera, listRecordsForRange,
} from "./booking";
import {
  configRestaurante, siguientePasoSinHueco, textoAlternativas, textoListaEspera,
  alternativasYaOfrecidas, minutosQueOcupa, fichaComensal, restauranteEsperaEnabled,
} from "./restaurante";

export type PasoSinHueco = { texto: string; via: string };

/**
 * Devuelve qué contestar, o null si esto no aplica (sin negocio, sin config de
 * restaurante o sin fecha en el intent) para que el llamante siga por su flujo
 * de siempre.
 */
export async function pasoRestauranteSinHueco(opts: {
  tenantId: string;
  intent: AppointmentIntent;
  turnos: Array<{ role: string; text: string }>;
  telefono: string;
  nombreFallback?: string;
  redirectUri: string;
}): Promise<PasoSinHueco | null> {
  const startIso = opts.intent.fields.startIso;
  if (!startIso) return null;

  const business = await getBusinessByTenant(opts.tenantId);
  if (!business?.restaurante) return null;

  const cfg = configRestaurante(business);
  const fecha = startIso.slice(0, 10);
  const horaPedida = startIso.slice(11, 16);

  // Horas realmente libres ese día, del propio motor de reservas: nada de
  // suponer disponibilidad desde los turnos, que solo dicen cuándo se SIENTA.
  let horasLibres: string[] = [];
  try {
    // El footprint es la mesa MÁS la cortesía: si no, se ofrecerían horas que
    // en realidad pisan la mesa anterior.
    const slots = await computeFreeSlots(
      business,
      { durationMin: minutosQueOcupa(cfg) },
      fecha,
      opts.redirectUri,
    );
    if (slots.ok) horasLibres = slots.slots.map((s) => s.slice(11, 16));
  } catch (e) {
    console.error("[restaurante-flujo] no se pudieron leer huecos libres:", e);
  }

  const paso = siguientePasoSinHueco({
    cfg,
    fecha,
    horaPedida,
    horasLibres,
    rondasPrevias: alternativasYaOfrecidas(opts.turnos),
  });

  if (paso.accion === "ofrecer") {
    return { texto: textoAlternativas(paso.horas), via: "restaurante_alternativas" };
  }

  // --- Lista de espera ---
  // Se apunta SIEMPRE (es un apunte interno, no un mensaje). Lo que está detrás
  // del flag es el aviso posterior cuando se libere la mesa.
  try {
    const servicio = business.servicios.find((s) => s.activo);
    if (servicio) {
      const historico = await listRecordsForRange(business.slug, "0000-01-01", "9999-12-31").catch(() => []);
      const ficha = fichaComensal(historico, opts.telefono);
      await crearEspera({
        slug: business.slug,
        serviceId: servicio.id,
        fecha,
        cliente: {
          nombre: opts.intent.fields.nombre || opts.nombreFallback || "Sin nombre",
          telefono: opts.telefono,
        },
        comensales: opts.intent.fields.comensales,
        // Si no dijo zona pero siempre pide la misma, se apunta la suya.
        zona: opts.intent.fields.zona ?? ficha?.zonaHabitual,
        horaPedida,
      });
    }
  } catch (e) {
    console.error("[restaurante-flujo] no se pudo apuntar en lista de espera:", e);
  }

  const aviso = restauranteEsperaEnabled()
    ? ""
    : " (el aviso automático está apagado: RESTAURANTE_ESPERA_SEND_ENABLED)";
  if (aviso) console.log(`[restaurante-flujo] apuntado en lista de espera${aviso}`);

  return { texto: textoListaEspera(business.nombre), via: "restaurante_lista_espera" };
}
