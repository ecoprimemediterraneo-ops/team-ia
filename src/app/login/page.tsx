import Logo from "@/components/Logo";
import { crearMagicLink } from "@/lib/magic-link";
import { getResend, RESEND_FROM } from "@/lib/resend";
import { redirect } from "next/navigation";

const SITE_URL = process.env.PUBLIC_URL || "https://aiteam.marketing";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    redirect("/login?error=invalid");
  }

  const link = await crearMagicLink(email);
  const url = `${SITE_URL}/login/verify?token=${link.token}`;

  // En desarrollo, imprime en consola para poder probar
  if (!process.env.VERCEL) {
    console.log("\n🪄 MAGIC LINK (dev):", url, "\n");
  }

  // Intentar enviar email (si falla, seguir igual: usuario recibe enlace por consola en dev)
  try {
    const resend = getResend();
    await resend.emails.send({
      from: RESEND_FROM,
      to: email,
      subject: "Tu enlace de acceso a AI-Team",
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;color:#0A0A0A">
          <div style="border:3px solid #000;box-shadow:6px 6px 0 #000;padding:32px;background:#FAF7F0">
            <h1 style="font-size:28px;margin:0 0 16px;letter-spacing:-1px">Tu acceso a AI-Team</h1>
            <p style="font-size:16px;line-height:1.5;color:#444">Haz click en el botón para entrar a tu unidad. El enlace caduca en 15 minutos.</p>
            <p style="margin:32px 0">
              <a href="${url}" style="display:inline-block;background:#F5C518;color:#000;text-decoration:none;padding:16px 28px;font-weight:800;letter-spacing:2px;border:3px solid #000;box-shadow:4px 4px 0 #000">ENTRAR EN AI-TEAM →</a>
            </p>
            <p style="font-size:12px;color:#888;margin-top:32px;border-top:1px solid #ddd;padding-top:16px">
              Si no has solicitado este acceso, ignora este email. Nadie podrá entrar sin abrir este enlace.
            </p>
          </div>
          <p style="font-size:11px;color:#999;text-align:center;margin-top:16px;letter-spacing:1px">AI-TEAM · AITEAM.MARKETING</p>
        </div>
      `,
      text: `Tu acceso a AI-Team\n\nAbre este enlace (caduca en 15 min):\n${url}\n\nSi no lo solicitaste, ignora este email.`,
    });
  } catch (e) {
    console.error("[login] error enviando email:", e);
  }

  redirect(`/login?sent=${encodeURIComponent(email)}`);
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  const sent = sp.sent;
  const error = sp.error;

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10 bg-[color:var(--cream)]">
      <div className="card-hard p-8 max-w-sm w-full">
        <div className="mb-6"><Logo size="md" /></div>
        <h1 className="font-stencil text-3xl mb-2">Acceso a tu unidad</h1>
        <p className="text-sm text-black/60 mb-6">Login sin contraseñas. Te enviamos un enlace mágico a tu email para entrar.</p>

        {sent ? (
          <div className="bg-[color:var(--mustard)]/30 border-2 border-black p-4 mb-4">
            <div className="font-bold mb-1">📬 Revisa tu correo</div>
            <p className="text-sm">Te hemos enviado un enlace a <strong>{sent}</strong>. Caduca en 15 minutos.</p>
            <p className="text-xs text-black/60 mt-2">¿No lo ves? Mira en spam o vuelve a intentarlo.</p>
          </div>
        ) : (
          <>
            {error === "invalid" && (
              <div className="bg-[color:var(--red)]/10 border-2 border-[color:var(--red)] p-3 mb-4 text-sm text-[color:var(--red)]">
                Email no válido. Revisa el formato.
              </div>
            )}
            <form action={loginAction} className="flex flex-col gap-3">
              <input
                type="email"
                name="email"
                required
                placeholder="tu@correo.com"
                className="card-hard px-4 py-3 font-semibold focus:outline-none"
              />
              <button type="submit" className="btn-mustard">ENVIAR ENLACE →</button>
            </form>
          </>
        )}

        {/* Texto legal */}
        <p className="text-[10px] text-black/40 mt-4 leading-relaxed text-center">
          Al continuar aceptas nuestros{" "}
          <a href="/legal/terminos" className="underline hover:text-black">Términos</a> y nuestra{" "}
          <a href="/legal/privacidad" className="underline hover:text-black">Política de Privacidad</a>.
        </p>

        {/* Trust banner */}
        <div className="mt-6 pt-6 border-t-2 border-black/10 text-center">
          <div className="flex items-center justify-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <span key={s} className="text-[color:var(--mustard)] text-lg">★</span>
            ))}
          </div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-black/60">
            50 plazas beta · 6 meses gratis · sin permanencia
          </p>
          <p className="text-[10px] text-black/40 mt-1">
            Clínicas dentales · estéticas · peluquerías · restaurantes
          </p>
        </div>

        <a href="/" className="block mt-6 text-xs text-black/60 underline text-center">← Volver al inicio</a>
      </div>
    </main>
  );
}
