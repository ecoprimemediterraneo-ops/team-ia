// Aplicar un sector a un negocio: tenant + ficha + negocio de reservas.
//
// Lo usan DOS sitios y por eso vive aparte:
//   · el alta (`/api/onboarding`), para un cliente nuevo
//   · el cambio de sector desde Perfil (`/api/perfil/sector-negocio`)
//
// Al cambiar de sector NO se borran los datos del cliente: se conservan sus
// servicios, su horario y sus fotos. Solo se cambia el sector (y, si el negocio
// todavía no tenía servicios, se siembran los del sector nuevo). Cambiar de
// sector no puede costarle a nadie su configuración.

import "server-only";
import {
  getTenant,
  upsertTenant,
  resolverTenantDeUsuario,
  DEFAULT_TENANT_ID,
  type Tenant,
} from "./tenants";
import {
  getBusinessesForTenant,
  saveBusiness,
  getBusinessBySlug,
  type BusinessBooking,
  type DayHours,
  type Horario,
} from "./booking";
import { getPerfilSector, type SectorNegocio } from "./sectores";

export type PerfilAlta = { nombre: string; sector: string; ofrece: string; tono: string; publico: string };
export type ServicioAlta = { nombre: string; durationMin: number; precioEUR?: number };

const CERRADO: DayHours = { abierto: false, franjas: [] };

/**
 * Horario por defecto de cada sector. Un despacho no abre sábados y un salón sí;
 * la tarde de una clínica empieza más tarde que la de una peluquería.
 */
function horarioPorSector(sector: SectorNegocio): Horario {
  const dia = (franjas: { desde: string; hasta: string }[]): DayHours => ({ abierto: true, franjas });
  const semana = (lab: DayHours, sab: DayHours = CERRADO): Horario =>
    ({ 0: CERRADO, 1: lab, 2: lab, 3: lab, 4: lab, 5: lab, 6: sab });

  switch (sector) {
    case "salon":
      return semana(dia([{ desde: "09:30", hasta: "14:00" }, { desde: "16:00", hasta: "20:00" }]),
                    dia([{ desde: "09:30", hasta: "14:00" }]));
    case "estetica":
      return semana(dia([{ desde: "10:00", hasta: "14:00" }, { desde: "16:00", hasta: "20:00" }]));
    case "dental":
      return semana(dia([{ desde: "09:00", hasta: "14:00" }, { desde: "15:30", hasta: "20:00" }]));
    case "gestoria":
      // Horario de oficina, el mismo que tenía el perfil anterior: la gestoría
      // abre de mañana y tarde y no trabaja el sábado.
      return semana(dia([{ desde: "09:00", hasta: "14:00" }, { desde: "16:00", hasta: "19:00" }]));
    case "restaurante": {
      // Comida y cena, con lunes cerrado (el día de descanso de casi todos) y
      // fin de semana completo. Los TURNOS de reserva se configuran aparte, en
      // `restaurante.ts`; esto es solo cuándo está abierta la casa.
      const servicio = dia([{ desde: "13:00", hasta: "16:30" }, { desde: "20:00", hasta: "23:59" }]);
      const soloComida = dia([{ desde: "13:00", hasta: "17:00" }]);
      return { 0: soloComida, 1: CERRADO, 2: servicio, 3: servicio, 4: servicio, 5: servicio, 6: servicio };
    }
  }
}

/** Reglas de reserva por sector: una gestoría no admite cancelar con 2h. */
function reglasPorSector(sector: SectorNegocio) {
  switch (sector) {
    case "salon":    return { slotStepMin: 15, leadTimeMin: 60,  cancelAntelacionMin: 120 };
    case "estetica": return { slotStepMin: 15, leadTimeMin: 120, cancelAntelacionMin: 240 };
    case "dental":   return { slotStepMin: 15, leadTimeMin: 60,  cancelAntelacionMin: 240 };
    case "gestoria": return { slotStepMin: 30, leadTimeMin: 240, cancelAntelacionMin: 1440 };
    // Se sienta a y cuarto, no a y siete. Y se acepta una mesa con media hora de
    // antelación: en restauración la reserva de última hora es normal.
    case "restaurante": return { slotStepMin: 15, leadTimeMin: 30, cancelAntelacionMin: 120 };
  }
}

function slugDe(nombre: string, email: string): string {
  const base = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || `negocio-${email.split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 20)}`;
}

export type ResultadoAlta = {
  tenantId: string;
  slug: string | null;
  tenantCreado: boolean;
  negocioCreado: boolean;
};

/**
 * Deja al usuario con tenant, ficha y negocio de reservas coherentes con su
 * sector. Si ya tenía, se actualiza sin perder lo suyo.
 */
export async function aplicarAltaDeSector(opts: {
  email: string;
  sector: SectorNegocio;
  /** En el alta viene entero. Al cambiar de sector desde Perfil, no viene. */
  perfil?: PerfilAlta;
  /** Servicios elegidos en el alta. Si no vienen, se usan los del sector. */
  servicios?: ServicioAlta[];
}): Promise<ResultadoAlta> {
  const { email, sector } = opts;
  const perfilSector = getPerfilSector(sector);

  // ---- 1. Tenant -----------------------------------------------------------
  const existente = await resolverTenantDeUsuario(email);
  // resolverTenantDeUsuario cae al tenant por defecto cuando no encuentra
  // ninguno: eso NO significa que este usuario sea el fundador.
  const suyo = await getTenant(existente);
  const esSuyo = !!suyo && (suyo.email || "").toLowerCase() === email.toLowerCase();

  const tenantId = esSuyo ? existente : `tenant_${slugDe(opts.perfil?.nombre || email, email)}`;
  const tenantCreado = !esSuyo;

  const base: Tenant = esSuyo
    ? suyo!
    : {
        id: tenantId,
        name: opts.perfil?.nombre || email,
        email,
        plan: "completo",
        pricing: { monthlyEUR: 0 },
        startedAt: new Date().toISOString(),
        minutesPerInteraction: 4,
        conversionValueEUR: 200,
      };

  const tenant: Tenant = {
    ...base,
    id: tenantId,
    email,
    sector,
    name: opts.perfil?.nombre || base.name,
    ficha: opts.perfil
      ? {
          ...base.ficha,
          nombreNegocio: opts.perfil.nombre,
          sector: opts.perfil.sector,
          ciudad: base.ficha?.ciudad || "",
          tono: opts.perfil.tono,
          serviciosClave: opts.perfil.ofrece.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean),
          publicoObjetivo: opts.perfil.publico,
        }
      : base.ficha,
  };
  await upsertTenant(tenant);

  // ---- 2. Negocio de reservas ---------------------------------------------
  // Nunca se toca el de otro tenant: se busca SOLO entre los suyos.
  const suyos = await getBusinessesForTenant(tenantId);
  const previo = suyos[0] ?? null;
  const negocioCreado = !previo;

  const nombreNegocio = opts.perfil?.nombre || previo?.nombre || tenant.name;
  let slug = previo?.slug ?? slugDe(nombreNegocio, email);
  if (!previo) {
    // Que no choque con un slug de otro cliente.
    let n = 1;
    while (await getBusinessBySlug(slug)) slug = `${slugDe(nombreNegocio, email)}-${++n}`;
  }

  // Servicios: los del alta; si no vienen y el negocio ya tenía, se respetan los
  // suyos; si no tenía ninguno, se siembran los del sector.
  const deAlta = (opts.servicios || []).filter((s) => s.nombre.trim());
  const conservaLosSuyos = !deAlta.length && !!previo?.servicios?.length;
  const catId = "cat_principal";

  const negocio: BusinessBooking = {
    ...(previo ?? {}),
    slug,
    tenantId,
    nombre: nombreNegocio,
    calendarEmail: previo?.calendarEmail || email,
    timezone: previo?.timezone || "Europe/Madrid",
    categorias: conservaLosSuyos && previo?.categorias?.length
      ? previo.categorias
      : [{ id: catId, nombre: perfilSector.alta.categoria }],
    servicios: conservaLosSuyos
      ? previo!.servicios
      : (deAlta.length ? deAlta : perfilSector.alta.servicios).map((sv, i) => ({
          id: `sv_${i + 1}_${Date.now().toString(36)}`,
          nombre: sv.nombre,
          categoriaId: catId,
          durationMin: sv.durationMin,
          ...(sv.precioEUR !== undefined ? { precioEUR: sv.precioEUR } : {}),
          activo: true,
        })),
    // El horario y las reglas solo se imponen si el negocio es nuevo: a un
    // cliente que ya tenía su horario no se le pisa por cambiar de sector.
    horario: previo?.horario ?? horarioPorSector(sector),
    ...(previo
      ? {
          slotStepMin: previo.slotStepMin,
          leadTimeMin: previo.leadTimeMin,
          cancelAntelacionMin: previo.cancelAntelacionMin,
        }
      : reglasPorSector(sector)),
  };
  await saveBusiness(negocio);

  return { tenantId, slug, tenantCreado, negocioCreado };
}
