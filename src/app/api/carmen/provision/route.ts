/**
 * Carmen · Provisionamiento automático del número Twilio.
 * GET: lista números disponibles según prefijo
 * POST: compra + asigna + configura webhook
 * DELETE: libera número
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listAvailableNumbers, buyAndConfigureNumber, releaseNumber, testCall, INSTRUCCIONES_DESVIO } from "@/lib/twilio-provision";
import { getCarmenProfile, updateCarmenProfile } from "@/lib/carmen";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const buySchema = z.object({ phone_number: z.string().min(8) });
const testSchema = z.object({ action: z.literal("test_call"), my_phone: z.string().min(8) });

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "local") as "local" | "mobile" | "tollfree";
  const areaCode = url.searchParams.get("area_code") || undefined;

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return NextResponse.json({ error: "Twilio no configurado en el servidor", available: [], operadoras: INSTRUCCIONES_DESVIO });
  }

  try {
    const available = await listAvailableNumbers({ type, areaCode, limit: 10 });
    return NextResponse.json({ available, operadoras: INSTRUCCIONES_DESVIO });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, available: [], operadoras: INSTRUCCIONES_DESVIO }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimit({ key: "carmen-prov", ip: getClientIp(req), limit: 5, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });

  const body = await req.json();

  if (body.action === "test_call") {
    const c = testSchema.safeParse(body);
    if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
    const profile = await getCarmenProfile(s.email);
    if (!profile.twilio_phone_number) return NextResponse.json({ error: "Antes asigna un número Carmen" }, { status: 400 });
    try {
      const sid = await testCall({ to: c.data.my_phone, from: profile.twilio_phone_number });
      return NextResponse.json({ ok: true, sid });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Comprar número
  const c = buySchema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return NextResponse.json({ error: "Twilio no configurado en el servidor (falta TWILIO_ACCOUNT_SID/TOKEN)" }, { status: 503 });
  }

  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;
  const webhookUrl = `${base}/api/carmen/twilio/voice`;

  try {
    const r = await buyAndConfigureNumber({
      phoneNumber: c.data.phone_number,
      webhookUrl,
      friendlyName: `Carmen · ${s.email}`,
    });
    await updateCarmenProfile(s.email, { twilio_phone_number: r.phone_number });
    return NextResponse.json({ ok: true, phone_number: r.phone_number, sid: r.sid });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getCarmenProfile(s.email);
  if (!profile.twilio_phone_number) return NextResponse.json({ ok: true });
  // Para liberar necesitamos el sid; no lo guardamos hoy. Por ahora solo desasignamos.
  await updateCarmenProfile(s.email, { twilio_phone_number: null });
  return NextResponse.json({ ok: true, note: "Número desvinculado del perfil. Para liberar el alquiler Twilio, hazlo manual en console.twilio.com." });
}

// Helper para liberar con SID
export async function PATCH(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (typeof body.sid !== "string") return NextResponse.json({ error: "sid requerido" }, { status: 400 });
  try {
    await releaseNumber(body.sid);
    await updateCarmenProfile(s.email, { twilio_phone_number: null });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
