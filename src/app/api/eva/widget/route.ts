import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { getOrCreateWidget, updateWidget } from "@/lib/store";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  title: z.string().max(120).optional(),
  subtitle: z.string().max(300).optional(),
  ctaLabel: z.string().max(40).optional(),
  successMessage: z.string().max(300).optional(),
  welcomeEmailEnabled: z.boolean().optional(),
  welcomeSubject: z.string().max(150).optional(),
  welcomeBody: z.string().max(8000).optional(),
});

export async function GET() {
  try {
    const { email } = await requireSession();
    const w = await getOrCreateWidget(email);
    return NextResponse.json({ widget: w });
  } catch {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { email } = await requireSession();
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const updated = await updateWidget(email, parsed.data);
    return NextResponse.json({ widget: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
