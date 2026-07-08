// ⚠️ SEGURIDAD — LOGIN SIN VERIFICACIÓN (TEMPORAL)
// -----------------------------------------------------------------------------
// Hoy, con LOGIN_REQUIRE_MAGIC_LINK apagado, este endpoint crea una sesión con
// SOLO el email (sin probar posesión) → cualquiera podría suplantar a cualquiera,
// incluido el founder. Es un agujero conocido que se mantiene abierto mientras la
// beta lo necesite, PERO ya queda estructurado para el corte:
//
//   La verificación REAL ya existe en el repo:
//     - `crearMagicLink(email)` (src/lib/magic-link.ts) → token de un solo uso, 15 min.
//     - `/login` (server action en src/app/login/page.tsx) → genera y ENVÍA el enlace
//       por Resend a `${SITE_URL}/login/verify?token=…`.
//     - `/login/verify` → consume el token y crea la sesión (path seguro).
//
// TODO(seguridad): activar LOGIN_REQUIRE_MAGIC_LINK=1 en producción. En ese modo,
//   este endpoint NO crea sesión: genera el magic link y lo envía (reutilizar el
//   envío de `loginAction` en login/page.tsx, idealmente extraído a un helper
//   `enviarMagicLink(email, origin)` en magic-link.ts). Cuando esté validado en
//   prod, ELIMINAR la rama de acceso directo de abajo.
// -----------------------------------------------------------------------------
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import { crearMagicLink } from "@/lib/magic-link";

const schema = z.object({ email: z.string().email() });

// Interruptor del corte: cuando esté a "1", el login exige verificación por magic
// link (no crea sesión directa). Por defecto apagado para no romper el acceso actual.
const REQUIRE_MAGIC_LINK = process.env.LOGIN_REQUIRE_MAGIC_LINK === "1";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  const email = parsed.data.email;
  await getUser(email);

  if (REQUIRE_MAGIC_LINK) {
    // PATH SEGURO — NO crea sesión aquí. Genera un enlace de verificación de un solo
    // uso; el acceso solo se concede tras abrirlo en /login/verify.
    const link = await crearMagicLink(email);
    // TODO(seguridad): enviar `${origin}/login/verify?token=${link.token}` por email
    //   (Resend), reutilizando el envío de la server action `loginAction`. De momento
    //   solo se genera el token; el correo se engancha al activar el flag en prod.
    void link;
    return NextResponse.json({ ok: true, verification: "magic_link" });
  }

  // ⚠️ PATH TEMPORAL INSEGURO — acceso directo sin verificar. Sustituir por el path
  // seguro de arriba (activando REQUIRE_MAGIC_LINK) antes de abrir el registro real.
  await createSession(email);
  return NextResponse.json({ ok: true, verification: "none_insecure" });
}
