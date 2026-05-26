import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { translateCaption, IDIOMAS } from "@/lib/marta-translate";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  text: z.string().min(1).max(5000),
  target_lang: z.string().min(2).max(8),
  context: z.enum(["caption", "hashtags", "hook"]).optional(),
});

export async function GET() {
  return NextResponse.json({ idiomas: IDIOMAS });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimit({ key: "marta-trans", ip: getClientIp(req), limit: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });

  const body = await req.json();
  const c = schema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });

  const translated = await translateCaption({ owner_email: s.email, text: c.data.text, targetLang: c.data.target_lang, context: c.data.context });
  if (!translated) return NextResponse.json({ error: "Traducción falló" }, { status: 500 });
  return NextResponse.json({ translated });
}
