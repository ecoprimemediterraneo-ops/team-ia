// Estado del token de Instagram Login. Founder-only.
//
//   GET               dice si hay token, de quién es, qué permisos trae y cuándo caduca
//   GET ?refrescar=1  lo estira otros 60 días
//   GET ?borrar=1     lo tira, para volver a empezar de cero
//
// El token no se devuelve nunca, ni entero ni a trozos.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import {
  estadoToken,
  refrescarToken,
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

  const entorno = {
    INSTAGRAM_APP_ID: appId ? appId : "NO PUESTA",
    INSTAGRAM_APP_SECRET: secret ? `${secret.length} caracteres (no se muestra)` : "NO PUESTA",
    redirectQueSeUsa: REDIRECT_URI,
    scopesQueSePiden: SCOPES.join(","),
  };

  if (q.get("borrar") === "1") {
    await borrarToken();
    return NextResponse.json({
      veredicto: "Token borrado. Vuelve a empezar en /api/instagram/login.",
      entorno,
    });
  }

  if (q.get("refrescar") === "1") {
    const r = await refrescarToken();
    const e = await estadoToken();
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

  const e = await estadoToken();
  return NextResponse.json({
    veredicto: !configurado()
      ? "Faltan INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET. Sin eso no se puede ni iniciar el login."
      : e.resumen,
    ...e,
    entorno,
    paraAutorizar: "/api/instagram/login",
    paraRefrescar: "/api/admin/instagram-token?refrescar=1",
    paraEmpezarDeCero: "/api/admin/instagram-token?borrar=1",
  });
}
