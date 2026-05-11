import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { bulkCreateLeads } from "@/lib/pipeline";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
const isFounder = (e: string) => e === FOUNDER_EMAIL || e === "crisasky@gmail.com";

const schema = z.object({
  csv: z.string().min(3).max(5_000_000),
  defaultSector: z.string().min(1).max(80),
  defaultSource: z.string().max(80).default("csv"),
});

function parseCSV(csv: string, defaults: { sector: string; source: string }, owner: string) {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  // Detectar header
  const headerRaw = lines[0].toLowerCase();
  const headerCols = headerRaw.split(/[,;\t]/).map((c) => c.trim().replace(/^["']|["']$/g, ""));

  function findCol(...keys: string[]) {
    return headerCols.findIndex((c) => keys.some((k) => c.includes(k)));
  }

  const has = headerCols.some((c) =>
    c.includes("nombre") || c.includes("name") || c.includes("clínica") || c.includes("clinic") || c.includes("empresa") || c.includes("business")
  );
  if (has) lines.shift();

  const businessNameCol = findCol("nombre negocio", "business", "clínica", "clinica", "clinic", "empresa", "company");
  const contactNameCol = findCol("contacto", "contact name", "dueño", "owner", "responsable");
  const emailCol = findCol("email", "correo");
  const phoneCol = findCol("phone", "telefono", "teléfono", "móvil", "movil");
  const cityCol = findCol("city", "ciudad");
  const websiteCol = findCol("website", "web", "url");
  const ratingCol = findCol("rating", "valoración", "valoracion", "estrellas", "stars");
  const reviewsCol = findCol("reviews", "reseñas", "resenas");

  const out: Parameters<typeof bulkCreateLeads>[0] = [];
  for (const line of lines) {
    const cols = line.split(/[,;\t]/).map((c) => c.trim().replace(/^["']|["']$/g, ""));
    const businessName = businessNameCol >= 0 ? cols[businessNameCol] : cols[0];
    if (!businessName || businessName.length < 2) continue;
    out.push({
      businessName,
      contactName: contactNameCol >= 0 ? cols[contactNameCol] : undefined,
      email: emailCol >= 0 ? cols[emailCol].toLowerCase() : undefined,
      phone: phoneCol >= 0 ? cols[phoneCol] : undefined,
      city: cityCol >= 0 ? cols[cityCol] : undefined,
      website: websiteCol >= 0 ? cols[websiteCol] : undefined,
      rating: ratingCol >= 0 ? parseFloat(cols[ratingCol]) || undefined : undefined,
      reviewCount: reviewsCol >= 0 ? parseInt(cols[reviewsCol]) || undefined : undefined,
      sector: defaults.sector,
      stage: "new",
      source: defaults.source,
      ownerEmail: owner,
    });
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    if (!isFounder(email)) return NextResponse.json({ error: "Solo founder" }, { status: 403 });
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const leads = parseCSV(parsed.data.csv, {
      sector: parsed.data.defaultSector,
      source: parsed.data.defaultSource,
    }, email);

    if (leads.length === 0) return NextResponse.json({ error: "No se encontraron leads válidos" }, { status: 400 });

    const result = await bulkCreateLeads(leads);
    return NextResponse.json({ ...result, parsed: leads.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
