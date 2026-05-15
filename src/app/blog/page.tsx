import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { posts } from "@/lib/blog";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog — Automatización para PYMES con IA",
  description:
    "Guías prácticas sobre WhatsApp Business, reseñas Google, email marketing y automatización con IA para PYMES y autónomos.",
  alternates: { canonical: "https://aiteam.marketing/blog" },
};

export default function BlogPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-16">
        <div className="max-w-5xl mx-auto px-5">
          <div className="mb-16">
            <span className="inline-block bg-black text-[color:var(--mustard)] px-3 py-1 text-xs font-mono font-bold tracking-widest mb-4">
              CUADERNO DE CAMPO
            </span>
            <h1 className="font-stencil text-4xl md:text-6xl mb-4">Blog</h1>
            <p className="text-lg text-black/70 max-w-2xl">
              Lo que aprendemos automatizando PYMES en España. Sin humo, con números.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {posts.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="card-hard p-6 flex flex-col bg-white hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform">
                <div className="flex items-center gap-3 mb-3 text-xs font-mono">
                  <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">{p.category}</span>
                  <span className="text-black/50">{p.readingTime}</span>
                </div>
                <h2 className="font-stencil text-2xl mb-3 leading-tight">{p.title}</h2>
                <p className="text-sm text-black/70 flex-1">{p.excerpt}</p>
                <div className="mt-4 text-xs font-mono text-black/50 tracking-widest uppercase">
                  {new Date(p.date).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
