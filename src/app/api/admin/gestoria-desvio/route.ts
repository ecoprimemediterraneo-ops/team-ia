// Desvío de facturas: a qué gestoría van los adjuntos de un número de WhatsApp.
// Founder-only.
//
//   GET                    dice cómo está la cosa y qué gestorías hay
//   GET ?tenant=<id>       enciende el desvío hacia esa gestoría
//   GET ?apagar=1          lo quita
//
// Solo afecta a los ADJUNTOS. El texto sigue yendo a Pablo con el tenant de
// siempre, así que encender esto no toca la cuenta comercial de AI-Team.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { listTenants, getTenant } from "@/lib/tenants";
import { resolverSector } from "@/lib/sectores";
import { leerDesvio, guardarDesvio } from "@/lib/gestoria-desvio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NUMERO_AITEAM = process.env.WHATSAPP_PHONE_NUMBER_ID || "1189470684259465";

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const q = new URL(req.url).searchParams;
  const todos = await listTenants();
  const gestorias = todos
    .filter((t) => resolverSector(t) === "gestoria")
    .map((t) => ({ id: t.id, nombre: t.name ?? t.id, numeroPropio: t.whatsappPhoneNumberId ?? null }));

  if (q.get("apagar") === "1") {
    const d = await leerDesvio();
    if (d) await guardarDesvio({ ...d, activo: false });
    return NextResponse.json({
      veredicto: "Desvío QUITADO. Los adjuntos vuelven al tenant que resuelva cada número.",
      gestorias,
    });
  }

  const destino = q.get("tenant");
  if (destino) {
    const t = await getTenant(destino);
    if (!t) {
      return NextResponse.json(
        { veredicto: `No existe el tenant "${destino}".`, gestorias },
        { status: 400 },
      );
    }
    if (resolverSector(t) !== "gestoria") {
      // Desviar a un tenant que no es gestoría dejaría las facturas en una
      // cuenta sin pantalla donde verlas: entrarían y no aparecerían en ningún
      // sitio, que es justo el fallo que estamos arreglando.
      return NextResponse.json(
        {
          veredicto: `"${destino}" no es una gestoría (sector ${resolverSector(t) ?? "sin sector"}). Las facturas no tendrían dónde salir.`,
          gestorias,
        },
        { status: 400 },
      );
    }
    await guardarDesvio({
      phoneNumberId: NUMERO_AITEAM,
      tenantId: destino,
      activo: true,
      puesto_en: new Date().toISOString(),
      nota: "Puente mientras la gestoría no tiene su propio número de WhatsApp.",
    });
    return NextResponse.json({
      veredicto: `LISTO. Las fotos y PDF que lleguen al número de AI-Team se guardan en "${t.name ?? destino}".`,
      numeroQueDesvia: NUMERO_AITEAM,
      donde: `/dashboard/facturas (entrando como ${destino})`,
      ojo: "Solo los adjuntos. El texto sigue yendo a Pablo con el tenant de siempre.",
      gestorias,
    });
  }

  const d = await leerDesvio();
  return NextResponse.json({
    veredicto:
      d && d.activo
        ? `Desvío ACTIVO: los adjuntos de ${d.phoneNumberId} van a "${d.tenantId}" desde ${new Date(d.puesto_en).toLocaleString("es-ES")}.`
        : "Sin desvío. Cada factura va al tenant del número que la recibe, que es lo normal.",
    numeroDeAiTeam: NUMERO_AITEAM,
    gestorias,
    paraEncender: "añade ?tenant=<id de la gestoría>",
    paraApagar: "añade ?apagar=1",
    comoEsDeVerdad:
      "Cada gestoría con su propio número de WhatsApp dado de alta en Meta, y su whatsappPhoneNumberId " +
      "en el tenant. Este desvío es el puente para los días que van desde que entra una gestoría hasta " +
      "que tiene el suyo.",
  });
}
