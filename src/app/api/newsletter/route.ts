import { NextResponse } from "next/server";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

const schema = z.object({ email: z.string().email() });
const FILE = path.join(process.cwd(), "data", "newsletter.json");

async function load(): Promise<{ email: string; date: string }[]> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function save(list: { email: string; date: string }[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    const list = await load();
    if (list.find((x) => x.email === parsed.data.email)) {
      return NextResponse.json({ ok: true, message: "Ya estabas suscrito" });
    }
    list.push({ email: parsed.data.email, date: new Date().toISOString() });
    await save(list);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
