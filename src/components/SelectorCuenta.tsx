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
//
// Los enlaces sí son de cliente (`EnlaceCuenta`), y solo para una cosa: leer en qué
// pantalla estás y llevársela puesta. Apuntaban a `/admin/ver-panel/<id>` a secas y
// el route handler devolvía siempre a `/dashboard`, así que cambiar de cuenta te
// borraba el idioma y la pestaña. Ver el porqué largo en `EnlaceCuenta.tsx`.

import EnlaceCuenta from "./EnlaceCuenta";
import T from "./TextoIdioma";
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
      >
        {mirandoOtro && <span aria-hidden="true">👁 </span>}
        {actual ? nombre(actual) : "Cuenta"} ▾
      </summary>

      {/* Aquí había un `title="Cambiar de cuenta"`. Fuera: un atributo no puede
          llevar dentro una pieza de cliente, así que era la única cosa de la
          cabecera que se quedaba en castellano con `?lang=en` — y en un vídeo
          para Meta un tooltip en español es exactamente lo que no puede salir.
          No se pierde nada: el desplegable ya lo dice en su primera línea. */}

      {/* `right-0` para que no se salga por la derecha en móvil, que es donde vive. */}
      <div className="absolute right-0 z-50 mt-1 w-64 max-h-[70vh] overflow-y-auto card-hard bg-white p-1">
        <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-black/50">
          <T k="cuenta_cambiar" />
        </div>
        {ordenados.map((t) => {
          const esActual = t.id === tenantIdActual;
          return (
            <EnlaceCuenta
              key={t.id}
              tenantId={t.id}
              ariaActual={esActual}
              className={`block px-2 py-1.5 text-xs leading-tight hover:bg-[color:var(--mustard)] ${esActual ? "bg-black text-white" : ""}`}
            >
              <span className="block font-bold truncate">{nombre(t)}</span>
              <span className={`block text-[10px] font-mono truncate ${esActual ? "text-white/70" : "text-black/50"}`}>
                {etiquetaSector(t)}
                {t.id === DEFAULT_TENANT_ID ? <T k="cuenta_fundadora" /> : ""}
              </span>
            </EnlaceCuenta>
          );
        })}
        {mirandoOtro && (
          <EnlaceCuenta
            tenantId="propio"
            className="block mt-1 border-t-2 border-black px-2 py-1.5 text-xs font-bold hover:bg-[color:var(--mustard)]"
          >
            <T k="cuenta_volver" />
          </EnlaceCuenta>
        )}
      </div>
    </details>
  );
}
