// Cuatro tenants de ejemplo, uno por sector, para poder VER y COMPARAR.
//
// No son datos de adorno metidos en el panel: son tenants de verdad, con su
// ficha, que se crean cuando alguien los pide desde /admin/sectores. Sirven para
// revisar cómo queda cada panel y cómo suena cada IA antes de dar de alta a un
// cliente real.
//
// Llevan el prefijo `tenant_demo_` a propósito, para distinguirlos de un cliente.

import "server-only";
import { upsertTenant, getTenant, type Tenant } from "./tenants";
import { saveBusiness, getBusinessBySlug, type BusinessBooking, type Horario, type DayHours, type Empleado } from "./booking";
import type { SectorNegocio } from "./sectores";
import { DURACION_MESA_MIN, CORTESIA_MIN, TURNOS_POR_DEFECTO } from "./restaurante";

export type TenantDemo = { id: string; sector: SectorNegocio; nombre: string };

export const DEMOS: TenantDemo[] = [
  { id: "tenant_demo_salon", sector: "salon", nombre: "Salón Marina" },
  { id: "tenant_demo_estetica", sector: "estetica", nombre: "Clínica Bel Estética" },
  { id: "tenant_demo_dental", sector: "dental", nombre: "Clínica Dental Aurora" },
  { id: "tenant_demo_gestoria", sector: "gestoria", nombre: "Gestoría Márquez" },
  { id: "tenant_demo_restaurante", sector: "restaurante", nombre: "Casa Gutiérrez" },
];

function base(d: TenantDemo): Tenant {
  return {
    id: d.id,
    name: `${d.nombre} (demo ${d.sector})`,
    email: `demo-${d.sector}@aiteam.local`,
    plan: "completo",
    pricing: { monthlyEUR: 0 },
    startedAt: new Date().toISOString(),
    minutesPerInteraction: 4,
    conversionValueEUR: 200,
    sector: d.sector,
  };
}

const FICHAS: Record<SectorNegocio, Tenant["ficha"]> = {
  salon: {
    nombreNegocio: "Salón Marina",
    sector: "Peluquería y estética",
    ciudad: "Málaga",
    tono: "Cercano, rápido y de confianza. Tuteo de toda la vida.",
    serviciosClave: ["Corte y peinado", "Color y mechas", "Manicura y pedicura", "Tratamiento de keratina"],
    promosActuales: ["Bono de 5 manicuras con un 15% de descuento"],
    publicoObjetivo: "Mujeres de 25 a 60 años del barrio, muchas clientas fijas.",
    notasEstilo: "Nunca dejes una cancelación sin intentar reprogramar.",
  },
  estetica: {
    nombreNegocio: "Clínica Bel Estética",
    sector: "Medicina estética",
    ciudad: "Marbella",
    tono: "Discreto, cuidado y sin prisa. Nada comercial.",
    serviciosClave: ["Ácido hialurónico", "Toxina botulínica", "Láser facial", "Peeling médico"],
    promosActuales: [],
    publicoObjetivo: "Personas de 30 a 60 años que se informan bien antes de decidir.",
    notasEstilo: "El precio SIEMPRE sale de la valoración médica. No lo adelantes nunca.",
  },
  dental: {
    nombreNegocio: "Clínica Dental Aurora",
    sector: "Odontología",
    ciudad: "Fuengirola",
    tono: "Amable y tranquilizador. Mucha gente escribe con miedo.",
    serviciosClave: ["Revisión y limpieza", "Implantes", "Ortodoncia invisible", "Urgencias"],
    promosActuales: ["Primera revisión sin coste"],
    publicoObjetivo: "Familias del barrio y pacientes que vienen por implantes u ortodoncia.",
    notasEstilo: "Si alguien escribe con dolor, eso va por delante de todo lo demás.",
  },
  gestoria: {
    nombreNegocio: "Gestoría Márquez",
    sector: "Gestoría fiscal y laboral",
    ciudad: "Málaga",
    tono: "Claro y práctico, sin jerga fiscal. Se explica como en el mostrador.",
    serviciosClave: ["Renta", "Nóminas y seguros sociales", "Autónomos", "Impuestos trimestrales", "Sociedades"],
    promosActuales: [],
    publicoObjetivo: "Autónomos y pequeñas empresas de la provincia, muchos de años.",
    notasEstilo: "Las tarifas de los trámites SÍ se dicen. Lo que no se hace es asesorar sobre el fondo del asunto.",
  },
  restaurante: {
    nombreNegocio: "Casa Gutiérrez",
    sector: "Restaurante de cocina de mercado",
    ciudad: "Málaga",
    tono: "Cercano y rápido, como quien coge el teléfono en plena hora punta. Tuteo.",
    serviciosClave: ["Cocina de mercado", "Arroces", "Pescado del día", "Terraza"],
    promosActuales: [],
    publicoObjetivo: "Parejas y familias del barrio entre semana; mesas grandes el fin de semana.",
    notasEstilo: "Pide siempre nombre, personas, hora y si prefiere terraza o interior. La reserva queda pendiente de validar.",
  },
};


// =============================================================================
// Negocio de reservas por sector — servicios y horarios COHERENTES
// =============================================================================
// El fallo que hubo: los tenants de ejemplo no tenían negocio propio, así que el
// panel caía a los del fundador y la gestoría enseñaba depilación y
// uñas. Cada demo tiene ahora SU negocio, con sus servicios y su horario.

const L_V = (franjas: { desde: string; hasta: string }[]): DayHours => ({ abierto: true, franjas });
const CERRADO: DayHours = { abierto: false, franjas: [] };

/** Horario semanal a partir de los días laborables y, opcionalmente, el sábado. */
function horario(laborable: DayHours, sabado: DayHours = CERRADO): Horario {
  return { 0: CERRADO, 1: laborable, 2: laborable, 3: laborable, 4: laborable, 5: laborable, 6: sabado };
}

type PlantillaNegocio = {
  slug: string;
  categorias: { id: string; nombre: string }[];
  servicios: { id: string; nombre: string; categoriaId: string; durationMin: number; precioEUR?: number; descripcion?: string }[];
  horario: Horario;
  slotStepMin: number;
  leadTimeMin: number;
  cancelAntelacionMin: number;
  /** Profesionales del negocio (solo los sectores con personal: el salón). */
  empleados?: Empleado[];
};

const NEGOCIOS: Record<SectorNegocio, PlantillaNegocio> = {
  // --- SALÓN: citas cortas, muchas al día, sábado por la mañana ---
  salon: {
    slug: "demo-salon-marina",
    categorias: [
      { id: "cat_pelo", nombre: "Peluquería" },
      { id: "cat_unas", nombre: "Uñas" },
    ],
    servicios: [
      { id: "sv_corte", nombre: "Corte y peinado", categoriaId: "cat_pelo", durationMin: 45, precioEUR: 25 },
      // «Corte» a secas, distinto de «Corte y peinado»: la dueña pide «corte» y no
      // puede guardarse como el otro (cambia duración y precio).
      { id: "sv_corte_solo", nombre: "Corte", categoriaId: "cat_pelo", durationMin: 30, precioEUR: 18 },
      { id: "sv_color", nombre: "Color", categoriaId: "cat_pelo", durationMin: 90, precioEUR: 55 },
      { id: "sv_mechas", nombre: "Mechas", categoriaId: "cat_pelo", durationMin: 120, precioEUR: 75 },
      { id: "sv_manicura", nombre: "Manicura", categoriaId: "cat_unas", durationMin: 45, precioEUR: 20 },
      { id: "sv_pedicura", nombre: "Pedicura", categoriaId: "cat_unas", durationMin: 50, precioEUR: 25 },
    ],
    horario: horario(L_V([{ desde: "09:30", hasta: "14:00" }, { desde: "16:00", hasta: "20:00" }]),
                     L_V([{ desde: "09:30", hasta: "14:00" }])),
    slotStepMin: 15,
    leadTimeMin: 60,
    cancelAntelacionMin: 120,
    // Tres profesionales trabajando a la vez: es lo que distingue al salón de las
    // clínicas, y lo que enseña la agenda por columnas.
    empleados: [
      { id: "emp_ana", nombre: "Ana", color: "#C8202A", activo: true, serviceIds: ["sv_corte", "sv_corte_solo", "sv_color", "sv_mechas"] },
      { id: "emp_berta", nombre: "Berta", color: "#2F6FDE", activo: true, serviceIds: ["sv_manicura", "sv_pedicura"] },
      { id: "emp_carla", nombre: "Carla", color: "#2E9E5B", activo: true, serviceIds: ["sv_corte", "sv_corte_solo", "sv_manicura"] },
    ],
  },

  // --- ESTÉTICA: la valoración es la puerta de entrada, sin precio cerrado ---
  estetica: {
    slug: "demo-bel-estetica",
    categorias: [
      { id: "cat_val", nombre: "Valoración" },
      { id: "cat_trat", nombre: "Tratamientos" },
    ],
    servicios: [
      // Sin precio: en este sector el importe sale de la valoración médica.
      { id: "sv_valoracion", nombre: "Valoración médica", categoriaId: "cat_val", durationMin: 30,
        descripcion: "Primera visita con el médico. El plan y el precio salen de aquí." },
      { id: "sv_hialuronico", nombre: "Ácido hialurónico", categoriaId: "cat_trat", durationMin: 45 },
      { id: "sv_botox", nombre: "Toxina botulínica", categoriaId: "cat_trat", durationMin: 30 },
      { id: "sv_laser", nombre: "Láser facial", categoriaId: "cat_trat", durationMin: 60 },
      { id: "sv_peeling", nombre: "Peeling médico", categoriaId: "cat_trat", durationMin: 45 },
    ],
    horario: horario(L_V([{ desde: "10:00", hasta: "14:00" }, { desde: "16:00", hasta: "20:00" }])),
    slotStepMin: 15,
    leadTimeMin: 120,
    cancelAntelacionMin: 240,
  },

  // --- DENTAL: revisión corta, tratamientos largos, urgencias ---
  dental: {
    slug: "demo-dental-aurora",
    categorias: [
      { id: "cat_prev", nombre: "Prevención" },
      { id: "cat_trat", nombre: "Tratamientos" },
      { id: "cat_urg", nombre: "Urgencias" },
    ],
    servicios: [
      { id: "sv_revision", nombre: "Revisión", categoriaId: "cat_prev", durationMin: 30, precioEUR: 0,
        descripcion: "Primera revisión sin coste." },
      { id: "sv_limpieza", nombre: "Limpieza dental", categoriaId: "cat_prev", durationMin: 45, precioEUR: 60 },
      { id: "sv_orto", nombre: "Ortodoncia · consulta", categoriaId: "cat_trat", durationMin: 45 },
      { id: "sv_implante", nombre: "Implante · estudio", categoriaId: "cat_trat", durationMin: 60 },
      { id: "sv_urgencia", nombre: "Urgencia con dolor", categoriaId: "cat_urg", durationMin: 30,
        descripcion: "Hueco reservado cada día para dolor." },
    ],
    horario: horario(L_V([{ desde: "09:00", hasta: "14:00" }, { desde: "15:30", hasta: "20:00" }])),
    slotStepMin: 15,
    leadTimeMin: 60,
    cancelAntelacionMin: 240,
  },

  // --- GESTORÍA: cinco trámites CON TARIFA ---
  // Al revés que el perfil de abogados que sustituye: una gestoría tiene los
  // precios cerrados y esconderlos solo genera una llamada más.
  gestoria: {
    slug: "demo-gestoria-marquez",
    categorias: [{ id: "cat_tramites", nombre: "Trámites" }],
    servicios: [
      { id: "sv_renta", nombre: "Declaración de la renta", categoriaId: "cat_tramites", durationMin: 45, precioEUR: 60,
        descripcion: "Preparación y presentación de la declaración anual." },
      { id: "sv_nominas", nombre: "Nóminas y seguros sociales", categoriaId: "cat_tramites", durationMin: 30, precioEUR: 45,
        descripcion: "Nóminas del mes y cotizaciones. Precio por trabajador." },
      { id: "sv_autonomos", nombre: "Alta o baja de autónomo", categoriaId: "cat_tramites", durationMin: 30, precioEUR: 50,
        descripcion: "Alta, baja o cambio de base en el RETA." },
      { id: "sv_trimestrales", nombre: "Impuestos trimestrales", categoriaId: "cat_tramites", durationMin: 30, precioEUR: 75,
        descripcion: "Modelos 303, 130 y 111 del trimestre." },
      { id: "sv_sociedades", nombre: "Constitución de sociedad", categoriaId: "cat_tramites", durationMin: 60, precioEUR: 350,
        descripcion: "Constitución completa: notaría, registro y alta censal." },
    ],
    // Horario de oficina: mañana y tarde, sin sábados.
    horario: horario(L_V([{ desde: "09:00", hasta: "14:00" }, { desde: "16:00", hasta: "19:00" }])),
    slotStepMin: 30,
    leadTimeMin: 240,
    cancelAntelacionMin: 1440,
  },

  // --- RESTAURANTE: lo que se reserva es una MESA dentro de un turno ---
  // Los "servicios" son los turnos y todos duran lo que dura la mesa. La
  // configuración de verdad (turnos por día, cortesía, zonas, modo de trabajo)
  // vive en `business.restaurante` y la rellena `sembrarNegocio`.
  restaurante: {
    slug: "demo-casa-gutierrez",
    categorias: [{ id: "cat_turnos", nombre: "Turnos" }],
    servicios: [
      { id: "sv_comida_1", nombre: "Comida · primer turno", categoriaId: "cat_turnos", durationMin: 120,
        descripcion: "Se sienta a partir de las 13:00." },
      { id: "sv_comida_2", nombre: "Comida · segundo turno", categoriaId: "cat_turnos", durationMin: 120,
        descripcion: "Fines de semana, a partir de las 15:00." },
      { id: "sv_cena_1", nombre: "Cena · primer turno", categoriaId: "cat_turnos", durationMin: 120,
        descripcion: "Se sienta a partir de las 20:30." },
      { id: "sv_cena_2", nombre: "Cena · segundo turno", categoriaId: "cat_turnos", durationMin: 120,
        descripcion: "Jueves a sábado, a partir de las 22:30." },
    ],
    // Lunes cerrado y domingo solo comida: el descanso típico de la casa.
    horario: {
      0: L_V([{ desde: "13:00", hasta: "17:00" }]),
      1: CERRADO,
      2: L_V([{ desde: "13:00", hasta: "16:30" }, { desde: "20:00", hasta: "23:59" }]),
      3: L_V([{ desde: "13:00", hasta: "16:30" }, { desde: "20:00", hasta: "23:59" }]),
      4: L_V([{ desde: "13:00", hasta: "16:30" }, { desde: "20:00", hasta: "23:59" }]),
      5: L_V([{ desde: "13:00", hasta: "16:30" }, { desde: "20:00", hasta: "23:59" }]),
      6: L_V([{ desde: "13:00", hasta: "16:30" }, { desde: "20:00", hasta: "23:59" }]),
    },
    slotStepMin: 15,
    leadTimeMin: 30,
    cancelAntelacionMin: 120,
  },
};

/** Crea (o repone) el negocio de reservas de un tenant de ejemplo. */
async function sembrarNegocio(d: TenantDemo): Promise<string> {
  const plantilla = NEGOCIOS[d.sector];
  const previo = await getBusinessBySlug(plantilla.slug);
  const negocio: BusinessBooking = {
    slug: plantilla.slug,
    tenantId: d.id,
    nombre: d.nombre,
    // El calendario del demo apunta al mismo correo del tenant: así NUNCA se
    // resuelve al del fundador ni se cruza con otro negocio.
    calendarEmail: `demo-${d.sector}@aiteam.local`,
    timezone: "Europe/Madrid",
    categorias: plantilla.categorias,
    servicios: plantilla.servicios.map((sv) => ({ ...sv, activo: true })),
    horario: plantilla.horario,
    slotStepMin: plantilla.slotStepMin,
    leadTimeMin: plantilla.leadTimeMin,
    cancelAntelacionMin: plantilla.cancelAntelacionMin,
    // Se conservan empleados y fotos si ya existían (por si alguien los tocó).
    // A los que ya estaban se les SUMAN los servicios nuevos de la plantilla
    // (p. ej. «Corte» el 01/10/2026): si no, la demo ya sembrada tendría el
    // servicio en el catálogo y nadie que lo hiciera.
    empleados: previo?.empleados
      ? previo.empleados.map((e) => {
          const p = plantilla.empleados?.find((x) => x.id === e.id);
          return p ? { ...e, serviceIds: [...new Set([...(e.serviceIds || []), ...(p.serviceIds || [])])] } : e;
        })
      : plantilla.empleados,
    logoUrl: previo?.logoUrl,
    heroImageUrl: previo?.heroImageUrl,
    // Config de restauración solo donde aplica. Si ya la habían tocado a mano,
    // se respeta: sembrar el demo no debe deshacer una configuración real.
    restaurante: d.sector === "restaurante"
      ? previo?.restaurante ?? {
          modo: "captacion",
          duracionMesaMin: DURACION_MESA_MIN,
          cortesiaMin: CORTESIA_MIN,
          turnos: TURNOS_POR_DEFECTO,
          confirmacionAutomatica: false,
          zonas: { terraza: true, interior: true },
        }
      : previo?.restaurante,
  };
  await saveBusiness(negocio);
  return plantilla.slug;
}

/** Crea (o repone) los cuatro tenants de ejemplo. Idempotente. */
export async function sembrarDemos(): Promise<{ id: string; sector: SectorNegocio; creado: boolean; slug: string }[]> {
  const out: { id: string; sector: SectorNegocio; creado: boolean; slug: string }[] = [];
  for (const d of DEMOS) {
    const existia = !!(await getTenant(d.id));
    await upsertTenant({ ...base(d), ficha: FICHAS[d.sector] });
    const slug = await sembrarNegocio(d);
    out.push({ id: d.id, sector: d.sector, creado: !existia, slug });
  }
  return out;
}

/**
 * Deja UNA demo en pie SIN pisar lo que ya tenga. `sembrarDemos()` reescribe el
 * tenant entero con `upsertTenant({...base, ficha})`, y eso borraría un
 * `ownerWhatsapp` o un `whatsappPhoneNumberId` que se hubiera puesto después.
 * Aquí, si el tenant ya existe, se conserva tal cual y solo se rellena lo que le
 * falte (sector y ficha). Idempotente.
 */
export async function sembrarDemoConservando(id: string): Promise<{ id: string; creado: boolean; slug: string } | null> {
  const d = DEMOS.find((x) => x.id === id);
  if (!d) return null;
  const previo = await getTenant(d.id);
  if (!previo) {
    await upsertTenant({ ...base(d), ficha: FICHAS[d.sector] });
  } else if (!previo.sector || !previo.ficha) {
    await upsertTenant({ ...previo, sector: previo.sector ?? d.sector, ficha: previo.ficha ?? FICHAS[d.sector] });
  }
  const slug = await sembrarNegocio(d);
  return { id: d.id, creado: !previo, slug };
}
