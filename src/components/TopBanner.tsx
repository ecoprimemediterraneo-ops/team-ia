// Tira superior pegada al top — visible siempre, antes del Navbar.
// Comunica la oferta beta en cuanto el usuario entra.

export default function TopBanner() {
  return (
    <a
      href="/beta"
      className="block bg-[color:var(--red)] text-white text-center py-2 px-4 text-[11px] sm:text-xs font-mono font-bold tracking-widest uppercase hover:bg-black transition-colors border-b-2 border-black"
    >
      🔒 50 PLAZAS BETA · 6 MESES GRATIS · SIN PERMANENCIA — Reservar plaza →
    </a>
  );
}
