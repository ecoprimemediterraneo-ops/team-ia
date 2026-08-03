// POST /api/admin/marta-suscribir — founder-only. ESCRIBE en Meta.
//
// Suscribe una Página de Facebook a los campos del webhook que necesita Marta:
// `messages` (los DMs de Instagram) y `comments` (los comentarios de los posts).
// Sin la suscripción a `comments`, el comentario no llega nunca al webhook y la
// función comentario→DM no se dispara aunque todo lo demás esté bien.
//
// SIRVE PARA CUALQUIER CLIENTE, no solo para la cuenta propia. Se le pasa el
// `pageId` del cliente y ya está:
//
//   curl -X POST https://aiteam.marketing/api/admin/marta-suscribir \
//        -H "Content-Type: application/json" \
//        -d '{"pageId":"<id de la Página del cliente>"}'
//
// Parámetros (todos opcionales):
//   pageId — Página a suscribir. Por defecto, FACEBOOK_PAGE_ID (la propia).
//   campos — lista de campos. Por defecto, ["messages","comments"].
//
// NO borra suscripciones: manda la UNIÓN de lo que ya había con lo que se pide,
// porque el POST de Graph reemplaza la lista entera (ver meta-webhook-subs.ts).
// Y después RELEE de Meta para comprobarlo: que el POST conteste "success" no
// prueba que el campo haya quedado suscrito.
//
// Es POST a propósito: esto cambia la configuración de una Página real, y un GET
// no debe cambiar nada. Para solo mirar está GET /api/admin/marta-comentarios.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireFounder } from "@/lib/admin-auth";
import {
  suscribirCampos,
  resolverTokenSystemUser,
  CAMPOS_MARTA,
} from "@/lib/meta-webhook-subs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Segunda vía de entrada, para poder lanzarlo desde un script sin sesión de
 * navegador. Fail-CLOSED: sin `DIAG_SECRET` definida esta vía no existe y la
 * única forma de entrar es la sesión del fundador.
 */
async function autorizadoPorSecreto(): Promise<boolean> {
  const esperado = process.env.DIAG_SECRET;
  if (!esperado) return false;
  const h = await headers();
  return h.get("x-diag-secret") === esperado;
}

export async function POST(req: Request) {
  if (!(await autorizadoPorSecreto())) {
    const a = await requireFounder();
    if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  }

  const body = (await req.json().catch(() => ({}))) as { pageId?: string; campos?: string[] };
  const pageId = (body.pageId || process.env.FACEBOOK_PAGE_ID || "").trim();
  if (!pageId) {
    return NextResponse.json(
      { ok: false, error: "sin_page_id", detalle: "Pasa `pageId` o define FACEBOOK_PAGE_ID." },
      { status: 400 },
    );
  }

  const campos = Array.isArray(body.campos) && body.campos.length
    ? body.campos.map((c) => String(c).trim()).filter(Boolean)
    : [...CAMPOS_MARTA];

  const tok = resolverTokenSystemUser();
  if (!tok) {
    return NextResponse.json(
      { ok: false, error: "sin_token", detalle: "No hay INSTAGRAM_ACCESS_TOKEN ni WHATSAPP_ACCESS_TOKEN." },
      { status: 400 },
    );
  }

  const r = await suscribirCampos(pageId, campos, tok.valor);

  const resumen = !r.ok
    ? `No se ha podido suscribir: ${r.error}`
    : r.sinCambios
      ? `No hacía falta tocar nada: la Página ya estaba suscrita a ${campos.join(", ")}.`
      : r.verificado
        ? `Suscrita y comprobado releyendo de Meta: ${r.despues.join(", ")}.`
        : `El POST pasó, pero al releer NO aparecen todos los campos pedidos. Ahora hay: ${r.despues.join(", ") || "ninguno"}.`;

  return NextResponse.json(
    // `ok` va DESPUÉS del spread a propósito: el de la respuesta es más
    // estricto que el de `suscribirCampos` — aquí solo es ok si además se ha
    // podido comprobar releyendo de Meta.
    { ...r, resumen, tokenLeidoDe: tok.variable, ok: r.ok && r.verificado },
    { status: r.ok ? 200 : 502 },
  );
}
