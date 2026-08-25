// Estado del token de Instagram Login. Founder-only.
//
//   GET                    dice si hay token, de quién es, qué permisos trae y cuándo caduca
//   GET ?refrescar=1       lo estira otros 60 días
//   GET ?borrar=1          lo tira, para volver a empezar de cero
//   GET ?tenant=<id>       las tres de arriba, pero sobre el token de ESE cliente
//   GET ?todos=1           lista los clientes con token propio y cómo van
//   GET ?refrescarTodos=1  barre todos los clientes y refresca los que pueda
//
// SIN `?tenant=` se trabaja sobre la clave global antigua, que es exactamente
// lo que hacía esta ruta antes de que esto fuera multi-cliente. Así el
// diagnóstico de la cuenta de la casa sigue funcionando igual.
//
// El token no se devuelve nunca, ni entero ni a trozos.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import {
  estadoToken,
  refrescarToken,
  refrescarTodos,
  listarTokens,
  borrarToken,
  configurado,
  credenciales,
  REDIRECT_URI,
  SCOPES,
} from "@/lib/instagram-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const q = new URL(req.url).searchParams;
  const { appId, secret } = credenciales();
  // Sin `tenant` se opera sobre la clave global de siempre.
  const tenant = q.get("tenant") || undefined;

  const entorno = {
    INSTAGRAM_APP_ID: appId ? appId : "NO PUESTA",
    INSTAGRAM_APP_SECRET: secret ? `${secret.length} caracteres (no se muestra)` : "NO PUESTA",
    redirectQueSeUsa: REDIRECT_URI,
    scopesQueSePiden: SCOPES.join(","),
  };

  if (q.get("todos") === "1") {
    const lista = await listarTokens();
    return NextResponse.json({
      veredicto: lista.length
        ? `${lista.length} cliente(s) con cuenta de Instagram propia conectada.`
        : "Ningún cliente ha conectado todavía su cuenta. Solo está el token global antiguo.",
      clientes: lista.map(({ tenantId, token }) => ({
        tenantId,
        cuenta: token?.usuario ? `@${token.usuario}` : "sin nombre",
        igUserId: token?.user_id,
        conectadoEn: token?.conectado_en,
        caduca: token?.caduca_en,
        diasQueQuedan: token?.caduca_en
          ? Math.floor((new Date(token.caduca_en).getTime() - Date.now()) / 86_400_000)
          : undefined,
        permisos: token?.permisos,
      })),
      entorno,
    });
  }

  if (q.get("refrescarTodos") === "1") {
    const r = await refrescarTodos();
    return NextResponse.json({
      veredicto:
        `${r.refrescados} de ${r.total} refrescados.` +
        (r.fallidos.length ? ` ${r.fallidos.length} fallidos (abajo el motivo de cada uno).` : ""),
      pista:
        "Meta no deja refrescar un token con menos de 24 horas de vida ni uno ya caducado. " +
        "Un token caducado obliga a que el cliente vuelva a autorizar en /api/instagram/login.",
      ...r,
      entorno,
    });
  }

  if (q.get("borrar") === "1") {
    await borrarToken(tenant);
    return NextResponse.json({
      veredicto: tenant
        ? `Token de ${tenant} borrado. Ese cliente tiene que volver a conectar en /api/instagram/login.`
        : "Token global borrado. Vuelve a empezar en /api/instagram/login.",
      entorno,
    });
  }

  if (q.get("refrescar") === "1") {
    const r = await refrescarToken(tenant);
    const e = await estadoToken(tenant);
    return NextResponse.json({
      veredicto: r.ok
        ? `Refrescado. ${e.resumen}`
        : `NO se ha podido refrescar: ${r.error}`,
      pista: r.ok
        ? undefined
        : "Meta no deja refrescar un token con menos de 24 horas de vida ni uno ya caducado. " +
          "Si está caducado, hay que repetir el login en /api/instagram/login.",
      ...e,
      entorno,
    });
  }

  const e = await estadoToken(tenant);
  return NextResponse.json({
    sobre: tenant ? `cliente ${tenant}` : "la clave global antigua (sin ?tenant=)",
    veredicto: !configurado()
      ? "Faltan INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET. Sin eso no se puede ni iniciar el login."
      : e.resumen,
    ...e,
    entorno,
    paraAutorizar: "/api/instagram/login",
    paraRefrescar: `/api/admin/instagram-token?refrescar=1${tenant ? `&tenant=${tenant}` : ""}`,
    paraEmpezarDeCero: `/api/admin/instagram-token?borrar=1${tenant ? `&tenant=${tenant}` : ""}`,
    paraVerTodos: "/api/admin/instagram-token?todos=1",
    paraRefrescarTodos: "/api/admin/instagram-token?refrescarTodos=1",
  });
}
