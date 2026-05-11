import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t-[3px] border-black bg-[color:var(--cream)] py-10">
      <div className="max-w-6xl mx-auto px-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <Logo size="sm" />
        <p className="text-sm text-black/60">© {new Date().getFullYear()} AI-Team · Hecho desde España, para todo el mundo hispano</p>
        <div className="flex gap-5 text-sm font-semibold uppercase tracking-wider">
          <a href="/legal/privacidad" className="hover:text-[color:var(--mustard)]">Privacidad</a>
          <a href="/legal/terminos" className="hover:text-[color:var(--mustard)]">Términos</a>
          <a href="mailto:ecoprimemediterraneo@gmail.com" className="hover:text-[color:var(--mustard)]">Contacto</a>
        </div>
      </div>
    </footer>
  );
}
