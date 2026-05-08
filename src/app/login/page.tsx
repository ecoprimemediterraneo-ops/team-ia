import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import Logo from "@/components/Logo";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").trim();
  if (!email || !email.includes("@")) return;
  await getUser(email);
  await createSession(email);
  redirect("/dashboard");
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10 bg-[color:var(--cream)]">
      <div className="card-hard p-8 max-w-sm w-full">
        <div className="mb-6"><Logo size="md" /></div>
        <h1 className="font-stencil text-3xl mb-2">Acceso a tu unidad</h1>
        <p className="text-sm text-black/60 mb-6">Solo email. Sin contraseñas. Es una demo, lo afinamos en producción.</p>
        <form action={loginAction} className="flex flex-col gap-3">
          <input
            type="email"
            name="email"
            required
            placeholder="tu@correo.com"
            className="card-hard px-4 py-3 font-semibold focus:outline-none"
          />
          <button type="submit" className="btn-mustard">ENTRAR</button>
        </form>
        <a href="/" className="block mt-6 text-xs text-black/60 underline">← Volver al inicio</a>
      </div>
    </main>
  );
}
