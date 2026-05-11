import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listChanges, acknowledgeChange } from "@/lib/sergio-db";

const ALLOWED = ["ecoprimemediterraneo@gmail.com", "crisasky@gmail.com"];

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !ALLOWED.includes(s.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const relevance = searchParams.get("relevance") as "critical" | "high" | "medium" | "low" | null;
  const changes = await listChanges({ relevance: relevance ?? undefined, limit: 50 });
  return NextResponse.json({ changes });
}

export async function PATCH(req: Request) {
  const s = await getSession();
  if (!s || !ALLOWED.includes(s.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await acknowledgeChange(id);
  return NextResponse.json({ ok: true });
}
