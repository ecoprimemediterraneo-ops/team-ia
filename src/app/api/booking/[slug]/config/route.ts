// GET/POST /api/booking/[slug]/config — panel del dueño (auth-gated).
// GET  → config completa del negocio (si el usuario logueado es su dueño).
// POST → actualiza marca, categorías, servicios (con variantes/add-ons/padding),
//        horario, galería y ajustes.
import { NextResponse } from "next/server";
import { z } from "zod";
import { saveBusiness, type BusinessBooking } from "@/lib/booking";
import { authorizeOwner } from "@/lib/booking-owner";
import { geocodeDireccion } from "@/lib/geocode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorizeOwner(slug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  return NextResponse.json({ ok: true, business: a.business });
}

const franja = z.object({ desde: z.string().regex(/^\d{2}:\d{2}$/), hasta: z.string().regex(/^\d{2}:\d{2}$/) });
const dayHours = z.object({ abierto: z.boolean(), franjas: z.array(franja).max(4) });
const variante = z.object({ id: z.string().min(1).max(40), nombre: z.string().min(1).max(80), durationMin: z.number().int().min(5).max(480), precioEUR: z.number().min(0).max(100000) });
const addon = z.object({ id: z.string().min(1).max(40), nombre: z.string().min(1).max(80), durationMin: z.number().int().min(0).max(240), precioEUR: z.number().min(0).max(100000), activo: z.boolean() });
const servicio = z.object({
  id: z.string().min(1).max(40),
  nombre: z.string().min(1).max(80),
  descripcion: z.string().max(400).optional(),
  fotoUrl: z.string().url().max(500).optional().or(z.literal("")).transform((v) => v || undefined),
  categoriaId: z.string().max(40).optional(),
  durationMin: z.number().int().min(5).max(480),
  precioEUR: z.number().min(0).max(100000).optional(),
  paddingBeforeMin: z.number().int().min(0).max(120).optional(),
  paddingAfterMin: z.number().int().min(0).max(120).optional(),
  variantes: z.array(variante).max(12).optional(),
  addons: z.array(addon).max(12).optional(),
  activo: z.boolean(),
});

const empleado = z.object({
  id: z.string().min(1).max(40),
  nombre: z.string().min(1).max(80),
  color: z.string().max(20).optional(),
  activo: z.boolean(),
  horario: z.record(z.string(), dayHours).optional(),
  serviceIds: z.array(z.string().max(40)).max(80).optional(),
});

const schema = z.object({
  nombre: z.string().min(1).max(120).optional(),
  descripcion: z.string().max(600).optional(),
  // "" = quitar la imagen; ausente = no tocar; URL = poner. (No usamos transform a
  // undefined para poder distinguir "vaciar" de "no enviado".)
  logoUrl: z.string().url().max(600).optional().or(z.literal("")),
  heroImageUrl: z.string().url().max(600).optional().or(z.literal("")),
  galeria: z.array(z.string().url().max(500)).max(12).optional(),
  direccion: z.string().max(200).optional(),
  telefono: z.string().max(40).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  slotStepMin: z.number().int().min(5).max(60).optional(),
  leadTimeMin: z.number().int().min(0).max(1440).optional(),
  cancelAntelacionMin: z.number().int().min(0).max(10080).optional(),
  categorias: z.array(z.object({ id: z.string().min(1).max(40), nombre: z.string().min(1).max(60) })).max(30).optional(),
  servicios: z.array(servicio).max(60).optional(),
  empleados: z.array(empleado).max(50).optional(),
  horario: z.record(z.string(), dayHours).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorizeOwner(slug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const cur = a.business;
  const horario = parsed.data.horario
    ? (Object.fromEntries(Object.entries(parsed.data.horario).map(([k, v]) => [Number(k), v])) as BusinessBooking["horario"])
    : cur.horario;

  const updated: BusinessBooking = {
    ...cur,
    nombre: parsed.data.nombre ?? cur.nombre,
    descripcion: parsed.data.descripcion ?? cur.descripcion,
    // "" → quitar (undefined); URL → poner; ausente → conservar la actual.
    logoUrl: parsed.data.logoUrl !== undefined ? (parsed.data.logoUrl || undefined) : cur.logoUrl,
    heroImageUrl: parsed.data.heroImageUrl !== undefined ? (parsed.data.heroImageUrl || undefined) : cur.heroImageUrl,
    galeria: parsed.data.galeria ?? cur.galeria,
    direccion: parsed.data.direccion ?? cur.direccion,
    lat: parsed.data.lat ?? cur.lat,
    lng: parsed.data.lng ?? cur.lng,
    telefono: parsed.data.telefono ?? cur.telefono,
    slotStepMin: parsed.data.slotStepMin ?? cur.slotStepMin,
    leadTimeMin: parsed.data.leadTimeMin ?? cur.leadTimeMin,
    cancelAntelacionMin: parsed.data.cancelAntelacionMin ?? cur.cancelAntelacionMin,
    categorias: parsed.data.categorias ?? cur.categorias,
    servicios: parsed.data.servicios ?? cur.servicios,
    empleados: (parsed.data.empleados ?? cur.empleados) as BusinessBooking["empleados"],
    horario,
  };

  // Mapa: si la dirección cambió (y no llegan coords explícitas), geocodifica en
  // segundo plano con Nominatim (OSM, sin API key). Best-effort: si falla, se
  // guarda sin coords y la web muestra solo la dirección enlazada.
  const dir = (updated.direccion || "").trim();
  if (!dir) {
    updated.lat = undefined;
    updated.lng = undefined;
  } else if (parsed.data.lat == null && dir !== (cur.direccion || "").trim()) {
    const geo = await geocodeDireccion(dir);
    if (geo) { updated.lat = geo.lat; updated.lng = geo.lng; }
  }

  const saved = await saveBusiness(updated);
  return NextResponse.json({ ok: true, business: saved });
}
