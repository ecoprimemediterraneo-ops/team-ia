import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { importarTodo } from "@/lib/redes-importer";

const FOUNDER_EMAILS = [
  process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com",
  "crisasky@gmail.com",
];

export async function POST() {
  const s = await getSession();
  if (!s || !FOUNDER_EMAILS.includes(s.email)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const res = await importarTodo();
  return NextResponse.json({ ok: true, ...res });
}
