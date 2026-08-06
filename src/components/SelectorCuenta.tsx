// Selector de cuenta de la cabecera del panel. Solo lo ve el fundador.
//
// POR QUÉ EXISTE: cambiar de cuenta ya se podía, pero únicamente escribiendo a mano
// /admin/ver-panel/<tenant> o pasando por /admin/sectores, que no está enlazada desde
// el panel. Desde /dashboard no había forma de saber siquiera que se podía cambiar:
// los rótulos "PANEL" y "TU CUENTA" de la portada son texto, no botones.
//
// Sin JavaScript a propósito: es un <details> con enlaces normales. El destino es un
// route handler que pone una cookie y redirige, así que necesita navegación completa
// del navegador —no la del router de Next—, y con <a href> nativo eso sale gratis.

import { listTenants, DEFAULT_TENANT_ID } from "@/lib/tenants";
import { resolverSector, getPerfilSector } from "@/lib/sectores";

export default async function SelectorCuenta({
  tenantIdActual,
  mirandoOtro,
}: {
  tenantIdActual: string;
  /** true si se está viendo otra cuenta por la cookie de suplantación. */
  mirandoOtro: boolean;
}) {
  const tenants = await listTenants();
  // Con una sola cuenta no hay nada que elegir: el selector sobraría.
  if (tenants.length < 2) return null;

  const actual = tenants.find((t) => t.id === tenantIdActual);
  const nombre = (t: (typeof tenants)[number]) => t.ficha?.nombreNegocio || t.name || t.id;

  // La fundadora primero y el resto por nombre: es la que más se busca.
  const ordenados = [...tenants].sort((a, b) => {
    if (a.id === DEFAULT_TENANT_ID) return -1;
    if (b.id === DEFAULT_TENANT_ID) return 1;
    return nombre(a).localeCompare(nombre(b), "es");
  });

  const etiquetaSector = (t: (typeof tenants)[number]) => {
    const sector = resolverSector(t);
    return sector ? getPerfilSector(sector).label : "AI-Team";
  };

  return (
    <details className="relative">
      <summary
        className="list-none cursor-pointer select-none text-xs font-mono uppercase tracking-widest border-2 border-black px-2 py-1 hover:bg-black hover:text-white max-w-[9.5rem] sm:max-w-none truncate"
        title="Cambiar de cuenta"
      >
        {mirandoOtro && <span aria-hidden="true">👁 </span>}
        {actual ? nombre(actual) : "Cuenta"} ▾
      </summary>

      {/* `right-0` para que no se salga por la derecha en móvil, que es donde vive. */}
      <div className="absolute right-0 z-50 mt-1 w-64 max-h-[70vh] overflow-y-auto card-hard bg-white p-1">
        <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-black/50">
          Cambiar de cuenta
        </div>
        {ordenados.map((t) => {
          const esActual = t.id === tenantIdActual;
          return (
            // <a> nativo y no <Link>: ver-panel es un route handler que pone una cookie
            // y redirige, así que hace falta navegación completa del navegador.
            <a
              key={t.id}
              href={`/admin/ver-panel/${t.id}`}
              aria-current={esActual ? "true" : undefined}
              className={`block px-2 py-1.5 text-xs leading-tight hover:bg-[color:var(--mustard)] ${esActual ? "bg-black text-white" : ""}`}
            >
              <span className="block font-bold truncate">{nombre(t)}</span>
              <span className={`block text-[10px] font-mono truncate ${esActual ? "text-white/70" : "text-black/50"}`}>
                {etiquetaSector(t)}
                {t.id === DEFAULT_TENANT_ID ? " · fundadora" : ""}
              </span>
            </a>
          );
        })}
        {mirandoOtro && (
          /* eslint-disable-next-line @next/next/no-html-link-for-pages -- igual que arriba. */
          <a
            href="/admin/ver-panel/propio"
            className="block mt-1 border-t-2 border-black px-2 py-1.5 text-xs font-bold hover:bg-[color:var(--mustard)]"
          >
            ← Volver a mi cuenta
          </a>
        )}
      </div>
    </details>
  );
}
