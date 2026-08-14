// GET /api/admin/tenants-meta — founder-only. SOLO LEE.
//
// Contesta a una pregunta que no se puede contestar mirando el código: ¿el
// identificador del número de WhatsApp que hay GUARDADO en cada tenant es el que
// de verdad está usando Meta?
//
// Existe por un fallo real: `seedTenants()` copia `WHATSAPP_PHONE_NUMBER_ID` la
// única vez que crea el registro, y ahí se queda congelado. Al cambiar del
// número de prueba al de empresa, la variable de Vercel apuntaba al nuevo y el
// tenant guardado seguía con el viejo. No se notó porque `resolveTenantFromMeta`
// no encontraba el id y caía al tenant por defecto, que resultaba ser el mismo:
// todo funcionaba y el dato era mentira. Con un segundo cliente con número
// propio, sus mensajes habrían acabado en la cuenta de otro.
//
// Ya no hace falta arreglarlo a mano —`readAll()` reconcilia la cuenta propia al
// leer—, pero sí poder MIRARLO sin rebuscar en los logs de Vercel.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { listTenants, DEFAULT_TENANT_ID } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const delEntorno = {
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || null,
    instagramUserId: process.env.INSTAGRAM_USER_ID || null,
  };

  const tenants = (await listTenants()).map((t) => {
    const esPropio = t.id === DEFAULT_TENANT_ID;
    const wa = t.whatsappPhoneNumberId || null;
    const ig = t.instagramUserId || null;
    return {
      id: t.id,
      nombre: t.name,
      whatsappPhoneNumberId: wa,
      instagramUserId: ig,
      // Solo la cuenta propia se compara con el entorno: los clientes tienen su
      // número y no hay variable donde mirar.
      cuadraConElEntorno: esPropio
        ? {
            whatsapp: delEntorno.whatsappPhoneNumberId ? wa === delEntorno.whatsappPhoneNumberId : "sin variable",
            instagram: delEntorno.instagramUserId ? ig === delEntorno.instagramUserId : "sin variable",
          }
        : "no aplica (no es la cuenta propia)",
    };
  });

  // Dos tenants con el mismo id de Meta es un enrutado ambiguo: gana el primero
  // que aparezca al recorrer, que es un orden que nadie ha decidido.
  const repetidos: string[] = [];
  const vistos = new Map<string, string>();
  for (const t of tenants) {
    for (const v of [t.whatsappPhoneNumberId, t.instagramUserId]) {
      if (!v) continue;
      const antes = vistos.get(v);
      if (antes) repetidos.push(`${v} está en ${antes} y en ${t.id}`);
      else vistos.set(v, t.id);
    }
  }

  return NextResponse.json({
    ok: true,
    entorno: delEntorno,
    tenantPorDefecto: DEFAULT_TENANT_ID,
    tenants,
    repetidos,
    comoSeLee:
      "En la cuenta propia, whatsappPhoneNumberId tiene que ser igual que el del entorno. " +
      "Si no lo es, la próxima lectura lo corrige sola y lo deja escrito en el log como '[tenants] … Se actualiza al del entorno'.",
  });
}
