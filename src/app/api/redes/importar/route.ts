import { NextResponse } from "next/server";
import { getSession, isFounder } from "@/lib/auth";
import { importarTodo } from "@/lib/redes-importer";

export async function POST() {
  const s = await getSession();
  if (!s || !isFounder(s.email)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const res = await importarTodo();
  return NextResponse.json({ ok: true, ...res });
}
