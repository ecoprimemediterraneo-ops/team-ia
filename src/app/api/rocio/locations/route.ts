/**
 * GET  /api/rocio/locations              — lista locales del cliente
 * POST /api/rocio/locations              — crea local nuevo
 *      body: { name, google_place_id?, google_review_link?, address?, city? }
 * POST /api/rocio/locations {action:"delete", id}
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listLocations, createLocation, deleteLocation, getLocationForOwner } from "@/lib/rocio-db";

const MAX_LOCATIONS = 50;

const createSchema = z.object({
  name: z.string().min(2).max(120),
  google_place_id: z.string().max(200).optional(),
  google_review_link: z.string().url().max(500).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const locations = await listLocations(s.email);
  return NextResponse.json({ locations });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  if (body.action === "delete") {
    if (!body.id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const owned = await getLocationForOwner(body.id, s.email);
    if (!owned) return NextResponse.json({ error: "No es tuyo" }, { status: 403 });
    await deleteLocation(body.id, s.email);
    return NextResponse.json({ ok: true });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const existing = await listLocations(s.email);
  if (existing.length >= MAX_LOCATIONS) {
    return NextResponse.json({ error: `Límite ${MAX_LOCATIONS} locales por cliente` }, { status: 400 });
  }
  const loc = await createLocation({
    owner_email: s.email,
    name: parsed.data.name,
    google_place_id: parsed.data.google_place_id ?? null,
    google_review_link: parsed.data.google_review_link ?? null,
    address: parsed.data.address ?? null,
    city: parsed.data.city ?? null,
  });
  return NextResponse.json({ location: loc });
}
