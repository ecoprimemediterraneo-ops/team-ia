/**
 * GET /api/marta/leads — leads detectados por Marta en IG (consulta_precio + pedir_cita).
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listLeadsByOwner } from "@/lib/marta-ig-db";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leads = await listLeadsByOwner(s.email, 50);
  return NextResponse.json({ leads });
}
