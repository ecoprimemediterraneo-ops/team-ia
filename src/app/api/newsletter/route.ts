import { NextResponse } from "next/server";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet } from "@/lib/supabase";

const schema = z.object({ email: z.string().email() });
const DATA_DIR = process.env.VERCEL ? "/tmp/aiteam-data" : path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "newsletter.json");
const KV_KEY = "newsletter:subscribers";
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

type Sub = { email: string; date: string };

async function load(): Promise<Sub[]> {
  if (USE_SUPABASE) {
    const data = await kvGet<Sub[]>(KV_KEY);
    return data || [];
  }
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function save(list: Sub[]) {
  if (USE_SUPABASE) {
    await kvSet(KV_KEY, list);
    return;
  }
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
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
