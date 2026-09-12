// De qué negocio habla un generador del panel.
//
// EL PROBLEMA QUE RESUELVE
// ------------------------
// Había DOS descripciones del mismo negocio y nadie las reconciliaba:
//
//   · la FICHA del tenant (`tenants.ficha`), que es la que usan los webhooks
//     de Pablo y Marta cuando hablan con clientes de verdad;
//   · el BRIEFING del panel (`store.ts`, indexado por email), que se rellenó
//     una vez en el onboarding y ahí se quedó.
//
// Los generadores manuales usaban el briefing. En la cuenta de AI-Team ese
// briefing era una DEMO de clínica dental de Valencia, así que al pedirle a
// Carmen un guion sobre AI-Team, el modelo tenía delante una clínica y nada
// más: de ahí salió la maquinaria de estética de 18.000 a 22.000 €.
//
// Manda la ficha. El briefing se sigue usando cuando no hay ficha —un cliente
// que hizo el onboarding y no tiene ficha no puede quedarse sin contexto—, y
// cuando la ficha viene a medias se completa con él, campo a campo.

import "server-only";
import { getUser } from "./store";
import { getFicha } from "./ficha";
import { getTenant, resolverTenantDeUsuario } from "./tenants";
import { resolverSector, type SectorNegocio } from "./sectores";
import type { BusinessProfile } from "./claude";

export type BriefingPanel = {
  business: BusinessProfile;
  tenantId: string;
  /** null = cuenta comercial de AI-Team (no es un negocio de cliente). */
  sector: SectorNegocio | null;
  /** De dónde ha salido cada cosa, para que se vea en el log y en las pruebas. */
  origen: "ficha" | "briefing" | "mezcla" | "vacio";
};

const VACIO: BusinessProfile = { nombre: "", sector: "", ofrece: "", tono: "", publico: "" };

function noVacio(s?: string | null): string {
  return (s || "").trim();
}

export async function briefingDelPanel(email: string): Promise<BriefingPanel> {
  const tenantId = await resolverTenantDeUsuario(email);
  const [tenant, ficha, user] = await Promise.all([
    getTenant(tenantId),
    getFicha(tenantId),
    getUser(email).catch(() => null),
  ]);

  const sector = tenant ? resolverSector(tenant) : null;
  const delBriefing = user?.business;

  const deLaFicha: BusinessProfile | null = ficha
    ? {
        nombre: noVacio(ficha.nombreNegocio),
        sector: [noVacio(ficha.sector), noVacio(ficha.ciudad)].filter(Boolean).join(" · "),
        ofrece: (ficha.serviciosClave || []).filter(Boolean).join(", "),
        tono: noVacio(ficha.tono),
        publico: noVacio(ficha.publicoObjetivo),
      }
    : null;

  if (!deLaFicha && !delBriefing) {
    return { business: VACIO, tenantId, sector, origen: "vacio" };
  }
  if (!deLaFicha) {
    return { business: delBriefing!, tenantId, sector, origen: "briefing" };
  }

  // Ficha primero; los huecos los tapa el briefing.
  const business: BusinessProfile = {
    nombre: deLaFicha.nombre || noVacio(delBriefing?.nombre),
    sector: deLaFicha.sector || noVacio(delBriefing?.sector),
    ofrece: deLaFicha.ofrece || noVacio(delBriefing?.ofrece),
    tono: deLaFicha.tono || noVacio(delBriefing?.tono),
    publico: deLaFicha.publico || noVacio(delBriefing?.publico),
  };

  const tapado = Object.keys(business).some(
    (k) => !deLaFicha[k as keyof BusinessProfile] && business[k as keyof BusinessProfile],
  );
  return { business, tenantId, sector, origen: tapado ? "mezcla" : "ficha" };
}

/** El contexto en una línea, tal como lo esperaban los generadores. */
export function contextoEnUnaLinea(b: BusinessProfile): string {
  if (!b.nombre && !b.sector) return "Negocio sin briefing configurado.";
  const partes = [`Negocio: ${b.nombre}${b.sector ? ` — ${b.sector}` : ""}.`];
  if (b.ofrece) partes.push(`Ofrecemos: ${b.ofrece}.`);
  if (b.publico) partes.push(`Público objetivo: ${b.publico}.`);
  if (b.tono) partes.push(`Tono: ${b.tono}.`);
  return partes.join(" ");
}
