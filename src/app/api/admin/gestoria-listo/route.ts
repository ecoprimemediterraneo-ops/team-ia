// ¿Está el módulo de gestoría listo para enseñárselo a alguien? Founder-only.
//
// Una sola URL que contesta lo que si no hay que ir mirando de siete sitios:
// qué variables faltan, qué se enciende con cada una y qué pasa exactamente si
// no está. Sustituye a "creo que sí" por una lista.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { listTenants } from "@/lib/tenants";
import { resolverSector } from "@/lib/sectores";
import { MODELO_LECTURA } from "@/lib/gestoria-lectura";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Chequeo = {
  variable: string;
  puesta: boolean;
  enciende: string;
  siFalta: string;
};

export async function GET() {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const hay = (v?: string) => !!(v && v.length > 0);
  const encendida = (v?: string) => (v || "").toLowerCase() === "true";

  const checks: Chequeo[] = [
    {
      variable: "ANTHROPIC_API_KEY",
      puesta: hay(process.env.ANTHROPIC_API_KEY),
      enciende: `Leer facturas y listados de ventas, y las fechas límite del correo (${MODELO_LECTURA}).`,
      siFalta: "Los documentos se guardan pero no se lee ni un dato: la tarjeta sale vacía y la conciliación no tiene importes con los que cruzar.",
    },
    {
      variable: "OPENAI_API_KEY",
      puesta: hay(process.env.OPENAI_API_KEY),
      enciende: "Transcribir los audios que le manda el gestor a Pablo (Whisper).",
      siFalta: "Pablo contesta al gestor 'no he podido entender el audio, me lo escribes?'. No se pierde nada, pero el punto 6 no funciona.",
    },
    {
      variable: "GESTORIA_AVISO_DIARIO_ENABLED",
      puesta: encendida(process.env.GESTORIA_AVISO_DIARIO_ENABLED),
      enciende: "El aviso de cada mañana al gestor por WhatsApp (dos mensajes: resumen y lo que vence).",
      siFalta: "El cron calcula, escribe los dos mensajes en el log y NO manda nada. Se puede ver qué saldría sin que le llegue a nadie.",
    },
    {
      variable: "GESTORIA_ENVIO_DOCS_ENABLED",
      puesta: encendida(process.env.GESTORIA_ENVIO_DOCS_ENABLED),
      enciende: "Mandarle documentos al cliente desde el panel, a su WhatsApp.",
      siFalta: "El panel prepara el mensaje y lo enseña, pero no sale. El documento sí se guarda.",
    },
    {
      variable: "CRON_SECRET",
      puesta: hay(process.env.CRON_SECRET),
      enciende: "Que n8n pueda disparar el cron del aviso diario (no cabe en vercel.json, el plan Hobby va lleno).",
      siFalta: "La ruta del cron queda abierta a cualquiera que sepa la URL.",
    },
    {
      variable: "GESTORIA_RECLAMACION_SEND_ENABLED",
      puesta: encendida(process.env.GESTORIA_RECLAMACION_SEND_ENABLED),
      enciende: "Pedirle al cliente por WhatsApp la factura que falta, desde la conciliación.",
      siFalta: "El panel prepara el texto y lo manda el gestor a mano. Además hace falta la plantilla aprobada en Meta.",
    },
  ];

  // El móvil del gestor NO es una variable de entorno: es un campo del tenant,
  // porque cada gestoría tiene el suyo.
  const gestorias = (await listTenants().catch(() => []))
    .filter((t) => resolverSector(t) === "gestoria")
    .map((t) => ({
      id: t.id,
      nombre: t.name,
      ownerWhatsapp: t.ownerWhatsapp ?? null,
      queLeFalta: t.ownerWhatsapp
        ? null
        : "sin ownerWhatsapp: no recibe el aviso de la mañana y sus audios no se transcriben (Pablo no sabe que es el gestor)",
    }));

  const faltan = checks.filter((c) => !c.puesta).map((c) => c.variable);
  const sinDueno = gestorias.filter((g) => !g.ownerWhatsapp).map((g) => g.id);

  return NextResponse.json({
    veredicto: faltan.length || sinDueno.length
      ? `Faltan: ${[...faltan, ...sinDueno.map((g) => `${g} sin ownerWhatsapp`)].join(" · ")}`
      : "Todo puesto.",
    variables: checks,
    gestorias,
    elMovilDelGestor:
      "No es una variable de entorno. Es el campo `ownerWhatsapp` del tenant de cada gestoría, en formato E.164 sin signos (34656989373).",
    cronDelAviso: {
      url: "https://aiteam.marketing/api/cron/gestoria-aviso-diario",
      metodo: "GET",
      cabecera: "Authorization: Bearer <CRON_SECRET>",
      cuando: "una vez al día, sobre las 07:30 hora de Madrid",
      porQueN8n: "vercel.json ya tiene los 10 crons que permite el plan Hobby. Este se dispara desde fuera, como los otros cuatro.",
    },
  });
}
