import Logo from "./Logo";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 bg-[color:var(--cream)]/90 backdrop-blur border-b-[3px] border-black">
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-5 py-4">
        <a href="#top" className="flex items-center">
          <Logo />
        </a>
        <div className="hidden md:flex items-center gap-8 font-semibold text-sm uppercase tracking-wider">
          <a href="#equipo" className="hover:text-[color:var(--red)]">La unidad</a>
          <a href="#dia" className="hover:text-[color:var(--red)]">Un día en misión</a>
          <a href="#faq" className="hover:text-[color:var(--red)]">FAQ</a>
        </div>
        <a href="#waitlist" className="btn-mustard text-sm">Reclutar</a>
      </nav>
    </header>
  );
}
