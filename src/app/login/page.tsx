import Logo from "@/components/Logo";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import { verifyLogin } from "@/lib/credentials";
import { traductor, idiomaDe, conIdioma, type Idioma } from "@/lib/idioma";
import { destinoSeguro, PARAM_VOLVER } from "@/lib/volver";

// EL LOGIN DEVUELVE A DONDE ESTABAS.
//
// Antes acababa siempre en `/dashboard` pelado. Con el panel en inglés y en una
// pestaña concreta —que es como se graba el vídeo del App Review de Meta— eso
// significaba que cerrar sesión y volver a entrar te dejaba en la portada y en
// castellano, y había que rehacer la navegación en cámara.
//
// Ahora el destino viaja en `?volver=` y se comprueba con la MISMA función que
// usa el selector de cuenta (`@/lib/volver`). Sin parámetro, todo sigue igual.
//
// La pantalla habla el idioma de `?lang=`. Aquí sí se puede leer directamente
// de `searchParams` porque esto es una página, no un layout.

/**
 * El origen de esta petición, para comprobar el `?volver=` contra él.
 *
 * Hace falta la URL real y no una inventada: la comprobación rechaza destinos
 * de otro dominio comparando orígenes, y con una base falsa un enlace a ese
 * dominio falso pasaría el filtro.
 */
async function origenDeLaPeticion(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Acceso por usuario + contraseña. Verifica la credencial (bcrypt) y crea la sesión.
async function loginAction(formData: FormData) {
  "use server";
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  // El idioma y el destino viajan con el formulario: si el usuario se equivoca
  // de contraseña, la pantalla de error tiene que salir en el mismo idioma y
  // seguir sabiendo a dónde iba.
  const lang = idiomaDe(String(formData.get("lang") || ""));
  const volverCrudo = String(formData.get(PARAM_VOLVER) || "");
  const destino = destinoSeguro(volverCrudo, await origenDeLaPeticion());

  /** Vuelve al login conservando idioma y destino. Nunca retorna: `redirect` lanza. */
  const alLogin = (error: string): never => {
    const q = new URLSearchParams({ error });
    if (lang === "en") q.set("lang", "en");
    if (volverCrudo) q.set(PARAM_VOLVER, volverCrudo);
    redirect(`/login?${q.toString()}`);
  };

  if (!username || !password) return alLogin("faltan");

  const cred = await verifyLogin(username, password);
  if (!cred) return alLogin("bad");

  await getUser(cred.email);
  await createSession(cred.email);
  // El idioma no se pega al destino aquí: ya viene dentro de `volver` si estaba
  // en la URL de origen. Pegarlo otra vez duplicaría el parámetro.
  redirect(destino);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; volver?: string; lang?: string; caducada?: string }>;
}) {
  const { error, volver, lang, caducada } = await searchParams;
  const idioma: Idioma = idiomaDe(lang);
  const t = traductor(idioma);
  // Se guarda tal cual para devolverlo al formulario; quien decide si vale es
  // `destinoSeguro`, y lo hace al redirigir, no al pintar.
  const volverCrudo = volver || "";

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10 bg-[color:var(--cream)]">
      <div className="card-hard p-8 max-w-sm w-full">
        <div className="mb-6"><Logo size="md" /></div>
        <h1 className="font-stencil text-3xl mb-2">{t("login_titulo")}</h1>
        <p className="text-sm text-black/60 mb-6">{t("login_sub")}</p>

        {/* Solo cuando se venía de una pantalla del panel: explica por qué se
            está aquí y promete la vuelta, que es justo lo que ahora se cumple. */}
        {caducada === "1" && (
          <div className="bg-[color:var(--mustard)]/20 border-2 border-black p-3 mb-4 text-sm">
            {t("login_sesion_caducada")}
          </div>
        )}

        {error === "bad" && (
          <div className="bg-[color:var(--red)]/10 border-2 border-[color:var(--red)] p-3 mb-4 text-sm text-[color:var(--red)]">
            {t("login_err_bad")}
          </div>
        )}
        {error === "faltan" && (
          <div className="bg-[color:var(--red)]/10 border-2 border-[color:var(--red)] p-3 mb-4 text-sm text-[color:var(--red)]">
            {t("login_err_faltan")}
          </div>
        )}

        <form action={loginAction} className="flex flex-col gap-3">
          {/* El destino y el idioma acompañan al envío: la server action corre en
              el servidor y no ve la barra de direcciones del navegador. */}
          <input type="hidden" name={PARAM_VOLVER} value={volverCrudo} />
          <input type="hidden" name="lang" value={idioma} />
          <input
            type="text"
            name="username"
            required
            autoComplete="username"
            placeholder={t("login_usuario")}
            className="card-hard px-4 py-3 font-semibold focus:outline-none"
          />
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder={t("login_password")}
            className="card-hard px-4 py-3 font-semibold focus:outline-none"
          />
          <button type="submit" className="btn-mustard">{t("login_entrar")}</button>
        </form>

        <p className="text-[10px] text-black/40 mt-4 leading-relaxed text-center">
          {t("login_legal_1")}{" "}
          <a href={conIdioma("/legal/terminos", idioma)} className="underline hover:text-black">
            {t("login_legal_terminos")}
          </a>{" "}
          {t("login_legal_y")}{" "}
          <a href={conIdioma("/legal/privacidad", idioma)} className="underline hover:text-black">
            {t("login_legal_privacidad")}
          </a>.
        </p>

        <div className="mt-6 pt-6 border-t-2 border-black/10 text-center">
          <p className="text-[10px] text-black/50">{t("login_sectores")}</p>
        </div>

        <a href={conIdioma("/", idioma)} className="block mt-6 text-xs text-black/60 underline text-center">
          {t("login_volver_inicio")}
        </a>
      </div>
    </main>
  );
}
