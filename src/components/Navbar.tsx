"use client";
import { useState } from "react";
import Logo from "./Logo";

export default function Navbar() {
  const [sectoresOpen, setSectoresOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[color:var(--cream)]/95 backdrop-blur border-b-[3px] border-black overflow-visible">
      <nav className="max-w-7xl mx-auto flex items-center justify-between gap-2 px-4 sm:px-5 py-2 overflow-visible">
        {/* Logo */}
        <a href="/" className="flex items-center shrink-0 relative z-10 overflow-hidden max-w-[55vw] sm:max-w-none" style={{ marginBottom: "-38px" }}>
          <Logo size="sm" />
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6 font-semibold text-sm uppercase tracking-wider">
          <a href="/precios" className="hover:text-[color:var(--red)] transition-colors">Precios</a>

          {/* Sectores dropdown */}
          <div className="relative">
            <button
              onClick={() => setSectoresOpen(!sectoresOpen)}
              className="flex items-center gap-1 hover:text-[color:var(--red)] transition-colors"
            >
              Sectores
              <span className="text-[10px]">▾</span>
            </button>
            {sectoresOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSectoresOpen(false)} />
                <div className="absolute top-full left-0 mt-1 bg-white border-[3px] border-black shadow-[4px_4px_0_#000] min-w-[160px] z-20">
                  <a href="/dentistas" className="flex items-center gap-2 px-4 py-2.5 text-xs hover:bg-[color:var(--mustard)] font-bold" onClick={() => setSectoresOpen(false)}>🦷 Dentistas</a>
                  <a href="/estetica" className="flex items-center gap-2 px-4 py-2.5 text-xs hover:bg-[color:var(--mustard)] font-bold border-t border-black/10" onClick={() => setSectoresOpen(false)}>✨ Clínicas Estéticas</a>
                </div>
              </>
            )}
          </div>

          <a href="/diagnostico" className="hover:text-[color:var(--red)] transition-colors">Diagnóstico</a>
          <a href="/casos" className="hover:text-[color:var(--red)] transition-colors">Casos</a>
          <a href="/blog" className="hover:text-[color:var(--red)] transition-colors">Blog</a>
          <a href="/#faq" className="hover:text-[color:var(--red)] transition-colors">FAQ</a>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-2">
          <a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" target="_blank" rel="noopener noreferrer" className="hidden sm:inline text-[10px] uppercase tracking-widest font-bold border-2 border-black px-3 py-2 hover:bg-[color:var(--mustard)] transition-colors">
            Demo
          </a>
          <a href="/login" className="hidden sm:inline text-[10px] uppercase tracking-widest font-bold border-2 border-black px-3 py-2 hover:bg-black hover:text-white transition-colors">
            Acceder
          </a>
          <a href="/reclutar" className="btn-mustard text-xs sm:text-sm px-3 sm:px-4">
            Reclutar
          </a>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden border-2 border-black p-2 hover:bg-black hover:text-white transition-colors"
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
          <a href="/precios" className="block font-bold text-sm uppercase tracking-wider hover:text-[color:var(--red)]" onClick={() => setMenuOpen(false)}>Precios</a>
          <a href="/blog" className="block font-bold text-sm uppercase tracking-wider hover:text-[color:var(--red)]" onClick={() => setMenuOpen(false)}>Blog</a>
          <a href="/reclutar" className="block font-bold text-sm uppercase tracking-wider hover:text-[color:var(--red)]" onClick={() => setMenuOpen(false)}>Reclutar</a>
          <a href="/dentistas" className="block font-bold text-sm uppercase tracking-wider hover:text-[color:var(--red)]" onClick={() => setMenuOpen(false)}>🦷 Dentistas</a>
          <a href="/estetica" className="block font-bold text-sm uppercase tracking-wider hover:text-[color:var(--red)]" onClick={() => setMenuOpen(false)}>✨ Clínicas Estéticas</a>
          <a href="/casos" className="block font-bold text-sm uppercase tracking-wider hover:text-[color:var(--red)]" onClick={() => setMenuOpen(false)}>Casos</a>
          <a href="/#faq" className="block font-bold text-sm uppercase tracking-wider hover:text-[color:var(--red)]" onClick={() => setMenuOpen(false)}>FAQ</a>
          <a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" target="_blank" rel="noopener noreferrer" className="block font-bold text-sm uppercase tracking-wider hover:text-[color:var(--red)]">Demo</a>
        </div>
      )}
    </header>
  );
}
