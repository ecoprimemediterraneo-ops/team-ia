"use server";

// Las tres acciones de la conexión de Instagram: confirmar la cuenta elegida,
// cancelar a medias y desconectar una ya confirmada.
//
// Todas resuelven el tenant de la sesión, nunca de un parámetro: si el tenant
// viajara en el formulario, cualquiera podría desconectar la cuenta de otro
// cliente cambiando un campo oculto.

import { revalidatePath } from "next/cache";
import { resolverContextoPanel } from "@/lib/panel-contexto";
import { borrarToken, confirmarCuenta } from "@/lib/instagram-login";

function refrescarPantallas() {
  revalidatePath("/dashboard/marta");
  revalidatePath("/dashboard/marta/conectar");
}

/**
 * "Usar esta cuenta". Hasta que se pulsa, la conexión NO cuenta como hecha.
 *
 * El id de la cuenta viaja en el formulario a propósito: es lo que permite
 * comprobar que se confirma la misma cuenta que se enseñó, y no otra que haya
 * entrado por medio desde otra pestaña.
 */
export async function confirmarCuentaAction(formData: FormData): Promise<void> {
  const ctx = await resolverContextoPanel();
  if (!ctx) return;

  const userId = String(formData.get("userId") ?? "");
  const r = await confirmarCuenta(ctx.tenantId, userId);

  if (r.ok) {
    console.log(`[instagram-login] cuenta CONFIRMADA tenant=${ctx.tenantId} ig_user_id=${userId}`);
  } else {
    console.error(`[instagram-login] confirmación FALLIDA tenant=${ctx.tenantId}: ${r.error}`);
  }
  refrescarPantallas();
}

/**
 * "Elegir otra cuenta": tira la conexión a medias y deja empezar de cero.
 *
 * Borra el token en vez de dejarlo sin confirmar, porque el token pertenece a la
 * cuenta que el cliente eligió en Instagram y no se puede cambiar desde aquí:
 * para elegir otra hay que volver a pasar por el selector de Instagram.
 */
export async function cancelarSeleccionAction(): Promise<void> {
  const ctx = await resolverContextoPanel();
  if (!ctx) return;

  await borrarToken(ctx.tenantId);
  console.log(`[instagram-login] selección cancelada tenant=${ctx.tenantId}`);
  refrescarPantallas();
}

/**
 * Desconectar una cuenta ya confirmada.
 *
 * Borra SOLO la clave del tenant (`borrarToken` nunca toca la global), así que
 * un cliente que se equivoque de cuenta no puede llevarse por delante la
 * conexión de la casa.
 */
export async function desconectarInstagramAction(): Promise<void> {
  const ctx = await resolverContextoPanel();
  if (!ctx) return;

  await borrarToken(ctx.tenantId);
  console.log(`[instagram-login] cuenta desconectada tenant=${ctx.tenantId}`);
  refrescarPantallas();
}
