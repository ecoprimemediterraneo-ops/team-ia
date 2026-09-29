// POST /api/carmen/entrante — "Inbound call webhook" de Retell.
//
// Retell lo llama AL DESCOLGAR, antes de que Carmen diga nada, y aquí se le
// dan las variables de ESA llamada: de qué negocio es (por el número al que se
// ha llamado), cómo saluda, el móvil del dueño para pasar urgencias y las
// palabras de urgencia de ese negocio. El prompt del agente en Retell usa
// {{saludo}}, {{negocio}}, {{movil_dueno}}, {{palabras_urgencia}},
// {{direccion}}, {{horario}}, {{servicios}}, {{telefono_negocio}} — todo sale de
// la ficha del negocio de agenda, nunca de textos fijos (ver docs/carmen-retell.md).
//
// Carmen se presenta SIEMPRE como asistente virtual, y si le preguntan si es
// una persona lo dice claro: no lo es.
import { NextResponse } from "next/server";
import { resolverSalonDeLlamada } from "@/lib/carmen-salon";
import { getBusinessBySlug } from "@/lib/booking";
import { getTenant, agenteContratado } from "@/lib/tenants";
import { configCarmen } from "@/lib/carmen-llamadas";
import { carmenAutorizada } from "@/lib/carmen-auth";
import { horarioHablado, serviciosHablados } from "@/lib/persona";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (carmenAutorizada(req) !== "ok") return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { call_inbound?: { to_number?: string; from_number?: string } };
  const to = body.call_inbound?.to_number;
  const salon = await resolverSalonDeLlamada(undefined, to);
  const negocio = salon.ok ? await getBusinessBySlug(salon.slug) : null;
  const tenant = salon.ok ? await getTenant(salon.tenantId) : null;
  const nombre = negocio?.nombre || tenant?.name || "el negocio";
  const activa = salon.ok ? await agenteContratado(salon.tenantId, "carmen") : false;
  return NextResponse.json({
    call_inbound: {
      dynamic_variables: {
        negocio: nombre,
        saludo: `Hola, soy Carmen, la asistente virtual de ${nombre}. ¿En qué te puedo ayudar?`,
        saludo_en: `Hi, I'm Carmen, the virtual assistant at ${nombre}. How can I help you?`,
        es_asistente_virtual: "sí: si preguntan si eres una persona, di claramente que eres una asistente virtual",
        movil_dueno: tenant?.ownerWhatsapp ? `+${tenant.ownerWhatsapp.replace(/\D/g, "")}` : "",
        palabras_urgencia: configCarmen(tenant).urgencias.join(", "),
        direccion: negocio?.direccion || "",
        horario: horarioHablado(negocio?.horario),
        servicios: serviciosHablados(negocio).join("; "),
        telefono_negocio: negocio?.telefono || "",
        slug: salon.ok ? salon.slug : "",
        carmen_activa: activa ? "sí" : "no",
      },
    },
  });
}
