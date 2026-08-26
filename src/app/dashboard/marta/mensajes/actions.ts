"use server";

// Enviar un DM de Instagram a mano desde la bandeja.
//
// El tenant sale de la sesión, nunca del formulario: si viajara en un campo
// oculto, cualquiera podría mandar mensajes desde la cuenta de otro cliente.

import { revalidatePath } from "next/cache";
import { resolverContextoPanel } from "@/lib/panel-contexto";
import { enviarDmManual } from "@/lib/marta-inbox";
// El tipo y la constante viven en `estado.ts`: un fichero "use server" SOLO
// puede exportar funciones async, y exportar un objeto desde aquí tumbaba todas
// las server actions de /dashboard/marta. Ver el comentario de `estado.ts`.
import type { EstadoEnvio } from "./estado";

export async function enviarDmAction(_previo: EstadoEnvio, formData: FormData): Promise<EstadoEnvio> {
  const ctx = await resolverContextoPanel();
  if (!ctx) return { estado: "error", codigo: "sesion", motivo: "Tu sesión ha caducado. Vuelve a entrar." };

  const igsid = String(formData.get("igsid") ?? "");
  const texto = String(formData.get("texto") ?? "");
  if (!igsid) return { estado: "error", codigo: "sin_destino", motivo: "No se sabe a quién enviar." };

  const r = await enviarDmManual(ctx.tenantId, igsid, texto);
  revalidatePath("/dashboard/marta");

  return r.ok ? { estado: "ok" } : { estado: "error", codigo: r.codigo, motivo: r.motivo };
}
