import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { clearChat } from "@/lib/store";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ agent: string }> }
) {
  try {
    const { email } = await requireSession();
    const { agent } = await params;
    const valid = ["lucia", "marta", "carmen", "pablo", "rocio", "eva", "sergio", "diana", "tomas", "tomas"] as const;
    if (!valid.includes(agent as (typeof valid)[number])) {
      return NextResponse.json({ error: "Agente no existe" }, { status: 404 });
    }
    await clearChat(email, agent as (typeof valid)[number]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }
}
