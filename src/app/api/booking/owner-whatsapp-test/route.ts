// Ruta de PRUEBA del aviso al dueño por WhatsApp (plantilla utility aviso_dueno_cita).
// Muestra el mapeo EXACTO de variables y, si pasas ?to=<numero>, envía la plantilla
// real a ese número — para verificar ANTES de activar OWNER_WHATSAPP_ENABLED.
//
//   GET /api/booking/owner-whatsapp-test               → dry-run (params + estado, sin enviar)
//   GET /api/booking/owner-whatsapp-test?to=34XXXXXXXXX[&tipo=nueva|cancelada][&slug=...][&secret=...]
//
// Se salta el flag OWNER_WHATSAPP_ENABLED a propósito (va gateado por auth y por el
// número explícito), como la ruta de prueba de email.
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getBusinessBySlug, listBusinesses, type BookingRecord } from "@/lib/booking";
import {
  construirParamsAvisoDueno,
  resolveOwnerPhone,
  ownerWhatsAppEnabled,
  OWNER_TEMPLATE_NAME,
  OWNER_TEMPLATE_LANG,
} from "@/lib/booking-owner-whatsapp";
import { sendWhatsAppTemplate } from "@/lib/whatsapp-sender";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Autoriza si: (1) hay sesión de FUNDADOR, o (2) llega el secreto correcto.
async function authorized(req: Request, h: Headers): Promise<boolean> {
  try {
    const s = await getSession();
    const founder = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
    if (s && (s.email === founder || s.email === "crisasky@gmail.com")) return true;
  } catch {
    /* sin sesión válida → probamos secreto */
  }
  const expected = process.env.OWNER_NOTIFY_TEST_SECRET || process.env.CRON_SECRET || "";
  if (!expected) return process.env.NODE_ENV !== "production"; // dev/local sin secreto: permitido
  const url = new URL(req.url);
  return (url.searchParams.get("secret") || "") === expected || (h.get("x-cron-secret") || "") === expected;
}

async function run(req: Request) {
  const h = await headers();
  if (!(await authorized(req, h))) {
    return NextResponse.json({ ok: false, error: "unauthorized", nota: "Entra en aiteam.marketing (login cris) y abre esta URL sin secreto." }, { status: 401 });
  }

  const url = new URL(req.url);
  const to = (url.searchParams.get("to") || "").replace(/[^\d]/g, "");
  const tipo: "nueva" | "cancelada" = url.searchParams.get("tipo") === "cancelada" ? "cancelada" : "nueva";
  const slug = url.searchParams.get("slug") || "";

  const business = slug ? await getBusinessBySlug(slug) : (await listBusinesses())[0];
  if (!business) return NextResponse.json({ ok: false, error: "No hay ningún negocio configurado" }, { status: 400 });

  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const record: BookingRecord = {
    id: "test_" + tipo,
    token: "test",
    slug: business.slug,
    tenantId: business.tenantId,
    serviceId: "",
    servicioNombre: "Manicura semipermanente",
    durationMin: 45,
    startIso: `${manana.toISOString().slice(0, 10)}T10:00:00`,
    cliente: { nombre: "María García", telefono: "34600111222" },
    estado: tipo === "cancelada" ? "cancelada" : "confirmada",
    tipo: "cita",
    creadaEn: new Date().toISOString(),
  };

  const params = construirParamsAvisoDueno(record);
  const numeroDuenoConfig = await resolveOwnerPhone(business).catch(() => undefined);
  const credenciales = !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);

  const info = {
    plantilla: OWNER_TEMPLATE_NAME,
    idioma: OWNER_TEMPLATE_LANG,
    variables: { "{{1}} cliente": params[0], "{{2}} servicio": params[1], "{{3}} cuándo": params[2] },
    salon: business.nombre,
    tipo,
    // El WhatsApp real solo se envía en citas nuevas (la plantilla dice "Nueva cita").
    envio_real_solo_en: "nueva",
    aplica_a_esta_prueba: tipo === "nueva",
    numero_dueno_en_config: numeroDuenoConfig || "(ninguno — configura OWNER_WHATSAPP_TO o tenant.ownerWhatsapp)",
    entorno: { OWNER_WHATSAPP_ENABLED: ownerWhatsAppEnabled(), credencialesWhatsApp: credenciales },
  };

  // Sin ?to= → dry-run: solo enseña el mapeo y el estado, no envía.
  if (!to) {
    return NextResponse.json({ ok: true, modo: "dry_run", ...info, comoEnviar: "Añade ?to=34XXXXXXXXX para enviar la plantilla real a ese número." });
  }

  const resultado = await sendWhatsAppTemplate(to, OWNER_TEMPLATE_NAME, OWNER_TEMPLATE_LANG, params);
  return NextResponse.json({
    ok: resultado.ok,
    modo: "envio_real",
    destino_prueba: to,
    ...info,
    resultado,
    comoActivar: "Cuando el WhatsApp de prueba llegue bien, pon OWNER_WHATSAPP_ENABLED=true y OWNER_WHATSAPP_TO=<numero del dueño> en Vercel.",
  }, { status: resultado.ok ? 200 : 502 });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
