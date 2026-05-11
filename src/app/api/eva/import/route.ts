import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { addContact, getContacts, getWelcomeSeries, queueWelcomeSends } from "@/lib/store";

const schema = z.object({
  csv: z.string().min(3).max(2_000_000),
  triggerWelcome: z.boolean().default(false),
});

function parseCSV(csv: string): { email: string; name?: string }[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  // detectar header
  const first = lines[0].toLowerCase();
  let emailCol = 0, nameCol = -1;
  if (first.includes("email") || first.includes("correo")) {
    const cols = first.split(/[,;\t]/);
    emailCol = cols.findIndex((c) => c.includes("email") || c.includes("correo"));
    nameCol = cols.findIndex((c) => c.includes("name") || c.includes("nombre"));
    lines.shift();
  }
  const out: { email: string; name?: string }[] = [];
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const line of lines) {
    const cols = line.split(/[,;\t]/).map((c) => c.trim().replace(/^["']|["']$/g, ""));
    const email = (cols[emailCol] || cols[0] || "").trim().toLowerCase();
    if (!emailRe.test(email)) continue;
    const name = nameCol >= 0 ? cols[nameCol] : undefined;
    out.push({ email, name: name || undefined });
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const contacts = parseCSV(parsed.data.csv);
    if (contacts.length === 0) {
      return NextResponse.json({ error: "No se encontraron emails válidos en el CSV" }, { status: 400 });
    }

    const existing = new Set((await getContacts(email)).map((c) => c.email.toLowerCase()));
    let added = 0;
    let skipped = 0;

    const series = parsed.data.triggerWelcome ? await getWelcomeSeries(email) : null;

    for (const c of contacts) {
      if (existing.has(c.email)) { skipped++; continue; }
      try {
        await addContact(email, { email: c.email, name: c.name });
        added++;
        existing.add(c.email);
        if (series?.enabled) {
          await queueWelcomeSends(email, c.email, series);
        }
      } catch { skipped++; }
    }

    return NextResponse.json({ added, skipped, total: contacts.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
