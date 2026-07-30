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
import { saveBusiness, getBusinessBySlug, type BusinessBooking, type Horario, type DayHours } from "./booking";
import type { SectorNegocio } from "./sectores";

export type TenantDemo = { id: string; sector: SectorNegocio; nombre: string };

export const DEMOS: TenantDemo[] = [
  { id: "tenant_demo_salon", sector: "salon", nombre: "Salón Marina" },
  { id: "tenant_demo_estetica", sector: "estetica", nombre: "Clínica Bel Estética" },
  { id: "tenant_demo_dental", sector: "dental", nombre: "Clínica Dental Aurora" },
  { id: "tenant_demo_legal", sector: "legal", nombre: "Serrano & Asociados" },
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
  legal: {
    nombreNegocio: "Serrano & Asociados",
    sector: "Abogacía",
    ciudad: "Málaga",
    tono: "Formal y sobrio. Trato de usted salvo que el cliente tutee.",
    serviciosClave: ["Laboral", "Familia", "Penal", "Civil", "Mercantil"],
    promosActuales: [],
    publicoObjetivo: "Particulares y pequeñas empresas de la provincia.",
    notasEstilo: "Cero asesoramiento por escrito. Todo se ve en la primera consulta.",
  },
};


// =============================================================================
// Negocio de reservas por sector — servicios y horarios COHERENTES
// =============================================================================
// El fallo que hubo: los tenants de ejemplo no tenían negocio propio, así que el
// panel caía a los del fundador y el despacho de abogados enseñaba depilación y
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

  // --- ABOGADOS: primeras consultas de 45-60 min, por materia ---
  legal: {
    slug: "demo-serrano-asociados",
    categorias: [{ id: "cat_materias", nombre: "Materias" }],
    servicios: [
      // Sin precio: los honorarios se tratan en la primera consulta.
      { id: "sv_laboral", nombre: "Laboral · primera consulta", categoriaId: "cat_materias", durationMin: 45,
        descripcion: "Despidos, reclamaciones de cantidad, incapacidades." },
      { id: "sv_familia", nombre: "Familia · primera consulta", categoriaId: "cat_materias", durationMin: 60,
        descripcion: "Divorcios, custodia, pensiones." },
      { id: "sv_penal", nombre: "Penal · primera consulta", categoriaId: "cat_materias", durationMin: 60,
        descripcion: "Denuncias, citaciones, juicios rápidos." },
      { id: "sv_civil", nombre: "Civil · primera consulta", categoriaId: "cat_materias", durationMin: 45,
        descripcion: "Contratos, herencias, arrendamientos." },
      { id: "sv_mercantil", nombre: "Mercantil · primera consulta", categoriaId: "cat_materias", durationMin: 60,
        descripcion: "Sociedades, concursos, reclamaciones entre empresas." },
    ],
    // Horario de despacho: sin partir la tarde y sin sábados.
    horario: horario(L_V([{ desde: "09:00", hasta: "14:00" }, { desde: "16:00", hasta: "19:00" }])),
    slotStepMin: 30,
    leadTimeMin: 240,
    cancelAntelacionMin: 1440,
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
    empleados: previo?.empleados,
    logoUrl: previo?.logoUrl,
    heroImageUrl: previo?.heroImageUrl,
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
