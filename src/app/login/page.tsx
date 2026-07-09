import Logo from "@/components/Logo";
import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import { verifyLogin } from "@/lib/credentials";

// Acceso por usuario + contraseña. Verifica la credencial (bcrypt) y crea la sesión.
async function loginAction(formData: FormData) {
  "use server";
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  if (!username || !password) redirect("/login?error=faltan");

  const cred = await verifyLogin(username, password);
  if (!cred) redirect("/login?error=bad");

  await getUser(cred.email);
  await createSession(cred.email);
  redirect("/dashboard");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10 bg-[color:var(--cream)]">
      <div className="card-hard p-8 max-w-sm w-full">
        <div className="mb-6"><Logo size="md" /></div>
        <h1 className="font-stencil text-3xl mb-2">Accede a tu cuenta</h1>
        <p className="text-sm text-black/60 mb-6">Introduce tu usuario y contraseña.</p>

        {error === "bad" && (
          <div className="bg-[color:var(--red)]/10 border-2 border-[color:var(--red)] p-3 mb-4 text-sm text-[color:var(--red)]">
            Usuario o contraseña incorrectos.
          </div>
        )}
        {error === "faltan" && (
          <div className="bg-[color:var(--red)]/10 border-2 border-[color:var(--red)] p-3 mb-4 text-sm text-[color:var(--red)]">
            Rellena usuario y contraseña.
          </div>
        )}

        <form action={loginAction} className="flex flex-col gap-3">
          <input
            type="text"
            name="username"
            required
            autoComplete="username"
            placeholder="Usuario"
            className="card-hard px-4 py-3 font-semibold focus:outline-none"
          />
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="Contraseña"
            className="card-hard px-4 py-3 font-semibold focus:outline-none"
          />
          <button type="submit" className="btn-mustard">ENTRAR →</button>
        </form>

        <p className="text-[10px] text-black/40 mt-4 leading-relaxed text-center">
          Al continuar aceptas nuestros{" "}
          <a href="/legal/terminos" className="underline hover:text-black">Términos</a> y nuestra{" "}
          <a href="/legal/privacidad" className="underline hover:text-black">Política de Privacidad</a>.
        </p>

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
