// Ruta de PRUEBA del aviso al dueño por email (marca AI-Team).
// Manda un email de ejemplo (cita nueva o cancelada) a un correo explícito, para
// verificar que llega y con la marca correcta ANTES de activar OWNER_NOTIFY_ENABLED.
//
//   GET/POST /api/booking/owner-notify-test?to=tu@correo.com[&tipo=nueva|cancelada][&slug=...][&secret=...]
//
// Se salta el flag y el dedup a propósito (va gateado por secreto y por el email
// explícito), para no tener que activar los envíos reales a dueños.
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getBusinessBySlug, listBusinesses, resolveCalendarEmail, type BookingRecord } from "@/lib/booking";
import { construirAvisoDueno, enviarAvisoDuenoA, ownerNotifyEnabled } from "@/lib/booking-email";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Autoriza si: (1) hay sesión de FUNDADOR (logueado en aiteam.marketing → URL simple
// sin secreto), o (2) llega el secreto correcto por ?secret= o header x-cron-secret.
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
  const qp = url.searchParams.get("secret") || "";
  const hdr = h.get("x-cron-secret") || "";
  return qp === expected || hdr === expected;
}

async function run(req: Request) {
  const h = await headers();
  if (!(await authorized(req, h))) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        pista: {
          cronSecretPresente: !!process.env.CRON_SECRET,
          ownerTestSecretPresente: !!process.env.OWNER_NOTIFY_TEST_SECRET,
          nota: "Más fácil: entra en aiteam.marketing (login cris) y abre esta URL sin secreto.",
        },
      },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const to = (url.searchParams.get("to") || "").trim();
  const tipo: "nueva" | "cancelada" = url.searchParams.get("tipo") === "cancelada" ? "cancelada" : "nueva";
  const slug = url.searchParams.get("slug") || "";
  if (!to || !to.includes("@")) {
    return NextResponse.json({ ok: false, error: "Falta ?to=<email>. Ej: tucorreo@dominio.com" }, { status: 400 });
  }

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

  const { subject, html } = construirAvisoDueno(record, business, tipo);
  // Vista previa del email tal cual (para revisarlo aunque no se envíe en local).
  if (url.searchParams.get("format") === "html") {
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  const emailDuenoConfig = await resolveCalendarEmail(business).catch(() => "");
  const credencialesResend = !!process.env.RESEND_API_KEY;
  const resultado = await enviarAvisoDuenoA(to, record, business, tipo);

  return NextResponse.json({
    ok: true,
    entorno: { credencialesResend, OWNER_NOTIFY_ENABLED: ownerNotifyEnabled() },
    destino_prueba: to,
    email_dueno_en_config: emailDuenoConfig, // el email al que iría en el flujo real
    tipo,
    salon: business.nombre,
    subject,
    resultado, // modo: "resend" (enviado) | "log_local" (sin RESEND en local) | "error"
    comoActivar:
      "Cuando el email de prueba llegue bien, pon OWNER_NOTIFY_ENABLED=true para que se avise al dueño en cada cita nueva/cancelada.",
  });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
