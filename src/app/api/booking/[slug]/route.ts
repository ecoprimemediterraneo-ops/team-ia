// GET /api/booking/[slug] — datos públicos del negocio (mini-web Booksy):
// marca, descripción, galería, categorías y servicios activos (con variantes y
// add-ons). NO expone el email del calendario ni el padding interno.
import { NextResponse } from "next/server";
import { getBusinessBySlug } from "@/lib/booking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getBusinessBySlug(slug);
  if (!b) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const servicios = b.servicios
    .filter((s) => s.activo)
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      descripcion: s.descripcion,
      fotoUrl: s.fotoUrl,
      categoriaId: s.categoriaId,
      durationMin: s.durationMin,
      precioEUR: s.precioEUR,
      variantes: s.variantes || [],
      addons: (s.addons || []).filter((a) => a.activo).map(({ id, nombre, durationMin, precioEUR }) => ({ id, nombre, durationMin, precioEUR })),
    }));

  // Solo categorías que tienen al menos un servicio activo, en su orden.
  const usadas = new Set(servicios.map((s) => s.categoriaId).filter(Boolean));
  const categorias = b.categorias.filter((c) => usadas.has(c.id));

  // Personal activo (para elegir profesional / "cualquiera"). serviceIds = qué hace cada uno.
  const empleados = (b.empleados || [])
    .filter((e) => e.activo)
    .map((e) => ({ id: e.id, nombre: e.nombre, color: e.color, serviceIds: e.serviceIds || [] }));

  return NextResponse.json({
    ok: true,
    negocio: {
      slug: b.slug,
      nombre: b.nombre,
      descripcion: b.descripcion,
      galeria: b.galeria || [],
      direccion: b.direccion,
      lat: b.lat,
      lng: b.lng,
      telefono: b.telefono,
      instagram: b.instagram,
      horario: b.horario,
      timezone: b.timezone,
      categorias,
      servicios,
      empleados,
    },
  });
}
