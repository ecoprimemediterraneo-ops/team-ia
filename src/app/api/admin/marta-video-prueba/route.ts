// PRUEBA ÚNICA de punta a punta de los vídeos de Marta en producción:
// render en el VPS → MP4 en Blob → Reel publicado en la cuenta PROPIA
// (@ai.team.marketing, tenant_aiteam). Nunca en la cuenta de un cliente.
//
//   POST ?paso=generar   → genera el vídeo y deja la propuesta "pendiente" en el
//                          panel (Historial). Se puede repetir: NUNCA publica.
//   POST ?paso=publicar  → publica esa propuesta como Reel (UNA sola vez en la
//                          vida de esta ruta; ya se gastó el 30/09/2026)
//   POST ?paso=marca-salon-bella → guarda en producción los colores y la letra
//                          propios de Salón Bella (slug demo, de tenant_aiteam)
//
// Auth: Bearer MARTA_RENDER_SECRET. Publica aunque MARTA_PUBLISH_ENABLED esté
// apagado (es la prueba autorizada por Cris el 30/09/2026), pero SOLO UNA VEZ:
// si ya se publicó, devuelve el enlace de entonces y no vuelve a publicar.
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { kvGet, kvSet } from "@/lib/supabase";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";
import { getBusinessBySlug, saveBusiness } from "@/lib/booking";
import { generarVideo } from "@/lib/marta-video";
import { createProposal, findProposalById } from "@/lib/marta-proposals";
import { publishProposal } from "@/lib/marta-publish-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CLAVE = "marta-video-prueba:estado";
type Estado = { proposalId?: string; url?: string; publicado?: { igMediaId: string; permalink?: string; ts: string } };

function autorizado(req: Request): boolean {
  const s = process.env.MARTA_RENDER_SECRET || "";
  const a = req.headers.get("authorization") || "";
  const e = `Bearer ${s}`;
  return !!s && a.length === e.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(e));
}

export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const paso = q.get("paso");
  const plantilla = q.get("plantilla") === "oferta" ? "oferta" : q.get("plantilla") === "antes_despues" ? "antes_despues" : "hueco_libre";
  const estado: Estado = (await kvGet<Estado>(CLAVE)) || {};
  if (paso === "marca-salon-bella") {
    const b = await getBusinessBySlug("demo");
    if (!b || b.tenantId !== DEFAULT_TENANT_ID) return NextResponse.json({ ok: false, error: "Salón Bella (demo) no es de tenant_aiteam" });
    // Los colores salen de su logo (/img/salon-bella-logo.svg); la letra, serif como el logo.
    const marca = { fondo: "#FBF7F4", acento: "#8A5A64", texto: "#3B2A2E", tipografia: "elegante" as const };
    await saveBusiness({ ...b, marca });
    const guardado = await getBusinessBySlug("demo");
    return NextResponse.json({ ok: true, paso, marca: guardado?.marca, logoUrl: guardado?.logoUrl });
  }

  if (paso === "generar") {
    const r = await generarVideo({
      tenantId: DEFAULT_TENANT_ID, plantilla, formato: "reel", slug: "demo",
      indicaciones: "Es una demostración de Marta en la cuenta de AI-Team", baseUrl: "https://aiteam.marketing", conCaption: false,
    });
    if (!r.ok) return NextResponse.json({ ok: false, paso, error: r.detail });
    const caption = "Así monta Marta un Reel para un salón: convierte un dato real del negocio (un hueco libre de su agenda, una oferta) en texto animado a ritmo de música sobre fotos del propio negocio. Sin caras hechas con IA y sin que nadie tenga que editar.\n\nDemo con Salón Bella, nuestro salón de pruebas.\n\n#marketingparanegocios #instagramparanegocios #peluqueria #centrodeestetica #inteligenciaartificial";
    const p = await createProposal({ tenantId: DEFAULT_TENANT_ID, recipientWhatsapp: "", imageUrl: r.url, caption, mediaType: "REELS", imageSource: "video_plantilla", tema: "Vídeo · prueba", video: r.spec, regenCount: 0 });
    // Una vez publicado, generar ya no toca el estado: la prueba única no se reabre.
    if (!estado.publicado) await kvSet(CLAVE, { proposalId: p.id, url: r.url } satisfies Estado);
    return NextResponse.json({ ok: true, paso, proposalId: p.id, url: r.url, renderS: r.renderMs / 1000, duracionS: r.duracionS, costeUSD: r.costeUSD, marca: r.spec.props.marca, textos: r.spec.props.textos, fotos: r.spec.props.fotos });
  }

  if (paso === "publicar") {
    if (estado.publicado) return NextResponse.json({ ok: true, yaPublicado: true, ...estado.publicado });
    if (!estado.proposalId) return NextResponse.json({ ok: false, error: "Primero ?paso=generar" });
    const p = await findProposalById(DEFAULT_TENANT_ID, estado.proposalId);
    if (!p) return NextResponse.json({ ok: false, error: "Propuesta no encontrada" });
    const r = await publishProposal(p, { forzar: true });
    if (!r.ok) return NextResponse.json({ ok: false, paso, error: r.detail });
    await kvSet(CLAVE, { ...estado, publicado: { igMediaId: r.igMediaId, permalink: r.permalink, ts: new Date().toISOString() } } satisfies Estado);
    return NextResponse.json({ ok: true, paso, igMediaId: r.igMediaId, permalink: r.permalink });
  }
  return NextResponse.json({ ok: false, error: "?paso=generar|publicar" }, { status: 400 });
}
