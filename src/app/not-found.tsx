import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="flex-1 flex items-center justify-center py-20">
        <div className="max-w-2xl mx-auto px-5 text-center">
          <div className="font-stencil text-[120px] md:text-[200px] leading-none text-[color:var(--red)]">404</div>
          <h1 className="font-stencil text-3xl md:text-5xl mb-4">Agente no encontrado</h1>
          <p className="text-lg text-black/70 mb-8">
            Esta página no existe. O la borramos. O nunca existió. Carmen no contesta este número.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/" className="btn-mustard">VOLVER AL INICIO →</Link>
            <Link href="/agentes" className="border-[3px] border-black px-5 py-3 font-bold uppercase tracking-widest text-sm hover:bg-black hover:text-[color:var(--mustard)]">
              Ver agentes
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
