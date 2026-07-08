// GET /api/admin/marta-permisos — founder-only.
// Diagnóstico "listo para publicar en Instagram": flag MARTA_PUBLISH_ENABLED,
// token configurado y —en vivo contra Graph API— si `instagram_content_publish`
// está CONCEDIDO (App Review de Meta aprobado). NO publica nada.
import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { checkPublishReadiness } from "@/lib/marta-publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const a = await requireFounder();
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  const readiness = await checkPublishReadiness();
  return NextResponse.json({ ok: true, readiness });
}
