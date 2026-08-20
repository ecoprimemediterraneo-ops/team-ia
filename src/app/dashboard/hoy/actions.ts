"use server";

import { revalidatePath } from "next/cache";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { apuntarTarea, marcarHecho, marcarUrgente, borrarTarea } from "@/lib/gestoria-hoy";

async function quien() {
  const s = await getSessionLocal();
  if (!s) return null;
  const ctx = await contextoPanelODefecto();
  if (!tieneFuncion(ctx.sector, "estadoExpediente")) return null;
  return ctx.tenantId;
}

const refrescar = () => { revalidatePath("/dashboard/hoy"); revalidatePath("/dashboard"); };

export async function apuntar(datos: { titulo: string; detalle?: string; vence?: string; clienteNombre?: string; urgente?: boolean }) {
  const t = await quien();
  if (!t) return { ok: false as const, error: "Sin permiso." };
  if (!datos.titulo?.trim()) return { ok: false as const, error: "Escribe qué hay que hacer." };
  await apuntarTarea(t, {
    titulo: datos.titulo,
    detalle: datos.detalle,
    vence: datos.vence || null,
    clienteNombre: datos.clienteNombre || null,
    urgente: datos.urgente,
  });
  refrescar();
  return { ok: true as const };
}

export async function hecho(id: string, valor: boolean) {
  const t = await quien();
  if (!t) return { ok: false as const };
  await marcarHecho(t, id, valor);
  refrescar();
  return { ok: true as const };
}

export async function urgente(id: string, valor: boolean) {
  const t = await quien();
  if (!t) return { ok: false as const };
  await marcarUrgente(t, id, valor);
  refrescar();
  return { ok: true as const };
}

export async function borrar(id: string) {
  const t = await quien();
  if (!t) return { ok: false as const };
  await borrarTarea(t, id);
  refrescar();
  return { ok: true as const };
}
