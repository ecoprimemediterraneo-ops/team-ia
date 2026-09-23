// LEADS Y VALORACIONES — la pestaña propia de estética, la que dental no
// tiene y no necesita.
//
// En dental el paciente ya sabe que viene y lo único que falta es ponerle
// hora. Aquí no: alguien pregunta por Instagram o por WhatsApp, hay que
// cualificarle y llevarle a una valoración presencial. Ese recorrido es lo que
// se ve aquí, y lo que hasta ahora se perdía en el hilo del chat.
//
// Los datos salen de `estetica-leads.ts` (módulo nuevo, tenant-aislado y con
// candado). NO de `pipeline.ts`, que es el CRM comercial de AI-Team para
// captar clientes de AI-Team: otro dominio, no se toca.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import {
  listarLeads,
  leadsCalientesSinContestar,
  diasAbierto,
  HORAS_SIN_CONTESTAR,
} from "@/lib/estetica-leads";
import ColaLeads, { type LeadEnPantalla } from "@/components/estetica/ColaLeads";

export const dynamic = "force-dynamic";

function horasDesde(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / 3_600_000);
}

export default async function LeadsValoracionesPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();

  if (ctx.perfil.id !== "estetica") {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Leads y valoraciones</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">Esta pantalla es para clínicas estéticas.</div>
      </div>
    );
  }

  const [leads, calientes] = await Promise.all([
    listarLeads(ctx.tenantId),
    leadsCalientesSinContestar(ctx.tenantId),
  ]);
  // Quién cuenta como "sin contestar" lo decide `estetica-leads.ts`, no esta
  // pantalla: así el banner de Hoy, el número de la pestaña y esta lista dicen
  // exactamente lo mismo.
  const sinContestar = new Set(calientes.map((l) => l.id));

  const enPantalla: LeadEnPantalla[] = leads.map((l) => ({
    id: l.id,
    nombre: l.nombre,
    telefono: l.telefono,
    instagram: l.instagram,
    tratamientoInteres: l.tratamientoInteres,
    estado: l.estado,
    caliente: l.caliente,
    motivoCaliente: l.motivoCaliente,
    nota: l.nota,
    diasAbierto: diasAbierto(l),
    horasEsperando: horasDesde(l.ultimoContactoEn || l.creadoEn),
    sinContestar: sinContestar.has(l.id),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-stencil text-3xl md:text-4xl leading-none">Leads y valoraciones</h1>
        <p className="text-sm text-black/60 mt-1">
          {calientes.length > 0
            ? `${calientes.length} ${calientes.length === 1 ? "lead caliente lleva" : "leads calientes llevan"} más de ${HORAS_SIN_CONTESTAR} h sin respuesta.`
            : "Ningún lead caliente pendiente de contestar."}
        </p>
      </div>
      <ColaLeads leads={enPantalla} />
    </div>
  );
}
