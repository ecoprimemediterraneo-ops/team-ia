// Geocodificación de direcciones con Nominatim (OpenStreetMap) — SIN API key.
// Best-effort: devuelve null si falla o tarda demasiado. Fuente única para el
// panel de config del salón y el alta/importador (mapa OSM en la ficha pública).

export async function geocodeDireccion(direccion: string): Promise<{ lat: number; lng: number } | null> {
  const q = (direccion || "").trim();
  if (!q) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(url, { headers: { "User-Agent": "AI-Team-Booking/1.0 (reservas)" }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const arr = (await r.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(arr) || !arr[0]) return null;
    const lat = parseFloat(arr[0].lat);
    const lng = parseFloat(arr[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
