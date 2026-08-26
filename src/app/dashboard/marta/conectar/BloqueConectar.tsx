// El bloque de conectar Instagram. Vive DENTRO de la pestaña "Empezar cuenta".
//
// Nació como pantalla suelta en /dashboard/marta/conectar y ahí no lo encontraba
// nadie: conectar la cuenta es el paso CERO —sin eso Marta no publica ni
// contesta—, así que estaba escondido justo el único sitio por el que hay que
// empezar. Ahora es lo primero de "Empezar cuenta", antes de generar la bio.
//
// Es un SERVER COMPONENT y se monta como slot desde `page.tsx`, igual que el
// calendario: `MartaLivePanel` es cliente y no puede leer el token ni llamar a
// la acción de desconectar.
//
// ESTE ES EL BLOQUE QUE VE META. El App Review se rechazó porque el vídeo no
// enseñaba a un usuario concediendo permisos, y no lo enseñaba porque no
// existía: la única cuenta conectada era la de la casa, con un token pegado a
// mano. Aquí el cliente pulsa un botón, autoriza en Instagram y vuelve con su
// cuenta conectada.
//
// DOS COSAS QUE PIDE EL REVISOR Y QUE MANDAN SOBRE EL DISEÑO:
//   1. La cuenta conectada tiene que estar A LA VISTA, no dentro de un
//      desplegable ("asset selection — Page, account, or number visible").
//   2. Los permisos se explican en llano ANTES de pedirlos, no con su nombre
//      técnico a secas.

import { contextoPanelODefecto } from "@/lib/panel-contexto";
import {
  tokenInstagramDeTenant,
  conexionPendienteDeTenant,
  cuentasDisponibles,
  SCOPES,
  type CuentaCandidata,
} from "@/lib/instagram-login";
import { desconectarInstagramAction, cancelarSeleccionAction } from "./actions";
import BotonConfirmar from "./BotonConfirmar";
import { traductor, conIdioma, localeDe, type Idioma, type T } from "@/lib/idioma";

/**
 * Qué hace cada permiso, en cristiano (y en inglés durante la grabación).
 *
 * El nombre técnico se enseña debajo y en gris: el revisor de Meta quiere
 * reconocer el scope, y el peluquero quiere entender qué le van a dejar hacer.
 * Los dos leen la misma línea. Los identificadores NO se traducen nunca: son de
 * Meta, y traducirlos haría que el revisor no los reconociese.
 */
const CLAVE_SCOPE = {
  instagram_business_basic: "scope_basic",
  instagram_business_manage_messages: "scope_messages",
  instagram_business_manage_comments: "scope_comments",
  instagram_business_content_publish: "scope_publish",
} as const;

/** Los fallos del OAuth, contados sin tecnicismos y sin filtrar nada. */
const ERRORES = {
  cancelado: ["err_cancelado_t", "err_cancelado_x"],
  credenciales: ["err_credenciales_t", "err_credenciales_x"],
  vuelta: ["err_vuelta_t", "err_vuelta_x"],
  canje: ["err_canje_t", "err_canje_x"],
  guardado: ["err_guardado_t", "err_guardado_x"],
} as const;

function fecha(iso: string | undefined, idioma: Idioma): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(localeDe(idioma), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * El resultado de la vuelta del OAuth. Lo pasa `page.tsx` desde la URL: aquí no
 * se leen `searchParams` para que el bloque se pueda montar en cualquier sitio.
 */
export type ResultadoOAuth = { ok?: string; cuenta?: string; error?: string };

export default async function BloqueConectar({
  resultado,
  idioma = "es",
}: {
  resultado?: ResultadoOAuth;
  idioma?: Idioma;
}) {
  const t = traductor(idioma);
  const ctx = await contextoPanelODefecto();
  const conexion = await tokenInstagramDeTenant(ctx.tenantId);
  // Autorizada en Instagram pero sin confirmar todavía: hay que enseñar el paso
  // de elegir. Solo se busca si no hay ya una confirmada, para no hacer dos
  // lecturas cuando no hace falta.
  const pendiente = conexion ? null : await conexionPendienteDeTenant(ctx.tenantId);
  const disponibles = pendiente ? await cuentasDisponibles(ctx.tenantId) : null;
  const sp = resultado;
  const claves = sp?.error ? (ERRORES[sp.error as keyof typeof ERRORES] ?? ERRORES.canje) : null;
  const fallo = claves ? { titulo: t(claves[0]), texto: t(claves[1]) } : null;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[10px] font-mono uppercase tracking-widest border-2 border-black px-2 py-0.5 font-bold bg-[#E1306C] text-white">
          {t("paso_1")}
        </span>
        <h2 className="font-stencil text-2xl leading-none">{t("conectar_titulo")}</h2>
      </div>

      {/* Salió bien: se dice, y se dice con el nombre de la cuenta. */}
      {sp?.ok === "1" && !fallo && !pendiente && (
        <div className="card-hard bg-[#14B8A6] text-white p-4">
          <div className="font-bold">{t("banner_ok_titulo")}</div>
          <p className="text-sm mt-0.5 leading-snug">
            {t("banner_ok_texto", { cuenta: sp.cuenta ? `@${sp.cuenta}` : t("banner_ok_generico") })}
          </p>
        </div>
      )}

      {/* Salió mal: en llano, sin códigos ni jerga. */}
      {fallo && (
        <div className="card-hard bg-[color:var(--red)] text-white p-4">
          <div className="font-bold">{fallo.titulo}</div>
          <p className="text-sm mt-0.5 leading-snug">{fallo.texto}</p>
        </div>
      )}

      {pendiente ? (
        /* ------------------- PASO 2: ELEGIR Y CONFIRMAR CUENTA -------------------
           Meta lo pide por escrito: "asset selection (Page, account, or number
           visible)". Aunque Instagram Business Login devuelva SIEMPRE una sola
           cuenta —el selector lo pinta Instagram dentro de su flujo, y el token
           que vuelve ya es de esa cuenta—, el cliente tiene que pulsar. No es
           burocracia: es lo que separa "autorizaste algo" de "esta es mi cuenta
           de empresa", y en Instagram se cambia de cuenta con dos toques.        */
        <PasoElegirCuenta cuentas={disponibles?.cuentas ?? []} aviso={disponibles?.error} t={t} />
      ) : conexion ? (
        /* ------------------------------ CONECTADA ------------------------------ */
        <>
          {/* LA CUENTA, GRANDE Y A LA VISTA. Es el requisito del revisor: tiene
              que verse en pantalla, no detrás de un clic. */}
          <div className="card-hard bg-white p-5">
            <div className="text-[10px] font-mono uppercase tracking-widest text-black/50 mb-2">
              {t("ficha_titulo")}
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <span
                className="w-14 h-14 border-[3px] border-black flex items-center justify-center text-2xl shrink-0"
                style={{ background: "#E1306C" }}
                aria-hidden
              >
                📷
              </span>
              <div className="min-w-0">
                <div className="font-stencil text-3xl leading-none break-all">
                  @{conexion.usuario || t("ficha_sin_nombre")}
                </div>
                <div className="text-xs font-mono text-black/55 mt-1">
                  {t("ficha_user_id")} {conexion.userId || "—"}
                </div>
              </div>
              <span className="ml-auto text-[10px] font-mono uppercase tracking-widest bg-[#14B8A6] text-white border-2 border-black px-2 py-1">
                {t("ficha_conectada")}
              </span>
            </div>

            <dl className="grid sm:grid-cols-2 gap-3 mt-4 pt-4 border-t-2 border-black/10 text-sm">
              <div>
                <dt className="text-[10px] font-mono uppercase tracking-widest text-black/50">{t("ficha_desde")}</dt>
                <dd className="font-bold">{fecha(conexion.conectadoEn, idioma)}</dd>
                {/* Queda por escrito que hubo confirmación explícita y cuándo:
                    es lo que Meta pide poder ver, y lo que distingue "el token
                    existe" de "el cliente dijo que sí". */}
                {conexion.confirmadoEn && (
                  <dd className="text-[11px] font-mono text-black/50 mt-0.5">
                    {t("ficha_confirmada")} {fecha(conexion.confirmadoEn, idioma)}
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-[10px] font-mono uppercase tracking-widest text-black/50">
                  {t("ficha_caduca")}
                </dt>
                <dd className="font-bold">
                  {fecha(conexion.caducaEn, idioma)}{" "}
                  <span
                    className={
                      conexion.diasQueQuedan <= 7 ? "text-[color:var(--red)]" : "text-black/50 font-normal"
                    }
                  >
                    {t("ficha_quedan", { n: conexion.diasQueQuedan })}
                  </span>
                </dd>
              </div>
            </dl>

            {/* Se avisa ANTES de que se rompa, no después: un permiso caducado
                deja a Marta muda sin que nadie lo note hasta que falla algo. */}
            {conexion.diasQueQuedan <= 7 && (
              <p className="mt-3 text-xs bg-[color:var(--mustard)] border-2 border-black px-3 py-2">
                {t("ficha_queda_poco")}
              </p>
            )}
          </div>

          <div className="card-hard bg-white p-5">
            <div className="text-[10px] font-mono uppercase tracking-widest text-black/50 mb-2">
              {t("ficha_permisos")}
            </div>
            <ul className="space-y-2 text-sm">
              {SCOPES.map((scope) => {
                const tiene = conexion.permisos.includes(scope);
                return (
                  <li key={scope} className="flex items-start gap-2">
                    <span className={tiene ? "text-[#14B8A6]" : "text-[color:var(--red)]"} aria-hidden>
                      {tiene ? "✓" : "✕"}
                    </span>
                    <span className="min-w-0">
                      <span className="block leading-snug">{t(CLAVE_SCOPE[scope])}</span>
                      <code className="text-[10px] font-mono text-black/40">{scope}</code>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex gap-3 flex-wrap">
            <a
              href={conIdioma("/api/instagram/login", idioma)}
              title={t("ficha_reconectar_tip")}
              className="text-xs uppercase tracking-widest font-bold border-2 border-black px-4 py-2.5 hover:bg-black hover:text-white"
            >
              {t("ficha_reconectar")}
            </a>
            <form action={desconectarInstagramAction}>
              <button
                type="submit"
                title={t("ficha_desconectar_tip")}
                className="text-xs uppercase tracking-widest font-bold border-2 border-black px-4 py-2.5 hover:bg-[color:var(--red)] hover:text-white hover:border-[color:var(--red)]"
              >
                {t("ficha_desconectar")}
              </button>
            </form>
          </div>
          <p className="text-xs text-black/50">{t("ficha_nota_desconectar")}</p>
        </>
      ) : (
        /* ---------------------------- SIN CONECTAR ---------------------------- */
        <>
          <div className="card-hard bg-white p-5 space-y-4">
            <p className="text-base leading-snug">{t("conectar_intro")}</p>
            <a
              href={conIdioma("/api/instagram/login", idioma)}
              title={t("conectar_boton_tip")}
              className="btn-mustard inline-block text-base px-8 py-4 font-bold"
            >
              {t("conectar_boton")}
            </a>
            <p className="text-xs text-black/50">{t("conectar_nota_password")}</p>
          </div>

          <div className="card-hard bg-white p-5">
            <div className="text-[10px] font-mono uppercase tracking-widest text-black/50 mb-2">
              {t("permisos_titulo_previo")}
            </div>
            <ul className="space-y-2 text-sm">
              {SCOPES.map((scope) => (
                <li key={scope} className="flex items-start gap-2">
                  <span className="text-black/30" aria-hidden>
                    •
                  </span>
                  <span className="min-w-0">
                    <span className="block leading-snug">{t(CLAVE_SCOPE[scope])}</span>
                    <code className="text-[10px] font-mono text-black/40">{scope}</code>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-black/50 mt-3 leading-snug">{t("permisos_nota")}</p>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * El paso de elegir cuenta.
 *
 * Con Instagram Business Login la lista es SIEMPRE de una: el selector de cuenta
 * lo pinta Instagram dentro de su propio flujo y el token que vuelve pertenece
 * ya a esa cuenta. Se pinta como lista igualmente —y no como una ficha suelta—
 * para no tener que rehacerla el día que se añada Facebook Login, que sí trae
 * varias Páginas.
 *
 * NO se inventa ninguna fila: sale lo que ha devuelto Meta y nada más.
 */
async function PasoElegirCuenta({
  cuentas,
  aviso,
  t,
}: {
  cuentas: CuentaCandidata[];
  aviso?: string;
  t: T;
}) {
  return (
    <>
      <div className="card-hard bg-white p-5 space-y-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest bg-[color:var(--mustard)] border-2 border-black px-2 py-0.5 font-bold">
            {t("elegir_etiqueta")}
          </span>
          <h3 className="font-stencil text-2xl leading-none mt-2">{t("elegir_titulo")}</h3>
          <p className="text-sm text-black/70 mt-1 leading-snug">{t("elegir_intro")}</p>
        </div>

        {cuentas.length === 0 ? (
          <p className="text-sm bg-[color:var(--mustard)] border-2 border-black px-3 py-2">
            {t("elegir_sin_cuentas")}
          </p>
        ) : (
          <ul className="space-y-3">
            {cuentas.map((c) => (
              <li key={c.userId} className="border-[3px] border-black p-4">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* La foto la sirve el CDN de Meta con una URL firmada y que
                      caduca: con next/image habría que darla de alta como dominio
                      remoto y encima pasaría por nuestro optimizador sin ninguna
                      ventaja, porque es una miniatura que se ve una vez. */}
                  {c.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.foto}
                      alt={`@${c.usuario ?? "?"}`}
                      className="w-16 h-16 border-[3px] border-black object-cover shrink-0"
                    />
                  ) : (
                    <span
                      className="w-16 h-16 border-[3px] border-black flex items-center justify-center text-2xl shrink-0"
                      style={{ background: "#E1306C" }}
                      aria-hidden
                    >
                      📷
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="font-stencil text-2xl leading-none break-all">
                      @{c.usuario || t("ficha_sin_nombre")}
                    </div>
                    <div className="text-xs font-mono text-black/55 mt-1">
                      {t("ficha_user_id")} {c.userId || "—"}
                    </div>
                    {c.tipoCuenta && (
                      <div className="text-xs font-mono text-black/55">
                        {t("ficha_tipo")} {c.tipoCuenta}
                      </div>
                    )}
                  </div>
                </div>

                {/* Una cuenta PERSONAL no puede publicar por API. Enterarse aquí
                    es un minuto; enterarse cuando falla la primera publicación
                    son dos días buscando dónde está el fallo. */}
                {c.tipoCuenta && !/BUSINESS|MEDIA_CREATOR/i.test(c.tipoCuenta) && (
                  <p className="text-xs bg-[color:var(--mustard)] border-2 border-black px-3 py-2 mt-3">
                    {t("aviso_no_empresa")}
                  </p>
                )}

                <BotonConfirmar
                  userId={c.userId}
                  texto={t("elegir_boton")}
                  tip={t("elegir_boton_tip")}
                />
              </li>
            ))}
          </ul>
        )}

        {/* Si Meta no contestó, se dice — y se dice que lo de arriba es lo que
            teníamos guardado, no un dato fresco. Callarlo haría que el cliente
            confirmara creyendo que se acaba de comprobar. */}
        {aviso && (
          <p className="text-xs text-black/55 leading-snug">
            {t("elegir_aviso_cache")}
          </p>
        )}
      </div>

      <form action={cancelarSeleccionAction}>
        <button
          type="submit"
          title={t("elegir_otra_tip")}
          className="text-xs uppercase tracking-widest font-bold border-2 border-black px-4 py-2.5 hover:bg-black hover:text-white"
        >
          {t("elegir_otra")}
        </button>
      </form>
      <p className="text-xs text-black/50">{t("elegir_nota_cambio")}</p>
    </>
  );
}
