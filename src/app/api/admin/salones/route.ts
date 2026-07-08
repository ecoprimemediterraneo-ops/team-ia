// GET  /api/admin/salones — lista de salones (founder-only).
// POST /api/admin/salones — crea un salón desde el borrador revisado del alta.
//   Geocodifica la dirección (Nominatim) igual que el panel de config y persiste
//   con saveBusiness. Slug único derivado del nombre.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFounder } from "@/lib/admin-auth";
import { listBusinesses, saveBusiness, getBusinessBySlug, type BusinessBooking } from "@/lib/booking";
import { geocodeDireccion } from "@/lib/geocode";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const franja = z.object({ desde: z.string().regex(/^\d{2}:\d{2}$/), hasta: z.string().regex(/^\d{2}:\d{2}$/) });
const dayHours = z.object({ abierto: z.boolean(), franjas: z.array(franja).max(4) });
const variante = z.object({ id: z.string().min(1).max(40), nombre: z.string().min(1).max(80), durationMin: z.number().int().min(5).max(480), precioEUR: z.number().min(0).max(100000) });
const addon = z.object({ id: z.string().min(1).max(40), nombre: z.string().min(1).max(80), durationMin: z.number().int().min(0).max(240), precioEUR: z.number().min(0).max(100000), activo: z.boolean() });
const servicio = z.object({
  id: z.string().min(1).max(40),
  nombre: z.string().min(1).max(80),
  descripcion: z.string().max(400).optional(),
  categoriaId: z.string().max(40).optional(),
  durationMin: z.number().int().min(5).max(480),
  precioEUR: z.number().min(0).max(100000).optional(),
  paddingBeforeMin: z.number().int().min(0).max(120).optional(),
  paddingAfterMin: z.number().int().min(0).max(120).optional(),
  variantes: z.array(variante).max(12).optional(),
  addons: z.array(addon).max(12).optional(),
  activo: z.boolean(),
});

const schema = z.object({
  nombre: z.string().min(1).max(120),
  descripcion: z.string().max(600).optional(),
  direccion: z.string().max(200).optional(),
  telefono: z.string().max(40).optional(),
  instagram: z.string().max(60).optional(),
  calendarEmail: z.string().email().max(200).optional(),
  timezone: z.string().max(60).optional(),
  categorias: z.array(z.object({ id: z.string().min(1).max(40), nombre: z.string().min(1).max(60) })).max(30),
  servicios: z.array(servicio).max(100),
  horario: z.record(z.string(), dayHours),
});

function slugify(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "salon";
}

async function slugUnico(base: string): Promise<string> {
  if (!(await getBusinessBySlug(base))) return base;
  for (let i = 2; i < 100; i++) {
    const cand = `${base}-${i}`.slice(0, 44);
    if (!(await getBusinessBySlug(cand))) return cand;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function GET() {
  const a = await requireFounder();
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  const negocios = (await listBusinesses()).map((b) => ({
    slug: b.slug,
    nombre: b.nombre,
    direccion: b.direccion,
    telefono: b.telefono,
    instagram: b.instagram,
    nServicios: b.servicios.length,
    nCategorias: b.categorias.length,
    calendarEmail: b.calendarEmail,
  }));
  return NextResponse.json({ ok: true, negocios });
}

export async function POST(req: Request) {
  const a = await requireFounder();
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  const slug = await slugUnico(slugify(d.nombre));
  const horario = Object.fromEntries(Object.entries(d.horario).map(([k, v]) => [Number(k), v])) as BusinessBooking["horario"];

  const business: BusinessBooking = {
    slug,
    tenantId: DEFAULT_TENANT_ID,
    nombre: d.nombre,
    descripcion: d.descripcion || undefined,
    galeria: [],
    direccion: d.direccion || undefined,
    telefono: d.telefono || undefined,
    instagram: d.instagram || undefined,
    calendarEmail: d.calendarEmail || a.email,
    timezone: d.timezone || "Europe/Madrid",
    slotStepMin: 15,
    leadTimeMin: 60,
    cancelAntelacionMin: 120,
    categorias: d.categorias,
    servicios: d.servicios,
    empleados: [],
    horario,
  };

  const dir = (business.direccion || "").trim();
  if (dir) {
    const geo = await geocodeDireccion(dir);
    if (geo) { business.lat = geo.lat; business.lng = geo.lng; }
  }

  const saved = await saveBusiness(business);
  return NextResponse.json({ ok: true, slug: saved.slug, business: saved });
}
