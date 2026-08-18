// Manda a autorizar en Instagram. Founder-only.
//
// Abrir esta dirección en el navegador lleva a instagram.com, sale la pantalla
// de permisos de @ai.team.marketing, y al aceptar vuelve a /api/instagram/callback.
//
// El `state` es una cadena al azar que se guarda en una cookie y se comprueba a
// la vuelta. Sin eso, cualquiera podría hacerte abrir una vuelta con SU código y
// acabaríamos guardando el token de otra cuenta como si fuera el nuestro.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { configurado, credenciales, urlDeAutorizacion, REDIRECT_URI, SCOPES, COOKIE_STATE } from "@/lib/instagram-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!configurado()) {
    return NextResponse.json(
      {
        veredicto: "FALTAN CREDENCIALES. No se puede ni empezar el login.",
        falta: [
          credenciales().appId ? null : "INSTAGRAM_APP_ID",
          credenciales().secret ? null : "INSTAGRAM_APP_SECRET",
        ].filter(Boolean),
        ojo:
          "NO son el App ID ni el App Secret de Meta. Son los de Instagram, que salen en " +
          "App Dashboard > Instagram > API setup with Instagram login. Son números y cadenas distintos.",
        redirectQueUsaria: REDIRECT_URI,
      },
      { status: 400 },
    );
  }

  const state = crypto.randomUUID();

  // SameSite=Lax y no Strict: la vuelta la manda instagram.com, y con Strict la
  // cookie no viajaría en esa navegación. Entonces el callback vería un `state`
  // que no cuadra y culparía a un ataque que no existe.
  const seguro = REDIRECT_URI.startsWith("https://") ? " Secure;" : "";

  return NextResponse.redirect(urlDeAutorizacion(state), {
    status: 302,
    headers: {
      "Set-Cookie": `${COOKIE_STATE}=${state}; HttpOnly;${seguro} SameSite=Lax; Path=/; Max-Age=600`,
      "x-scopes-pedidos": SCOPES.join(","),
    },
  });
}
