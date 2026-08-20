// Pasa el MISMO documento por dos modelos y devuelve las dos lecturas.
// Founder-only. No guarda nada: es un banco de pruebas, no una alta.
//
// PARA QUÉ: decidir con qué modelo se lee, con datos y no con intuición. Leer
// una factura no es razonar —los datos están en el papel—, así que el modelo
// barato debería bastar. "Debería" no vale: se compara campo a campo.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { leerDocumento, ES_CONTABLE } from "@/lib/gestoria-lectura";
import { dolares } from "@/lib/gestoria-coste";
import { MODELS } from "@/lib/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const form = await req.formData();
  const f = form.get("fichero");
  if (!(f instanceof File)) return NextResponse.json({ error: "falta el fichero" }, { status: 400 });

  const modelos = (String(form.get("modelos") || `${MODELS.fast},${MODELS.strong}`))
    .split(",").map((m) => m.trim()).filter(Boolean);

  const contenido = Buffer.from(await f.arrayBuffer());
  const salida: Record<string, unknown> = {};

  for (const modelo of modelos) {
    const r = await leerDocumento({ contenido, mime: f.type || "", nombre: f.name, modelo });
    if (!r.ok) { salida[modelo] = { error: r.error }; continue; }
    const l = r.lectura;
    salida[modelo] = {
      clase: l.clase,
      confianza: l.confianza,
      porQue: l.porQue,
      contable: ES_CONTABLE[l.clase],
      emisor: l.emisor, nifEmisor: l.nifEmisor, nifDestinatario: l.nifDestinatario,
      numero: l.numero, fecha: l.fecha, total: l.total, lineas: l.lineas,
      rectificaA: l.rectificaA, avisos: l.avisos,
      tokens: l.tokens,
      dolares: l.tokens ? dolares(modelo, l.tokens.entrada, l.tokens.salida) : null,
    };
  }

  return NextResponse.json({ fichero: f.name, modelos, lecturas: salida });
}
