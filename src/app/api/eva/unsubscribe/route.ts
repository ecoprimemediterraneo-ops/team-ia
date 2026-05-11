import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/supabase";
import type { SequenceEnrollment } from "../sequences/route";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");
  if (!leadId) return new Response("Missing leadId", { status: 400 });

  const enrollments: SequenceEnrollment[] = (await kvGet("seq_enrollments")) ?? [];
  const updated = enrollments.map((e) =>
    e.leadId === leadId ? { ...e, unsubscribed: true, done: true } : e
  );
  await kvSet("seq_enrollments", updated);

  return new Response(
    `<html><body style="font-family:sans-serif;max-width:400px;margin:80px auto;text-align:center">
      <h2>Dado de baja ✓</h2>
      <p>No recibirás más emails de AI-Team para este negocio.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
