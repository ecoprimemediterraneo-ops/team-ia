// /dashboard/marta/conectar → la pestaña "Empezar cuenta" del panel de Marta.
//
// El contenido se mudó a `BloqueConectar`, que ahora vive dentro de esa pestaña:
// conectar la cuenta es el paso cero y estaba escondido en una pantalla suelta.
//
// LA RUTA NO SE BORRA, Y NO ES POR NOSTALGIA. Es a donde vuelve el OAuth:
// `REDIRECT_URI` está dada de alta letra por letra en el panel de Meta, y el
// callback redirige aquí. Cambiar el destino en el código sin cambiarlo en Meta
// —o al revés— rompe el login y el fallo aparece en el canje, que es donde nadie
// lo busca. Así que la ruta sigue viva y reenvía a la pestaña, arrastrando los
// parámetros: el cliente aterriza viendo el banner de éxito o de error sin dar
// un clic más.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ConectarInstagramPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; cuenta?: string; error?: string; lang?: string }>;
}) {
  const sp = await searchParams;

  const q = new URLSearchParams({ tab: "arranque" });
  if (sp?.ok) q.set("ok", sp.ok);
  if (sp?.cuenta) q.set("cuenta", sp.cuenta);
  if (sp?.error) q.set("error", sp.error);
  if (sp?.lang === "en") q.set("lang", "en");

  redirect(`/dashboard/marta?${q.toString()}`);
}
