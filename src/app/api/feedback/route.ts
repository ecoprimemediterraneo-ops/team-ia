import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { addFeedback, getFeedback, getLearnedPatterns } from "@/lib/store";
import type { AgentSlug } from "@/lib/agents";

const schema = z.object({
  agent: z.enum(["lucia", "marta", "carmen", "pablo", "rocio", "eva"]),
  userMessage: z.string().min(1).max(5000),
  agentResponse: z.string().min(1).max(10000),
  rating: z.enum(["up", "down"]),
  correction: z.string().max(10000).optional(),
});

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const fb = await addFeedback(email, parsed.data);
    return NextResponse.json({ ok: true, id: fb.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { email } = await requireSession();
    const url = new URL(req.url);
    const agent = url.searchParams.get("agent") as AgentSlug | null;
    const [feedback, learned] = await Promise.all([
      getFeedback(email, agent || undefined, 50),
      getLearnedPatterns(email, agent || undefined, 20),
    ]);
    const stats = {
      total: feedback.length,
      ups: feedback.filter((f) => f.rating === "up").length,
      downs: feedback.filter((f) => f.rating === "down").length,
      lessons: learned.length,
    };
    return NextResponse.json({ feedback, learned, stats });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
