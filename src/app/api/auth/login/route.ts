import { NextResponse } from "next/server";

/**
 * Endpoint deshabilitado por seguridad.
 * Antes permitía crear sesión solo con email (auth bypass total).
 * Flujo correcto: /api/auth/magic-link → email → /login/verify?token=...
 */
export async function POST() {
  return NextResponse.json(
    { error: "Usa el flujo de magic link: /login" },
    { status: 410 },
  );
}
