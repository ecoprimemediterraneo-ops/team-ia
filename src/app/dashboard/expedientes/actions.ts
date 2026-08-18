"use server";

// Dar de alta un expediente desde el panel.
//
// FALTABA, y no era un detalle: los clientes de una gestoría SALEN de sus
// expedientes (`gestoria-clientes.ts` los deduce del teléfono), así que sin esta
// pantalla una gestoría recién dada de alta no tiene ni un cliente al que
// asignar una factura. El panel enseñaba los expedientes pero no dejaba crear
// ninguno: los que había estaban metidos a mano en el fichero de datos.
//
// El teléfono es la clave. Es con lo que el cliente escribe por WhatsApp y con
// lo que se le reconoce cuando manda una factura, así que se guarda en dígitos y
// sin nada más, igual que hace `clienteIdDeTelefono`.

import { revalidatePath } from "next/cache";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import {
  listarExpedientes,
  guardarExpedientes,
  tramiteById,
  type Expediente,
  type EstadoExpediente,
  type TramiteId,
} from "@/lib/gestoria";

export type ResultadoAlta = { ok: true; id: string } | { ok: false; error: string };

export async function crearExpediente(datos: {
  clienteNombre: string;
  telefono: string;
  tramite: string;
  estado: string;
  periodo?: string;
  vence?: string;
  documentos?: string;
}): Promise<ResultadoAlta> {
  const s = await getSessionLocal();
  if (!s) return { ok: false, error: "Sin sesión." };

  const ctx = await contextoPanelODefecto();
  if (!tieneFuncion(ctx.sector, "estadoExpediente")) {
    return { ok: false, error: "Esta cuenta no es una gestoría." };
  }

  const nombre = (datos.clienteNombre || "").trim();
  const telefono = (datos.telefono || "").replace(/\D/g, "");
  if (!nombre) return { ok: false, error: "Falta el nombre del cliente." };
  if (telefono.length < 9) {
    return { ok: false, error: "El teléfono no parece válido. Es la clave con la que el cliente escribe por WhatsApp." };
  }
  if (!tramiteById(datos.tramite)) return { ok: false, error: "Ese trámite no existe." };

  const estados: EstadoExpediente[] = ["recibido", "esperando_documentacion", "en_curso", "presentado", "cerrado"];
  const estado = estados.includes(datos.estado as EstadoExpediente)
    ? (datos.estado as EstadoExpediente)
    : "recibido";

  const ahora = new Date().toISOString();
  const id = `gx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const docs = (datos.documentos || "")
    .split("\n")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((nombreDoc, i) => ({ id: `${id}_d${i}`, nombre: nombreDoc, recibido: false }));

  const nuevo: Expediente = {
    id,
    tenantId: ctx.tenantId,
    telefono,
    clienteNombre: nombre,
    tramite: datos.tramite as TramiteId,
    estado,
    periodo: (datos.periodo || "").trim() || undefined,
    documentos: docs,
    vence: (datos.vence || "").trim() || undefined,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };

  const lista = await listarExpedientes(ctx.tenantId);
  await guardarExpedientes(ctx.tenantId, [...lista, nuevo]);

  // La lista de clientes de facturas sale de aquí: si no se refresca, el gestor
  // da de alta al cliente y sigue sin verlo en el desplegable de asignar.
  revalidatePath("/dashboard/expedientes");
  revalidatePath("/dashboard/facturas");
  revalidatePath("/dashboard/seguimiento");

  return { ok: true, id };
}
