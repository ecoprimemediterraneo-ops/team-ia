// El calendario del mes vive ahora DENTRO del panel de Marta, en la pestaña
// "Calendario" (/dashboard/marta). Esta ruta suelta se conserva por si alguien
// tiene el enlace guardado, pero redirige al panel con esa pestaña abierta,
// para que haya una sola fuente de verdad y ninguna URL huérfana.
//
// ARRASTRA `?lang=en`. Sin eso, quien llegase por esta ruta con el panel en
// inglés aterrizaba en el castellano — y esto es justo una de las pantallas que
// se graban para el App Review de Meta.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MartaCalendarioMesPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams({ tab: "calendario" });
  if (sp?.lang === "en") q.set("lang", "en");
  redirect(`/dashboard/marta?${q.toString()}`);
}
