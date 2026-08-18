// Por qué el log dice "FIRMA SIN COMPROBAR". Founder-only. Solo lee.
//
// El mensaje sale por tres motivos muy distintos y desde fuera se ven igual:
//
//   1. No hay META_APP_SECRET en el entorno de ESTE despliegue.
//   2. La petición venía sin la cabecera X-Hub-Signature-256 — o sea, no la
//      mandó Meta. Un curl de prueba deja exactamente esa línea en el log.
//   3. El secreto está, pero no es el que usa Meta para firmar: rotado en el
//      panel y no actualizado aquí, o actualizado en Vercel SIN redesplegar.
//
// El tercero es el que engaña. Las variables de Vercel se congelan en el
// despliegue: cambiarlas y no volver a desplegar deja el valor viejo corriendo,
// y en el panel se ve el nuevo. Por eso aquí no se pregunta "¿está la variable?"
// sino "¿este secreto sirve?", y eso se le pregunta a Meta.
//
// El secreto no sale nunca, ni entero ni a trozos.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { firmaEstricta } from "@/lib/meta-firma";
import { createHmac } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const secreto = process.env.META_APP_SECRET || "";
  const appId = process.env.META_APP_ID || "2156272571817837";

  const base: Record<string, unknown> = {
    META_APP_SECRET: secreto ? `${secreto.length} caracteres (no se muestra)` : "NO PUESTA",
    META_APP_ID: appId,
    META_FIRMA_ESTRICTA: firmaEstricta() ? "true — se RECHAZA lo que no cuadre" : "sin poner — solo se avisa, no se rechaza",
    // Una huella estable del secreto: si cambia, es que el secreto ha cambiado.
    // Es un HMAC de un texto fijo, no revela nada del secreto.
    huellaDelSecreto: secreto
      ? createHmac("sha256", secreto).update("aiteam-huella").digest("hex").slice(0, 12)
      : null,
  };

  if (!secreto) {
    return NextResponse.json({
      veredicto:
        "NO HAY META_APP_SECRET en este despliegue. Por eso el log dice FIRMA SIN COMPROBAR: " +
        "no hay con qué comprobar nada. Ponla en Vercel y REDESPLIEGA.",
      ...base,
    });
  }

  // La prueba de verdad: un token de aplicación es APP_ID|APP_SECRET. Si el
  // secreto no es el bueno, Meta lo rechaza. Si contesta con el nombre de la
  // app, el secreto que corre en este despliegue es el correcto.
  let prueba: Record<string, unknown>;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${appId}?fields=name,id&access_token=${encodeURIComponent(`${appId}|${secreto}`)}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    const txt = await res.text();
    const limpio = txt.split(secreto).join("«oculto»").slice(0, 300);
    let json: { name?: string; id?: string; error?: { message?: string; code?: number } };
    try { json = JSON.parse(limpio); } catch { json = {}; }

    if (res.ok && json.name) {
      prueba = { sirve: true, appSegunMeta: json.name, idSegunMeta: json.id };
      return NextResponse.json({
        veredicto:
          `El secreto de este despliegue ES el bueno (Meta lo acepta para la app "${json.name}"). ` +
          `Si el log sigue diciendo FIRMA SIN COMPROBAR, la petición llegó SIN cabecera de firma: ` +
          `eso es un curl de prueba, no un mensaje de Meta. Un mensaje real trae la cabecera y ahora el log ` +
          `distingue los dos casos.`,
        ...base,
        prueba,
      });
    }

    prueba = {
      sirve: false,
      http: res.status,
      queDiceMeta: (json.error?.message ?? limpio).slice(0, 200),
    };
  } catch (e) {
    prueba = { sirve: false, error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({
    veredicto:
      "EL SECRETO QUE CORRE EN ESTE DESPLIEGUE NO SIRVE. Meta no lo acepta para esta app. " +
      "Casi siempre: se rotó en Meta y se cambió en Vercel, pero NO se ha vuelto a desplegar — " +
      "las variables se congelan en el despliegue. Redespliega y vuelve a mirar.",
    ...base,
    prueba,
    ojo: "Mientras META_FIRMA_ESTRICTA no esté encendida, esto NO deja mudo a Pablo: solo se avisa.",
  });
}
