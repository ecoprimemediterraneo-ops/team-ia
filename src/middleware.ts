import { NextRequest, NextResponse } from "next/server";

const COOKIE = "aiteam-variant";
const VARIANTS = ["A", "B"] as const;

/**
 * Cabeceras de seguridad aplicadas a TODAS las respuestas.
 */
function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  return res;
}

export function middleware(req: NextRequest) {
  // A/B test cookie solo en home
  if (req.nextUrl.pathname === "/") {
    const existing = req.cookies.get(COOKIE)?.value;
    if (existing !== "A" && existing !== "B") {
      const variant = VARIANTS[Math.random() < 0.5 ? 0 : 1];
      const res = NextResponse.next();
      res.cookies.set({
        name: COOKIE,
        value: variant,
        path: "/",
        maxAge: 60 * 60 * 24 * 90,
        sameSite: "lax",
      });
      return applySecurityHeaders(res);
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  // Aplica a todo excepto assets estáticos y API routes que necesitan headers propios
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|mp4|webm)$).*)"],
};
