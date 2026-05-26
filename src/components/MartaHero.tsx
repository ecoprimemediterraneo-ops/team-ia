"use client";

export default function MartaHero() {
  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      const btn = el.querySelector("button");
      if (btn && btn.getAttribute("aria-expanded") !== "true") (btn as HTMLButtonElement).click();
    }
  }

  const cards = [
    { id: "sec-crear", emoji: "✍️", title: "Crear un post", sub: "Texto + imagen IA" },
    { id: "sec-crear", emoji: "🎥", title: "Guion de reel", sub: "30-60 seg listos para grabar" },
    { id: "sec-comunicacion", emoji: "📥", title: "Revisar bandeja", sub: "DMs + comentarios" },
  ];

  return (
    <div className="card-hard p-5 bg-[color:var(--mustard)] border-black mt-2">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <h2 className="font-stencil text-2xl md:text-3xl leading-none">🚀 Esta semana</h2>
          <p className="text-xs font-mono text-black/70 mt-1">Empieza por aquí. Marta te lleva.</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <button
            key={c.title}
            onClick={() => scrollTo(c.id)}
            className="card-hard p-4 bg-white text-left hover:translate-y-[-2px] transition-transform"
          >
            <div className="text-3xl mb-2">{c.emoji}</div>
            <div className="font-bold text-sm mb-1">{c.title}</div>
            <div className="text-[10px] text-black/60">{c.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
