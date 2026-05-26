import { NextResponse } from "next/server";
import { checkAll } from "@/lib/health";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET() {
  const services = await checkAll();
  const allOk = services.every((s) => s.status === "operational" || s.status === "unknown");
  const someDown = services.some((s) => s.status === "down");
  const overall = someDown ? "down" : allOk ? "operational" : "degraded";
  return NextResponse.json({ overall, services, checked_at: new Date().toISOString() });
}
