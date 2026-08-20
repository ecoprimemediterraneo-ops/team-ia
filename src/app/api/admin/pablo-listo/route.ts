// ¿Está Pablo bien enchufado a WhatsApp? Founder-only.
//
// POR QUÉ ES UNA RUTA Y NO UN SCRIPT: para preguntárselo a Meta hace falta el
// token de WhatsApp, y ese token vive en Vercel y NO se saca de ahí. El servidor
// sí lo tiene, así que pregunta él y devuelve solo el resultado. Aquí no se
// imprime ningún token ni ningún secreto, solo si están puestos y qué contesta
// Meta.
//
// NO MANDA NINGÚN MENSAJE. Son todo lecturas (GET).

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { baseGraph } from "@/lib/meta-graph-local";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** El número tal y como lo escribe una persona, para poder compararlo a ojo. */
function soloDigitos(s: string): string {
  return (s || "").replace(/\D/g, "");
}

async function pedir(url: string, token: string): Promise<{ ok: boolean; status: number; json: unknown }> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    return { ok: false, status: 0, json: { error: e instanceof Error ? e.message : String(e) } };
  }
}

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

  // El número que esperamos ver conectado, si se pasa por la URL: ?numero=34722823703
  const esperado = soloDigitos(new URL(req.url).searchParams.get("numero") || "");

  const base = baseGraph();
  const salida: Record<string, unknown> = {
    urlDelWebhookQueDeberiaEstarEnMeta: "https://aiteam.marketing/api/pablo/webhook",
    variables: {
      WHATSAPP_ACCESS_TOKEN: token ? "puesta" : "FALTA",
      WHATSAPP_BUSINESS_ACCOUNT_ID: wabaId ? "puesta" : "FALTA",
      WHATSAPP_PHONE_NUMBER_ID: phoneId ? "puesta" : "FALTA",
      META_APP_ID: appId ? "puesta" : "FALTA",
      META_APP_SECRET: appSecret ? "puesta" : "FALTA",
      WEBHOOK_VERIFY_TOKEN: verifyToken ? "puesta" : "FALTA",
    },
  };

  if (!base) {
    salida.aviso = "Estás en local sin Graph de pruebas: no se pregunta a Meta.";
    return NextResponse.json(salida);
  }
  if (!token) {
    salida.veredicto = "No se puede comprobar: falta WHATSAPP_ACCESS_TOKEN.";
    return NextResponse.json(salida, { status: 200 });
  }

  // 1. Los números de la cuenta de WhatsApp Business.
  if (wabaId) {
    const r = await pedir(
      `${base}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type`,
      token,
    );
    const datos = r.json as { data?: Array<Record<string, unknown>> };
    const numeros = (datos.data || []).map((n) => ({
      id: n.id,
      numero: n.display_phone_number,
      nombre: n.verified_name,
      calidad: n.quality_rating,
      verificado: n.code_verification_status,
      esElDelPanel: String(n.id) === String(phoneId),
      coincideConElQueBuscas: esperado ? soloDigitos(String(n.display_phone_number)) === esperado : undefined,
    }));
    salida.numerosDeLaCuenta = r.ok ? numeros : { error: r.json, status: r.status };

    // 2. ¿Está la app suscrita a esta cuenta? Sin esto no llega ni un mensaje.
    const s = await pedir(`${base}/${wabaId}/subscribed_apps`, token);
    salida.appSuscritaALaCuenta = s.ok ? s.json : { error: s.json, status: s.status };
  }

  // 3. La URL del webhook que Meta tiene guardada. Necesita token de APP
  //    (appId|appSecret), no el de usuario: es configuración de la app.
  if (appId && appSecret) {
    const r = await pedir(
      `${base}/${appId}/subscriptions?access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`,
      token,
    );
    const datos = r.json as { data?: Array<Record<string, unknown>> };
    salida.webhooksConfiguradosEnMeta = r.ok
      ? (datos.data || []).map((d) => ({
          objeto: d.object,
          url: d.callback_url,
          activo: d.active,
          campos: Array.isArray(d.fields)
            ? (d.fields as Array<{ name?: string }>).map((f) => f.name || f)
            : d.fields,
          apuntaANuestraUrl: String(d.callback_url || "").includes("aiteam.marketing"),
        }))
      : { error: r.json, status: r.status };
  } else {
    salida.webhooksConfiguradosEnMeta = "No se puede leer: falta META_APP_ID o META_APP_SECRET.";
  }

  return NextResponse.json(salida);
}
