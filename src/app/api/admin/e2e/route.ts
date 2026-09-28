// Banco de pruebas de punta a punta (Playwright, carpeta `e2e/`).
//
// SOLO EN LOCAL. En producción esta ruta responde 404 siempre: el doble candado
// de `esLocal()` (NODE_ENV no es production Y no hay VERCEL) no puede darse en
// Vercel. Además pide `x-e2e-token` = ADMIN_DEV_TOKEN cuando esa variable existe.
//
// Monta y desmonta UN tenant de pruebas (`tenant_e2e`) con su salón
// (`e2e-salon`, clon de la plantilla del salón de demostración) y todo lo que
// los recorridos necesitan: los identificadores de Meta y de Carmen, una regla
// de comentario→DM y un usuario de dueño para el login. Nunca toca los datos de
// otro tenant; al limpiar borra solo lo que lleva `tenant_e2e` / `e2e-salon`.
//
//   POST {accion:"preparar", password}  → deja el tenant limpio y listo
//   POST {accion:"cita", ...}           → mete una cita directamente (sin agentes)
//   POST {accion:"marca", marcaPanel?, agentesContratados?} → multi-marca
//   POST {accion:"limpiar"}              → lo borra todo
//   GET  ?que=citas                      → las citas del salón de pruebas

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { esLocal } from "@/lib/meta-graph-local";
import { getTenant, upsertTenant, type Tenant } from "@/lib/tenants";
import { getBusinessBySlug, saveBusiness, listRecords, saveRecord, type BookingRecord, type BusinessBooking } from "@/lib/booking";
import { upsertCredential } from "@/lib/credentials";
import { saveBusiness as guardarNegocioUsuario } from "@/lib/store";
import { saveCommentRule } from "@/lib/marta-comment-rules";
import { sembrarDemoConservando } from "@/lib/sectores-demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const E2E = {
  tenantId: "tenant_e2e",
  slug: "e2e-salon",
  email: "e2e-dueno@aiteam.invalid",
  usuario: "e2e_dueno",
  waPhoneId: "e2e-phone-id",
  igUserId: "e2e-ig-id",
  carmenNumero: "+34900000999",
} as const;

const DATA = path.join(process.cwd(), "data");

function prohibido(req: Request): NextResponse | null {
  if (!esLocal()) return new NextResponse("Not found", { status: 404 });
  const esperado = process.env.ADMIN_DEV_TOKEN;
  if (esperado && req.headers.get("x-e2e-token") !== esperado) {
    return NextResponse.json({ ok: false, error: "token" }, { status: 401 });
  }
  return null;
}

async function leer<T>(f: string): Promise<T | null> {
  try { return JSON.parse(await fs.readFile(path.join(DATA, f), "utf-8")) as T; } catch { return null; }
}
async function escribir(f: string, d: unknown): Promise<void> {
  await fs.writeFile(path.join(DATA, f), JSON.stringify(d, null, 2));
}

/** Borra de un mapa JSON las claves (o entradas) que mencionan el tenant/slug de pruebas. */
async function purgarMapa(f: string, cae: (k: string, v: unknown) => boolean): Promise<number> {
  const m = await leer<Record<string, unknown>>(f);
  if (!m || typeof m !== "object" || Array.isArray(m)) return 0;
  let n = 0;
  for (const [k, v] of Object.entries(m)) if (cae(k, v)) { delete m[k]; n++; }
  if (n) await escribir(f, m);
  return n;
}

const esDePrueba = (k: string, v: unknown) =>
  k.includes(E2E.tenantId) || k.includes(E2E.slug) ||
  (!!v && typeof v === "object" && ((v as { slug?: string }).slug === E2E.slug || (v as { tenantId?: string }).tenantId === E2E.tenantId));

async function limpiar(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  out.citas = await purgarMapa("booking-records.json", esDePrueba);
  out.espera = await purgarMapa("booking-espera.json", esDePrueba);
  out.conversaciones = await purgarMapa("conversations.json", (k) => k.includes(E2E.tenantId));
  out.eventos = await purgarMapa("events.json", (k) => k.includes(E2E.tenantId));
  out.reglas = await purgarMapa("marta-comment-rules.json", (k) => k.includes(E2E.tenantId));
  out.vistos = await purgarMapa("marta-comment-seen.json", (k) => k.includes(E2E.tenantId));
  out.bandeja = await purgarMapa("marta-dm.json", (k) => k.includes(E2E.tenantId));
  out.guion = await purgarMapa("pablo-guion.json", (k) => k.includes(E2E.tenantId));
  out.clientesMeta = await purgarMapa("booking-clientes-meta.json", (k) => k.startsWith(`${E2E.slug}|`));
  out.negocio = await purgarMapa("booking-configs.json", (k) => k === E2E.slug);
  out.tenant = await purgarMapa("tenants.json", (k) => k === E2E.tenantId);
  out.credenciales = await purgarMapa("credentials.json", (k) => k === E2E.usuario);
  out.usuarios = await purgarMapa("users.json", (k) => k === E2E.email);
  return out;
}

async function preparar(password: string): Promise<{ slug: string }> {
  await limpiar();
  // La plantilla del salón de demostración: servicios, horario y tres profesionales.
  let plantilla = await getBusinessBySlug("demo-salon-marina");
  if (!plantilla) {
    await sembrarDemoConservando("tenant_demo_salon");
    plantilla = await getBusinessBySlug("demo-salon-marina");
  }
  if (!plantilla) throw new Error("no existe la plantilla del salón de demostración");

  const previo = await getTenant(E2E.tenantId);
  const tenant: Tenant = {
    ...(previo ?? {}),
    id: E2E.tenantId,
    name: "Salón de Pruebas E2E",
    email: E2E.email,
    ownerName: "Dueña E2E",
    whatsappPhoneNumberId: E2E.waPhoneId,
    instagramUserId: E2E.igUserId,
    carmenPhoneNumber: E2E.carmenNumero,
    plan: "completo",
    pricing: { monthlyEUR: 0 },
    startedAt: new Date().toISOString(),
    minutesPerInteraction: 4,
    conversionValueEUR: 60,
    sector: "salon",
  } as Tenant;
  await upsertTenant(tenant);

  const negocio: BusinessBooking = {
    ...plantilla,
    slug: E2E.slug,
    tenantId: E2E.tenantId,
    nombre: "Salón de Pruebas E2E",
    // Un calendario que no existe: agenda interna, nunca el Google de nadie.
    calendarEmail: "e2e-salon@aiteam.invalid",
    empleados: (plantilla.empleados || []).map((e) => ({ ...e })),
  };
  await saveBusiness(negocio);

  await upsertCredential(E2E.usuario, password, E2E.email, "user");
  // Sin ficha de negocio en el usuario, el panel lo manda al onboarding.
  await guardarNegocioUsuario(E2E.email, { nombre: "Salón de Pruebas E2E", sector: "peluqueria" } as never);
  await saveCommentRule(E2E.tenantId, {
    keywords: ["INFO"],
    matchMode: "contiene",
    scope: "all",
    dmMessage: "Hola {usuario}, te paso la info de precios y huecos por aquí.",
    enabled: true,
    replyPublic: false,
  });
  return { slug: E2E.slug };
}

/** Mete una cita directamente en la agenda del salón de pruebas (para preparar escenarios). */
async function cita(b: { startIso: string; nombre: string; telefono?: string; empleadoId?: string; serviceId?: string; durationMin?: number }): Promise<BookingRecord> {
  const negocio = await getBusinessBySlug(E2E.slug);
  if (!negocio) throw new Error("sin negocio de pruebas");
  const sv = negocio.servicios.find((s) => s.id === (b.serviceId || "sv_corte"))!;
  const emp = (negocio.empleados || []).find((e) => e.id === b.empleadoId);
  const r: BookingRecord = {
    id: `bk_e2e_${crypto.randomBytes(5).toString("hex")}`,
    token: crypto.randomBytes(16).toString("hex"),
    slug: E2E.slug,
    tenantId: E2E.tenantId,
    serviceId: sv.id,
    servicioNombre: sv.nombre,
    durationMin: b.durationMin ?? sv.durationMin,
    startIso: b.startIso.length === 16 ? `${b.startIso}:00` : b.startIso,
    cliente: { nombre: b.nombre, telefono: b.telefono || "" },
    empleadoId: emp?.id,
    empleadoNombre: emp?.nombre,
    eventId: `int_e2e_${Date.now()}`,
    estado: "confirmada",
    origen: "manual",
    tipo: "cita",
    creadaEn: new Date().toISOString(),
  } as BookingRecord;
  await saveRecord(r);
  return r;
}

export async function GET(req: Request) {
  const no = prohibido(req);
  if (no) return no;
  const citas = (await listRecords()).filter((r) => r.slug === E2E.slug);
  return NextResponse.json({ ok: true, citas });
}

export async function POST(req: Request) {
  const no = prohibido(req);
  if (no) return no;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    switch (body.accion) {
      case "preparar":
        return NextResponse.json({ ok: true, ...(await preparar(String(body.password || crypto.randomBytes(8).toString("hex")))) });
      case "cita":
        return NextResponse.json({ ok: true, cita: await cita(body as never) });
      case "marca": {
        const t = await getTenant(E2E.tenantId);
        if (!t) return NextResponse.json({ ok: false, error: "sin tenant" }, { status: 404 });
        await upsertTenant({ ...t, ...(body.marcaPanel !== undefined ? { marcaPanel: body.marcaPanel } : {}), ...(body.agentesContratados !== undefined ? { agentesContratados: body.agentesContratados } : {}) } as Tenant);
        return NextResponse.json({ ok: true });
      }
      case "limpiar":
        return NextResponse.json({ ok: true, borrado: await limpiar() });
      default:
        return NextResponse.json({ ok: false, error: "accion desconocida" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
