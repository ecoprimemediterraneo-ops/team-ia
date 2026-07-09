// POST /api/auth/login — acceso por USUARIO + CONTRASEÑA (bcrypt).
// Body: { username, password }. Verifica contra las credenciales (src/lib/credentials.ts)
// y, si es correcto, crea la sesión JWT (cookie) mapeada al email de la credencial.
// (Sustituye al antiguo login por email/magic link, que queda fuera del flujo principal.)
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import { verifyLogin } from "@/lib/credentials";

const schema = z.object({
  username: z.string().min(1).max(80),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Solicitud no válida" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Usuario o contraseña no válidos" }, { status: 400 });
  }

  const cred = await verifyLogin(parsed.data.username, parsed.data.password);
  if (!cred) {
    return NextResponse.json({ ok: false, error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }

  await getUser(cred.email);        // asegura el registro de usuario asociado
  await createSession(cred.email);  // sesión JWT (cookie) keyed por email
  return NextResponse.json({ ok: true, role: cred.role ?? "user" });
}
