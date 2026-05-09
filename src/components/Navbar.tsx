import Logo from "./Logo";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 bg-[color:var(--cream)]/90 backdrop-blur border-b-[3px] border-black">
      <nav className="max-w-7xl mx-auto flex items-center justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4">
        <a href="#top" className="flex items-center shrink-0">
          <Logo size="sm" />
        </a>
        <div className="hidden md:flex items-center gap-7 font-semibold text-sm uppercase tracking-wider">
          <a href="#equipo" className="hover:text-[color:var(--red)]">La unidad</a>
          <a href="#dia" className="hover:text-[color:var(--red)]">Un día</a>
          <a href="#packs" className="hover:text-[color:var(--red)]">Packs</a>
          <a href="#faq" className="hover:text-[color:var(--red)]">FAQ</a>
        </div>
        <div className="flex items-center gap-2">
          <a href="/login" className="text-[10px] sm:text-xs uppercase tracking-widest font-bold border-2 border-black px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-black hover:text-white">Acceder</a>
          <a href="#waitlist" className="btn-mustard text-xs sm:text-sm px-3 sm:px-4">Reclutar</a>
        </div>
      </nav>
    </header>
  );
}
