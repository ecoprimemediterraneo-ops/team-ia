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
      replyTo: process.env.RESEND_REPLY_TO || "hola@aiteam.marketing",
      subject: "Tu enlace de acceso (válido 15 minutos)",
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;color:#0A0A0A">
          <p style="font-size:16px;line-height:1.6;margin:0 0 16px">Hola,</p>
          <p style="font-size:16px;line-height:1.6;margin:0 0 24px">Has pedido entrar a tu cuenta de AI-Team. Confirma tu acceso desde el siguiente enlace:</p>
          <p style="margin:24px 0">
            <a href="${url}" style="display:inline-block;background:#0A0A0A;color:#ffffff;text-decoration:none;padding:14px 24px;font-weight:600;border-radius:6px">Entrar en mi cuenta</a>
          </p>
          <p style="font-size:14px;line-height:1.6;color:#555;margin:0 0 16px">O copia y pega esta dirección en tu navegador:</p>
          <p style="font-size:13px;line-height:1.5;color:#0A0A0A;word-break:break-all;margin:0 0 24px"><a href="${url}" style="color:#0A0A0A">${url}</a></p>
          <p style="font-size:13px;line-height:1.6;color:#666;margin:0 0 8px">Este enlace caduca en 15 minutos y solo puede usarse una vez.</p>
          <p style="font-size:13px;line-height:1.6;color:#666;margin:0 0 24px">Si no has solicitado este acceso, puedes ignorar este mensaje. Nadie podrá entrar sin abrirlo.</p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
          <p style="font-size:12px;line-height:1.5;color:#888;margin:0">AI-Team · aiteam.marketing<br>¿Dudas? Responde a este correo.</p>
        </div>
      `,
      text:
        `Hola,\n\nHas pedido entrar a tu cuenta de AI-Team.\n\n` +
        `Confirma tu acceso abriendo este enlace (válido 15 minutos, un solo uso):\n${url}\n\n` +
        `Si no has solicitado este acceso, ignora este mensaje.\n\n` +
        `— AI-Team · aiteam.marketing`,
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
        <h1 className="font-stencil text-3xl mb-2">Accede a tu cuenta</h1>
        <p className="text-sm text-black/60 mb-6">Accede con tu email. Te enviamos un enlace seguro para entrar sin contraseñas.</p>

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

        {/* Trust strip — solo info verificable */}
        <div className="mt-6 pt-6 border-t-2 border-black/10 text-center">
          <p className="text-[10px] text-black/50">
            Clínicas dentales · estéticas · peluquerías · restaurantes
          </p>
        </div>

        <a href="/" className="block mt-6 text-xs text-black/60 underline text-center">← Volver al inicio</a>
      </div>
    </main>
  );
}
