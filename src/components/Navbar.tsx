"use client";
import { useState } from "react";
import Logo from "./Logo";

const SECTORES = [
  { href: "/dentistas", label: "Dentistas", emoji: "🦷" },
  { href: "/estetica", label: "Clínicas Estéticas", emoji: "✨" },
  { href: "/peluquerias", label: "Peluquerías", emoji: "💇" },
  { href: "/restaurantes", label: "Restaurantes", emoji: "🍽️" },
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

          {/* Sectores dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSectoresOpen((v) => !v)}
              className="flex items-center gap-1 hover:text-[color:var(--red)] transition-colors"
              aria-haspopup="true"
              aria-expanded={sectoresOpen}
            >
              Sectores
              <span className="text-[10px]">▾</span>
            </button>
            {sectoresOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setSectoresOpen(false)}
                />
                <div className="absolute top-full left-0 mt-1 bg-white border-[3px] border-black shadow-[4px_4px_0_#000] min-w-[200px] z-20">
                  {SECTORES.map((s, i) => (
                    <a
                      key={s.href}
                      href={s.href}
                      className={`flex items-center gap-2 px-4 py-2.5 text-xs hover:bg-[color:var(--mustard)] font-bold ${
                        i > 0 ? "border-t border-black/10" : ""
                      }`}
                      onClick={() => setSectoresOpen(false)}
                    >
                      <span>{s.emoji}</span>
                      <span>{s.label}</span>
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>

          <a href="/diagnostico" className="hover:text-[color:var(--red)] transition-colors">
            Diagnóstico
          </a>
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

        {/* CTA — solo "Acceder" destacado */}
        <div className="flex items-center gap-2">
          <a
            href="/login"
            className="btn-mustard text-xs sm:text-sm px-3 sm:px-4 hidden sm:inline-block"
          >
            Acceder
          </a>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden border-2 border-black p-2 hover:bg-black hover:text-white transition-colors"
            aria-label="Abrir menú"
          >
            <span className="block w-4 h-0.5 bg-current mb-1"></span>
            <span className="block w-4 h-0.5 bg-current mb-1"></span>
            <span className="block w-4 h-0.5 bg-current"></span>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t-[3px] border-black bg-[color:var(--cream)] px-4 py-4 space-y-3">
          <a
            href="/precios"
            className="block font-bold text-sm uppercase tracking-wider hover:text-[color:var(--red)]"
            onClick={() => setMenuOpen(false)}
          >
            Precios
          </a>
          <a
            href="/diagnostico"
            className="block font-bold text-sm uppercase tracking-wider hover:text-[color:var(--red)]"
            onClick={() => setMenuOpen(false)}
          >
            Diagnóstico
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
              Sectores
            </div>
            {SECTORES.map((s) => (
              <a
                key={s.href}
                href={s.href}
                className="block font-bold text-sm uppercase tracking-wider hover:text-[color:var(--red)]"
                onClick={() => setMenuOpen(false)}
              >
                {s.emoji} {s.label}
              </a>
            ))}
          </div>
          <a
            href="/login"
            className="btn-mustard inline-block text-sm mt-3"
            onClick={() => setMenuOpen(false)}
          >
            Acceder
          </a>
        </div>
      )}
    </header>
  );
}
