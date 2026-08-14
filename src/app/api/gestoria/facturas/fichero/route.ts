// Sirve un fichero del saco. SOLO en desarrollo local, donde no hay Storage.
//
// En producción los ficheros NO pasan por aquí: se sirven con URL firmada y
// caducidad directamente desde el bucket privado de Supabase (ver `urlFirmada`).
// Este endpoint existe para que el módulo se pueda probar entero en local, y
// exige sesión igual que todo lo demás.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { leerFicheroLocal } from "@/lib/gestoria-facturas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ruta = new URL(req.url).searchParams.get("ruta") || "";
  if (!ruta) return NextResponse.json({ error: "falta ruta" }, { status: 400 });

  // La ruta empieza por el tenant. Se comprueba que sea el de quien pregunta:
  // sin esto, cualquiera con sesión podría leer los ficheros de otra gestoría.
  const ctx = await contextoPanelODefecto();
  if (!ruta.startsWith(`${ctx.tenantId}/`)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const buf = await leerFicheroLocal(ruta);
  if (!buf) return NextResponse.json({ error: "no encontrado" }, { status: 404 });

  const pdf = /\.pdf$/i.test(ruta);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": pdf ? "application/pdf" : "image/jpeg",
      // Documento contable de un tercero: que no se quede en ninguna caché.
      "Cache-Control": "private, no-store",
    },
  });
}
