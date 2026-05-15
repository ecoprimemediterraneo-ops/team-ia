import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { posts, postBySlug } from "@/lib/blog";
import type { Metadata } from "next";

export async function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = postBySlug[slug];
  if (!post) return { title: "Artículo no encontrado" };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `https://aiteam.marketing/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = postBySlug[slug];
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: { "@type": "Organization", name: "AI-Team" },
    publisher: { "@type": "Organization", name: "AI-Team", url: "https://aiteam.marketing" },
    mainEntityOfPage: `https://aiteam.marketing/blog/${post.slug}`,
  };

  return (
    <>
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="flex-1 py-16">
        <article className="max-w-3xl mx-auto px-5">
          <Link href="/blog" className="text-xs font-mono text-black/50 hover:text-[color:var(--red)] uppercase tracking-widest">
            ← Volver al blog
          </Link>

          <div className="flex items-center gap-3 mt-6 mb-4 text-xs font-mono">
            <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">{post.category}</span>
            <span className="text-black/50">{post.readingTime}</span>
            <span className="text-black/50">·</span>
            <span className="text-black/50">{new Date(post.date).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}</span>
          </div>

          <h1 className="font-stencil text-3xl md:text-5xl mb-6 leading-tight">{post.title}</h1>
          <p className="text-lg text-black/70 mb-10 leading-relaxed">{post.excerpt}</p>

          <div className="blog-body text-base leading-relaxed space-y-4">
            <ReactMarkdown
              components={{
                h2: ({ children }) => <h2 className="font-stencil text-2xl mt-10 mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="font-bold text-lg mt-6 mb-2">{children}</h3>,
                p: ({ children }) => <p className="leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-6 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-6 space-y-1">{children}</ol>,
                strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                code: ({ children }) => <code className="bg-black/5 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
              }}
            >{post.body}</ReactMarkdown>
          </div>

          <div className="mt-16 card-hard p-6 bg-[color:var(--mustard)] text-center">
            <h3 className="font-stencil text-2xl mb-3">¿Quieres esto en tu negocio?</h3>
            <p className="text-sm mb-5">14 días gratis. Sin tarjeta. Sin permanencia.</p>
            <Link href="/reclutar" className="btn-mustard bg-black text-[color:var(--mustard)] hover:bg-[color:var(--red)] hover:text-white inline-block">
              ACTIVAR MI EQUIPO →
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
