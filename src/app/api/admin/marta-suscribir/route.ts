// POST /api/admin/marta-suscribir — founder-only. ESCRIBE en Meta.
//
// Suscribe a los campos del webhook que necesita Marta.
//
// El que enciende los comentarios es la suscripción de la APP al objeto
// `instagram` (`/{app-id}/subscriptions`), NO la de la Página: `comments` ni
// siquiera existe como campo de Página. Ver la cabecera de meta-webhook-subs.ts,
// que lleva el rastro de los tres errores de Meta que llevaron hasta aquí.
//
// Sin `comments` en esa suscripción, el comentario no llega nunca al webhook y
// comentario→DM no se dispara aunque todo lo demás esté bien.
//
// SIRVE PARA CUALQUIER CLIENTE, no solo para la cuenta propia:
//
//   curl -X POST https://aiteam.marketing/api/admin/marta-suscribir \
//        -H "Content-Type: application/json" \
//        -d '{"pageId":"<Página del cliente>","igUserId":"<IG user del cliente>"}'
//
// Parámetros (todos opcionales):
//   pageId          — por defecto FACEBOOK_PAGE_ID.
//   igUserId        — por defecto INSTAGRAM_USER_ID.
//   camposPagina    — por defecto ["messages"].
//   camposInstagram — por defecto ["comments","messages"].
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
  suscribirNodo,
  derivarPageToken,
  resolverTokenSystemUser,
  anadirCamposApp,
  CAMPOS_PAGINA,
  CAMPOS_INSTAGRAM,
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

  const body = (await req.json().catch(() => ({}))) as {
    pageId?: string;
    igUserId?: string;
    camposPagina?: string[];
    camposInstagram?: string[];
    callbackUrl?: string;
  };
  const pageId = (body.pageId || process.env.FACEBOOK_PAGE_ID || "").trim();
  const igUserId = (body.igUserId || process.env.INSTAGRAM_USER_ID || "").trim();
  if (!pageId) {
    return NextResponse.json(
      { ok: false, error: "sin_page_id", detalle: "Pasa `pageId` o define FACEBOOK_PAGE_ID." },
      { status: 400 },
    );
  }

  const lista = (v: string[] | undefined, def: readonly string[]) =>
    Array.isArray(v) && v.length ? v.map((c) => String(c).trim()).filter(Boolean) : [...def];
  const camposPagina = lista(body.camposPagina, CAMPOS_PAGINA);
  const camposInstagram = lista(body.camposInstagram, CAMPOS_INSTAGRAM);

  const tok = resolverTokenSystemUser();
  if (!tok) {
    return NextResponse.json(
      { ok: false, error: "sin_token", detalle: "No hay INSTAGRAM_ACCESS_TOKEN ni WHATSAPP_ACCESS_TOKEN." },
      { status: 400 },
    );
  }

  // Un solo Page token para los dos nodos.
  const page = await derivarPageToken(pageId, tok.valor);
  if (!page.ok) {
    return NextResponse.json(
      { ok: false, error: "sin_page_token", detalle: `código ${page.code ?? "?"}: ${page.message}` },
      { status: 502 },
    );
  }

  // 1) Lo que de verdad enciende los comentarios: la suscripción de la APP al
  //    objeto `instagram`. Es de donde ya llegan los DMs (la Página tiene la
  //    lista vacía y aun así entran), así que es de donde tienen que llegar
  //    también los comentarios.
  const callback =
    (body.callbackUrl || "").trim() ||
    `${(process.env.PUBLIC_URL || "https://aiteam.marketing").replace(/\/$/, "")}/api/marta/webhook`;
  const app = await anadirCamposApp(
    "instagram",
    camposInstagram,
    process.env.INSTAGRAM_VERIFY_TOKEN || "",
    callback,
  );

  // 2) Y de paso la Página, que es por donde Meta documenta los DMs. Va como
  //    "mejor si sale": hoy los DMs funcionan sin ella, así que si falta un
  //    permiso se reporta pero no se da todo por roto.
  const nodos = [await suscribirNodo("pagina", pageId, camposPagina, page.token)];
  if (igUserId) {
    nodos.push(await suscribirNodo("instagram", igUserId, camposInstagram, page.token));
  }

  const comentariosOk = app.despues.includes("comments");
  const resumen = comentariosOk
    ? app.creada
      ? `Creada la suscripción de la app al objeto instagram con callback ${app.callbackUrl}, y ya incluye \`comments\`. Campos: ${app.despues.join(", ")}.`
      : app.sinCambios
      ? "No hacía falta tocar nada: la app ya estaba suscrita a `comments` en el objeto instagram."
      : `Listo: la app ya está suscrita a \`comments\`, comprobado releyendo de Meta. Campos ahora: ${app.despues.join(", ")}.`
    : `NO se ha conseguido suscribir \`comments\`. ${app.error || "Revisa el detalle."}`;

  return NextResponse.json(
    {
      ok: comentariosOk,
      resumen,
      comentariosOk,
      tokenLeidoDe: tok.variable,
      // Lo que importa: la suscripción de la app.
      app,
      // Complementario, informativo.
      nodos,
    },
    { status: comentariosOk ? 200 : 502 },
  );
}
