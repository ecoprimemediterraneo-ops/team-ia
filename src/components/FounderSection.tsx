// Sección "Quién está detrás" — estilo dossier militar coherente con el sitio.
// El texto de la bio está pendiente de rellenar por el fundador (ver TODO).
export default function FounderSection() {
  return (
    <section id="quien-esta-detras" className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-4xl mx-auto px-5">
        <div className="flex items-center gap-2 mb-8 text-[10px] font-mono tracking-[0.2em]">
          <span className="bg-black text-[color:var(--mustard)] px-3 py-1 font-bold">EXPEDIENTE</span>
          <span className="border border-black/30 px-3 py-1 text-black/50">QUIÉN ESTÁ DETRÁS</span>
        </div>

        <div className="dossier p-6 md:p-8 flex flex-col sm:flex-row items-start gap-6">
          {/* Foto placeholder cuadrada */}
          <div className="relative w-40 h-40 border-[3px] border-black shrink-0 bg-[color:var(--mustard)] overflow-hidden">
            <span className="absolute inset-0 flex items-center justify-center font-stencil text-6xl text-black/80">
              CS
            </span>
            {/* TODO: sustituir el placeholder por la foto real de Cristóbal.
                Colocar el archivo en /public/cristobal.webp y descomentar:
                <img src="/cristobal.webp" alt="Cristóbal Serrano"
                     className="absolute inset-0 w-full h-full object-cover" /> */}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono tracking-[0.25em] text-black/40 mb-1">FUNDADOR</div>
            <h2 className="font-stencil text-4xl md:text-5xl mb-3">Cristóbal Serrano</h2>
            {/* TODO: reemplazar esta bio placeholder por el texto real (2-3 líneas). */}
            <p className="text-base text-black/70 leading-relaxed max-w-xl">
              Fundador de AI-Team. [BIO PENDIENTE — 2-3 líneas: quién soy, por qué construyo
              esto, qué problema de las PYMES quiero resolver con un equipo de agentes IA.]
            </p>
            <p className="mt-4 font-stencil text-lg tracking-wide">Hecho en Málaga 🇪🇸</p>
          </div>
        </div>
      </div>
    </section>
  );
}
