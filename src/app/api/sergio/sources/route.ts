/**
 * GET  /api/sergio/sources — lista fuentes
 * POST /api/sergio/sources — crea fuente nueva
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listSources, createSource, updateSource, deleteSource } from "@/lib/sergio-db";

const ALLOWED = ["ecoprimemediterraneo@gmail.com", "crisasky@gmail.com"];

async function auth() {
  const s = await getSession();
  if (!s || !ALLOWED.includes(s.email)) return null;
  return s;
}

export async function GET() {
  if (!await auth()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sources = await listSources();
  return NextResponse.json({ sources });
}

export async function POST(req: Request) {
  if (!await auth()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { action, id, ...data } = body;

  if (action === "delete") {
    await deleteSource(id);
    return NextResponse.json({ ok: true });
  }
  if (action === "toggle") {
    await updateSource(id, { active: data.active });
    return NextResponse.json({ ok: true });
  }

  const source = await createSource({
    type: data.type ?? "web",
    url: data.url,
    competitor_name: data.competitor_name,
    category: data.category ?? "direct_competitor",
    frequency: data.frequency ?? "weekly",
    active: true,
    config: data.config ?? {},
  });
  return NextResponse.json({ source });
}
