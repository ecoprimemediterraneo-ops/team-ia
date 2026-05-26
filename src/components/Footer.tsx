import Logo from "./Logo";
import NewsletterSignup from "./NewsletterSignup";

export default function Footer() {
  return (
    <footer className="border-t-[3px] border-black bg-[color:var(--cream)] pt-12 pb-8">
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid md:grid-cols-[1.2fr_1fr_1fr_1fr] gap-10 mb-10">
          <div>
            <Logo size="sm" />
            <p className="text-sm text-black/70 mt-4 max-w-xs">
              Sistema operativo de empleados IA para PYMES. Desde 89€/mes.
            </p>
          </div>

          <div>
            <h4 className="font-stencil text-xl mb-3">Producto</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/agentes" className="hover:text-[color:var(--red)]">Agentes</a></li>
              <li><a href="/precios" className="hover:text-[color:var(--red)]">Precios</a></li>
              <li><a href="/demo" className="hover:text-[color:var(--red)]">Demo</a></li>
              <li><a href="/reclutar" className="hover:text-[color:var(--red)]">Reclutar</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-stencil text-xl mb-3">Recursos</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/blog" className="hover:text-[color:var(--red)]">Blog</a></li>
              <li><a href="/casos" className="hover:text-[color:var(--red)]">Casos</a></li>
              <li><a href="/dentistas" className="hover:text-[color:var(--red)]">Dentistas</a></li>
              <li><a href="/estetica" className="hover:text-[color:var(--red)]">Estética</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-stencil text-xl mb-3">Newsletter</h4>
            <p className="text-xs text-black/60 mb-3">Un email al mes, sin spam.</p>
            <NewsletterSignup />
          </div>
        </div>

        <div className="border-t border-black/20 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-black/60">© {new Date().getFullYear()} AI-Team · Hecho en España para el mundo hispano</p>
          <div className="flex gap-5 text-xs font-semibold uppercase tracking-wider">
            <a href="/legal/privacidad" className="hover:text-[color:var(--red)]">Privacidad</a>
            <a href="/legal/terminos" className="hover:text-[color:var(--red)]">Términos</a>
            <a href="mailto:ecoprimemediterraneo@gmail.com" className="hover:text-[color:var(--red)]">Contacto</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
