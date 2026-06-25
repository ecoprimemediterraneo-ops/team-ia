"use client";
import { useState } from "react";
import Logo from "./Logo";

// Menú "PYMEs". Clínicas y Dentistas tienen landing propia; Abogados y
// Estudios (arquitectura) aún NO tienen página → apuntan a /beta (pide demo).
const PYMES = [
  { href: "/estetica", label: "Clínicas", emoji: "🩺" },
  { href: "/beta", label: "Abogados", emoji: "⚖️" },
  { href: "/dentistas", label: "Dentistas", emoji: "🦷" },
  { href: "/beta", label: "Estudios", emoji: "📐" },
];

export default function Navbar() {
  const [sectoresOpen, setSectoresOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[color:var(--cream)]/95 backdrop-blur border-b-[3px] border-black overflow-visible">
      <nav className="max-w-7xl mx-auto flex items-center justify-between gap-2 px-4 sm:px-5 py-2 overflow-visible">
        {/* Logo */}
        <a
          href="/"
          className="flex items-center shrink-0 relative z-10 overflow-hidden max-w-[55vw] sm:max-w-none"
          style={{ marginBottom: "-38px" }}
        >
          <Logo size="sm" />
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6 font-semibold text-sm uppercase tracking-wider">
          <a href="/precios" className="hover:text-[color:var(--red)] transition-colors">
            Precios
          </a>

          {/* PYMEs dropdown (hover + click, sin overlay bloqueante) */}
          <div
            className="relative group"
            onMouseEnter={() => setSectoresOpen(true)}
            onMouseLeave={() => setSectoresOpen(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSectoresOpen((v) => !v);
              }}
              className="flex items-center gap-1 hover:text-[color:var(--red)] transition-colors py-2"
              aria-haspopup="true"
              aria-expanded={sectoresOpen}
            >
              PYMEs
              <span aria-hidden="true" className="text-[10px]">▾</span>
            </button>
            <div
              className={`absolute top-full left-0 bg-white border-[3px] border-black shadow-[4px_4px_0_#000] min-w-[220px] z-[100] transition-opacity duration-100 ${
                sectoresOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
              }`}
            >
              {PYMES.map((s, i) => (
                <a
                  key={s.label}
                  href={s.href}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs hover:bg-[color:var(--mustard)] font-bold ${
                    i > 0 ? "border-t border-black/10" : ""
                  }`}
                  onClick={() => setSectoresOpen(false)}
                >
                  <span aria-hidden="true">{s.emoji}</span>
                  <span>{s.label}</span>
                </a>
              ))}
            </div>
          </div>

          <a href="/casos" className="hover:text-[color:var(--red)] transition-colors">
            Casos
          </a>
          <a href="/blog" className="hover:text-[color:var(--red)] transition-colors">
            Blog
          </a>
          <a href="/#faq" className="hover:text-[color:var(--red)] transition-colors">
            FAQ
          </a>
        </div>

        {/* CTA — primaria "Pide tu demo"; "Acceder" como enlace secundario */}
        <div className="flex items-center gap-3">
          <a
            href="/login"
            className="hidden sm:inline-block text-sm font-semibold uppercase tracking-wider hover:text-[color:var(--red)] transition-colors"
          >
            Acceder
          </a>
          <a href="/beta" className="btn-mustard text-xs sm:text-sm px-3 sm:px-4">
            Pide tu demo
          </a>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden border-2 border-black p-2 hover:bg-black hover:text-white transition-colors"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <span className="block w-4 h-0.5 bg-current mb-1"></span>
            <span className="block w-4 h-0.5 bg-current mb-1"></span>
            <span className="block w-4 h-0.5 bg-current"></span>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div id="mobile-menu" className="md:hidden border-t-[3px] border-black bg-[color:var(--cream)] px-4 py-4 space-y-3">
          <a
            href="/precios"
            className="block font-bold text-sm uppercase tracking-wider hover:text-[color:var(--red)]"
            onClick={() => setMenuOpen(false)}
          >
            Precios
          </a>
          <a
            href="/casos"
            className="block font-bold text-sm uppercase tracking-wider hover:text-[color:var(--red)]"
            onClick={() => setMenuOpen(false)}
          >
            Casos
          </a>
          <a
            href="/blog"
            className="block font-bold text-sm uppercase tracking-wider hover:text-[color:var(--red)]"
            onClick={() => setMenuOpen(false)}
          >
            Blog
          </a>
          <a
            href="/#faq"
            className="block font-bold text-sm uppercase tracking-wider hover:text-[color:var(--red)]"
            onClick={() => setMenuOpen(false)}
          >
            FAQ
          </a>
          <div className="pt-3 border-t border-black/20 space-y-2">
            <div className="text-[10px] font-mono tracking-widest text-black/40 uppercase">
              PYMEs
            </div>
            {PYMES.map((s) => (
              <a
                key={s.label}
                href={s.href}
                className="block font-bold text-sm uppercase tracking-wider hover:text-[color:var(--red)]"
                onClick={() => setMenuOpen(false)}
              >
                {s.emoji} {s.label}
              </a>
            ))}
          </div>
          <div className="pt-3 border-t border-black/20 flex flex-col gap-2">
            <a
              href="/beta"
              className="btn-mustard inline-block text-sm text-center"
              onClick={() => setMenuOpen(false)}
            >
              Pide tu demo
            </a>
            <a
              href="/login"
              className="block text-sm font-semibold uppercase tracking-wider hover:text-[color:var(--red)]"
              onClick={() => setMenuOpen(false)}
            >
              Acceder
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
