/**
 * Banner top global · visible en todas las páginas públicas.
 * Anuncia el estado actual del producto (beta privada).
 */
export default function BetaBanner() {
  return (
    <a
      href="/beta"
      className="block bg-black text-[color:var(--mustard)] text-center text-xs font-mono uppercase tracking-widest py-2 px-4 hover:bg-[color:var(--mustard)] hover:text-black transition-colors border-b-2 border-[color:var(--mustard)]"
    >
      <span className="hidden sm:inline">🔒 BETA PRIVADA MÁLAGA · 50 PLAZAS · 6 MESES GRATIS · SIN PERMANENCIA ·</span>
      <span className="sm:hidden">🔒 BETA · 50 PLAZAS · 6 MESES GRATIS ·</span>
      <span className="ml-2 font-bold underline">Solicitar plaza →</span>
    </a>
  );
}
