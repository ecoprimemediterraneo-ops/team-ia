// POST /api/admin/marta-suscribir — founder-only. ESCRIBE en Meta.
//
// Suscribe a los campos del webhook que necesita Marta. Son DOS nodos
// distintos, y esa es la parte que no se ve en la documentación:
//
//   - La PÁGINA          → `messages` (los DMs).
//   - El USUARIO DE INSTAGRAM → `comments` (los comentarios de los posts).
//
// `comments` NO existe como campo de Página: Meta lo rechaza con error 100. Por
// eso hay que tocar los dos sitios. Sin la suscripción a `comments`, el
// comentario no llega nunca al webhook y comentario→DM no se dispara aunque
// todo lo demás esté bien.
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

  const resultados = [await suscribirNodo("pagina", pageId, camposPagina, page.token)];
  if (igUserId) {
    resultados.push(await suscribirNodo("instagram", igUserId, camposInstagram, page.token));
  }

  const ig = resultados.find((r) => r.nodo === "instagram");
  const comentariosOk = !!ig && ig.despues.includes("comments");
  const todoOk = resultados.every((r) => r.ok && r.verificado);

  const resumen = !igUserId
    ? "No hay INSTAGRAM_USER_ID: solo se ha tocado la Página. `comments` vive en el nodo de Instagram, así que sin ese id no se puede suscribir."
    : comentariosOk
      ? "Listo: el nodo de Instagram ya está suscrito a `comments`, comprobado releyendo de Meta."
      : `NO se ha conseguido suscribir \`comments\`. ${ig?.error || "Revisa el detalle de cada nodo."}`;

  return NextResponse.json(
    { ok: todoOk && comentariosOk, resumen, comentariosOk, tokenLeidoDe: tok.variable, resultados },
    { status: todoOk ? 200 : 502 },
  );
}
