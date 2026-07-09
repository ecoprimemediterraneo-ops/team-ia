// Bloque de diferenciación (derribo) — corto y contundente, en rojo de marca.
export default function Derribo() {
  return (
    <section className="border-t-[3px] border-black bg-[color:var(--red)] text-white py-14 md:py-20">
      <div className="max-w-4xl mx-auto px-5 text-center">
        <p className="font-stencil text-2xl sm:text-3xl md:text-4xl leading-[1.15]">
          Ningún software contesta tu Instagram, atiende tus llamadas y consigue reseñas por ti.
        </p>
        <p className="mt-4 font-stencil text-2xl sm:text-3xl md:text-4xl leading-[1.15]">
          Nosotros sí, <span className="text-[color:var(--mustard)]">con una sola suscripción.</span>
        </p>
      </div>
    </section>
  );
}
