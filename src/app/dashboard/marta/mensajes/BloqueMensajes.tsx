// La pestaña "Mensajes" del panel de Marta.
//
// Server component montado como slot, igual que el calendario y el bloque de
// conectar: `MartaLivePanel` es de cliente y no puede leer ni el token del
// tenant ni la bandeja.
//
// Tres estados y ninguno vacío: sin cuenta confirmada explica qué falta y manda
// a "Empezar cuenta"; sin mensajes lo dice; y con mensajes pinta la bandeja.

import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tokenInstagramDeTenant, conexionPendienteDeTenant } from "@/lib/instagram-login";
import { listarConversaciones, ventana } from "@/lib/marta-inbox";
import BandejaDMs from "./BandejaDMs";
import { traductor, conIdioma, type Idioma } from "@/lib/idioma";

export default async function BloqueMensajes({ idioma = "es" }: { idioma?: Idioma }) {
  const t = traductor(idioma);
  const ctx = await contextoPanelODefecto();
  const conexion = await tokenInstagramDeTenant(ctx.tenantId);

  if (!conexion) {
    // Se distingue "no has conectado" de "te falta confirmar": son cosas
    // distintas y mandar a empezar de cero a quien ya autorizó es hacerle
    // repetir el paso más largo por nada.
    const pendiente = await conexionPendienteDeTenant(ctx.tenantId);
    return (
      <div className="card-hard bg-white p-5 border-[3px] border-[color:var(--mustard)]">
        <h3 className="font-stencil text-2xl leading-none mb-2">
          {t(pendiente ? "band_pendiente_t" : "band_sin_conectar_t")}
        </h3>
        <p className="text-sm text-black/70 leading-snug mb-4">
          {pendiente
            ? t("band_pendiente_x", { cuenta: `@${pendiente.usuario || t("cab_tu_cuenta")}` })
            : t("band_sin_conectar_x")}
        </p>
        <a
          href={conIdioma("/dashboard/marta?tab=arranque", idioma)}
          className="btn-mustard inline-block text-sm px-5 py-2.5 font-bold"
        >
          {t(pendiente ? "aviso_boton_confirmar" : "band_ir_arranque")}
        </a>
      </div>
    );
  }

  // La ventana de 24 h se calcula en el servidor, con la hora del servidor: si
  // la calculara el navegador, un reloj mal puesto abriría el cuadro de texto
  // para un envío que Meta va a rechazar.
  const conversaciones = (await listarConversaciones(ctx.tenantId)).map((c) => {
    const v = ventana(c);
    return { ...c, ventanaAbierta: v.abierta, horasQueQuedan: v.horasQueQuedan };
  });

  return (
    <BandejaDMs
      conversaciones={conversaciones}
      cuenta={conexion.usuario || conexion.userId}
      idioma={idioma}
    />
  );
}
