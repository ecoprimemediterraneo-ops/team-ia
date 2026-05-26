import { NextResponse } from "next/server";
import { checkAll, saveHealthSnapshot } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production") {
    if (req.headers.get("x-vercel-cron") !== "1") {
      // Vercel cron header puede variar; mantenemos permisivo si no hay CRON_SECRET configurado
      if (process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const services = await checkAll();
  await saveHealthSnapshot(services);
  return NextResponse.json({ services, checked_at: new Date().toISOString() });
}
