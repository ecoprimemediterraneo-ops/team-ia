// Asignar a un tenant SU número de WhatsApp (el emisor de Meta) y el WhatsApp de
// su dueño. Toda la lógica de "no pisar a otro tenant" vive aquí, no en las
// rutas, para poder probarla sin levantar nada.
//
// Por qué importa el choque: `resolveTenantFromMeta` recorre los tenants y
// devuelve el PRIMERO cuyo `whatsappPhoneNumberId` coincide. Si dos tenants
// tuvieran el mismo, ganaría uno por orden de lectura —nadie lo ha decidido— y
// los mensajes (y el historial) de un negocio acabarían en la cuenta de otro.

import { listTenants, getTenant, upsertTenant, DEFAULT_TENANT_ID, type Tenant } from "./tenants";
import { esTelefonoFicticio } from "./telefonos-demo";

export type Resultado<T> = { ok: true; valor: T; aviso?: string } | { ok: false; status: number; error: string };

const soloDigitos = (t: string) => (t || "").replace(/\D/g, "");

/** Deja un teléfono como lo espera Meta: solo dígitos, con prefijo de país, sin "+". */
export function normalizarWhatsapp(entrada: string): string | null {
  let d = soloDigitos(entrada);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9 && /^[67]/.test(d)) d = "34" + d; // móvil español sin prefijo
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

/** Enseña solo el principio y el final: la URL de administración no debe repetir el número entero. */
export function enmascarar(n?: string): string | null {
  if (!n) return null;
  return n.length <= 6 ? "•••" : `${n.slice(0, 3)}${"•".repeat(n.length - 5)}${n.slice(-2)}`;
}

export async function fijarOwnerWhatsapp(tenantId: string, numero: string | null): Promise<Resultado<Tenant>> {
  const t = await getTenant(tenantId);
  if (!t) return { ok: false, status: 404, error: `No existe el tenant "${tenantId}".` };
  if (numero === null) {
    const { ownerWhatsapp: _fuera, ...resto } = t;
    return { ok: true, valor: await upsertTenant(resto as Tenant) };
  }
  const n = normalizarWhatsapp(numero);
  if (!n) return { ok: false, status: 400, error: "Ese número no vale: pon solo dígitos con prefijo de país, p.ej. 34600000000." };
  const actualizado = await upsertTenant({ ...t, ownerWhatsapp: n });
  return {
    ok: true,
    valor: actualizado,
    ...(esTelefonoFicticio(n) ? { aviso: "Es un número de demostración: el freno de envío lo bloqueará, no recibirá nada." } : {}),
  };
}

export async function asignarNumeroWhatsapp(
  tenantId: string,
  phoneNumberId: string,
  wabaId?: string,
): Promise<Resultado<Tenant>> {
  const pid = (phoneNumberId || "").trim();
  const waba = (wabaId || "").trim();
  if (!/^\d{8,20}$/.test(pid)) return { ok: false, status: 400, error: "El identificador del número (phone_number_id) son solo dígitos, entre 8 y 20." };
  if (waba && !/^\d{8,20}$/.test(waba)) return { ok: false, status: 400, error: "El identificador de la cuenta (WABA) son solo dígitos, entre 8 y 20." };
  if (tenantId === DEFAULT_TENANT_ID) {
    return { ok: false, status: 400, error: `"${DEFAULT_TENANT_ID}" es la cuenta propia de AI-Team: su número se reconcilia solo con WHATSAPP_PHONE_NUMBER_ID y no se toca desde aquí.` };
  }
  const t = await getTenant(tenantId);
  if (!t) return { ok: false, status: 404, error: `No existe el tenant "${tenantId}".` };

  // El choque: ese número ya es de OTRO tenant.
  const otros = (await listTenants()).filter((x) => x.id !== tenantId && x.whatsappPhoneNumberId === pid);
  if (otros.length) {
    return { ok: false, status: 409, error: `Ese número ya está asignado a "${otros[0].id}". No se ha cambiado nada: dos tenants con el mismo número mezclarían sus conversaciones.` };
  }
  // Y tampoco puede ser el de la cuenta propia, aunque el tenant fundador no lo tenga guardado.
  if (process.env.WHATSAPP_PHONE_NUMBER_ID && pid === process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return { ok: false, status: 409, error: "Ese es el número de AI-Team (WHATSAPP_PHONE_NUMBER_ID). No se puede asignar a un cliente." };
  }
  const actualizado = await upsertTenant({
    ...t,
    whatsappPhoneNumberId: pid,
    ...(waba ? { whatsappBusinessAccountId: waba } : {}),
  });
  return { ok: true, valor: actualizado };
}

export async function quitarNumeroWhatsapp(tenantId: string): Promise<Resultado<Tenant>> {
  if (tenantId === DEFAULT_TENANT_ID) return { ok: false, status: 400, error: "La cuenta propia de AI-Team no se toca desde aquí." };
  const t = await getTenant(tenantId);
  if (!t) return { ok: false, status: 404, error: `No existe el tenant "${tenantId}".` };
  const { whatsappPhoneNumberId: _a, whatsappBusinessAccountId: _b, ...resto } = t;
  return { ok: true, valor: await upsertTenant(resto as Tenant) };
}
