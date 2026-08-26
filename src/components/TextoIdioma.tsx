"use client";

// El idioma del panel, leído desde la URL, para las piezas de CLIENTE.
//
// POR QUÉ HACE FALTA ESTO Y NO BASTA CON `searchParams`
// -----------------------------------------------------
// El resto del panel recibe el idioma como prop desde su `page.tsx`, que sí lee
// `searchParams`. Pero la barra lateral no vive en una página: vive en
// `layout.tsx`, y en el App Router **un layout no recibe `searchParams`**. Como
// las piezas del lateral ya eran de cliente para saber qué pestaña está activa,
// leen el idioma de la URL ellas mismas.
//
// Y ADEMÁS ARRASTRAN EL PARÁMETRO. Cada enlace del lateral apuntaba a una ruta
// pelada, así que al pinchar cualquiera de ellos se perdía `?lang=en` y el panel
// volvía al español a mitad de grabación. `conIdioma()` lo pega a cada destino.

import { useSearchParams } from "next/navigation";
import { idiomaDe, traductor, conIdioma, type Idioma, type ClaveTexto } from "@/lib/idioma";

/** El idioma que pide la URL. "es" ante cualquier cosa que no sea `lang=en`. */
export function useIdiomaPanel(): Idioma {
  const sp = useSearchParams();
  return idiomaDe(sp?.get("lang"));
}

/** Un destino del lateral, con el idioma pegado si hace falta. */
export function useHrefIdioma(): (href: string) => string {
  const idioma = useIdiomaPanel();
  return (href: string) => conIdioma(href, idioma);
}

/**
 * Pinta una cadena del diccionario en el idioma de la URL.
 *
 * Para el texto suelto de `layout.tsx`, que es de servidor: un componente de
 * cliente sí puede ir dentro de uno de servidor, y así no hay que convertir el
 * layout entero.
 */
export default function T({ k }: { k: ClaveTexto }) {
  return <>{traductor(useIdiomaPanel())(k)}</>;
}

/**
 * Un `<a>` que no pierde el idioma.
 *
 * Para los enlaces sueltos del layout —el logo y las tres tarjetas del pie—,
 * que no pasan por `EnlaceLateral`. Sin esto, pinchar en "Business profile"
 * devolvía la pantalla al castellano a mitad de grabación.
 */
export function EnlaceIdioma({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a href={useHrefIdioma()(href)} className={className}>
      {children}
    </a>
  );
}
