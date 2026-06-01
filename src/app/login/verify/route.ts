// Route Handler — verifica el magic link y crea la sesión.
// En Next.js 16 las cookies solo se pueden setear desde Server Actions o
// Route Handlers; por eso este endpoint vive como `route.ts` y no como `page.tsx`.

import { NextResponse, type NextRequest } from "next/server";
import { consumirMagicLink } from "@/lib/magic-link";
import { createSession } from "@/lib/auth";
import { getUser } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorPage(mensaje: string) {
  // HTML mínimo de error, coherente con el resto del estilo
  return new NextResponse(
    `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Acceso no válido · AI-Team</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#FAF7F0;color:#0A0A0A;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px 20px;margin:0}
  .card{max-width:420px;width:100%;background:#fff;border:3px solid #000;box-shadow:8px 8px 0 #000;padding:32px;text-align:center}
  h1{font-size:24px;margin:0 0 12px;letter-spacing:-0.5px}
  p{font-size:14px;color:#555;margin:0 0 24px;line-height:1.5}
  a.btn{display:inline-block;background:#F5C518;color:#000;text-decoration:none;padding:12px 24px;font-weight:700;letter-spacing:1px;border:3px solid #000;box-shadow:4px 4px 0 #000}
</style></head>
<body><div class="card">
  <h1>🔒 Acceso no válido</h1>
  <p>${mensaje}</p>
  <a class="btn" href="/login">VOLVER AL LOGIN →</a>
</div></body></html>`,
    { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return errorPage("Enlace inválido. Solicita uno nuevo.");

  const link = await consumirMagicLink(token);
  if (!link) {
    return errorPage(
      "Este enlace ya se ha usado o ha caducado. Solicita uno nuevo.",
    );
  }

  await getUser(link.email);
  await createSession(link.email);

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
