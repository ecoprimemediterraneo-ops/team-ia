import { redirect } from "next/navigation";
import { consumirMagicLink } from "@/lib/magic-link";
import { createSession } from "@/lib/auth";
import { getUser } from "@/lib/store";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const sp = await searchParams;
  const token = sp.token;

  if (!token) {
    return (
      <Error mensaje="Enlace inválido. Solicita uno nuevo." />
    );
  }

  const link = await consumirMagicLink(token);
  if (!link) {
    return (
      <Error mensaje="Este enlace ya se ha usado o ha caducado. Solicita uno nuevo." />
    );
  }

  await getUser(link.email);
  await createSession(link.email);
  redirect("/dashboard");
}

function Error({ mensaje }: { mensaje: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10 bg-[color:var(--cream)]">
      <div className="card-hard p-8 max-w-sm w-full text-center">
        <h1 className="font-stencil text-2xl mb-3">🔒 Acceso no válido</h1>
        <p className="text-sm text-black/70 mb-6">{mensaje}</p>
        <a href="/login" className="btn-mustard inline-block">Volver al login</a>
      </div>
    </main>
  );
}
