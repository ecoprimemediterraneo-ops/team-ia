import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getOnboardingState } from "@/lib/onboarding";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const steps = await getOnboardingState(s.email);
  return NextResponse.json({ steps });
}
