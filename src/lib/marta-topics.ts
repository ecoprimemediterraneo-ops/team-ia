// Temas predefinidos para los posts de Marta. Cada tema lleva:
//   - captionTema: el "asunto" que se pasa a generarCaption (texto del post).
//   - imageBrief:  dirección visual detallada que se combina con la FICHA del
//                  cliente (sector, servicios, estilo) en el generador de
//                  imagen, para que salgan escenas específicas y no genéricas.
//
// La idea: el desplegable manda solo la `key`; el servidor resuelve aquí el
// brief. Así el cliente elige un tema claro y por detrás hay un prompt rico.
//
// Importable desde cliente (no usa server-only) para pintar el desplegable.

export type MartaTopicKey =
  | "auto"
  | "promo_servicio"
  | "antes_despues"
  | "consejo"
  | "presentar_equipo"
  | "testimonio"
  | "fecha_senalada"
  | "novedad"
  | "recordatorio";

export type MartaTopic = {
  key: MartaTopicKey;
  label: string;        // lo que ve el cliente en el desplegable
  captionTema: string;  // asunto para el caption
  imageBrief: string;   // dirección visual (se combina con la ficha)
};

export const MARTA_TOPICS: MartaTopic[] = [
  {
    key: "auto",
    label: "Automático (elige Marta)",
    captionTema: "",
    imageBrief: "",
  },
  {
    key: "promo_servicio",
    label: "Promoción de un servicio",
    captionTema: "Promoción de un servicio estrella del negocio",
    imageBrief:
      "Imagen atractiva del servicio estrella del negocio en acción, con un cliente disfrutándolo; ambiente profesional y cuidado del propio local, enfoque en el resultado/beneficio. Sin texto sobreimpreso.",
  },
  {
    key: "antes_despues",
    label: "Antes / después",
    captionTema: "Resultado de un tratamiento o servicio (antes y después)",
    imageBrief:
      "Composición tipo antes/después que muestre la mejora real del servicio del sector (dos mitades o secuencia), realista y creíble, luz clara que destaque el resultado. Sin texto sobreimpreso.",
  },
  {
    key: "consejo",
    label: "Consejo / tip útil",
    captionTema: "Un consejo útil para el cliente relacionado con el sector",
    imageBrief:
      "Imagen limpia y didáctica relacionada con el consejo del sector, un solo elemento protagonista, fondo sencillo, aire profesional y cercano. Sin texto sobreimpreso.",
  },
  {
    key: "presentar_equipo",
    label: "Presentar al equipo",
    captionTema: "Presentación del equipo humano del negocio",
    imageBrief:
      "Retrato cálido y profesional de un profesional del sector en su entorno de trabajo del propio local, sonriente y cercano, transmite confianza. Sin texto sobreimpreso.",
  },
  {
    key: "testimonio",
    label: "Testimonio de cliente",
    captionTema: "Testimonio o experiencia positiva de un cliente",
    imageBrief:
      "Cliente satisfecho y sonriente en el local del negocio tras recibir el servicio, ambiente real y cercano, luz natural. Sin texto sobreimpreso.",
  },
  {
    key: "fecha_senalada",
    label: "Fecha señalada / temporada",
    captionTema: "Post para una fecha señalada o temporada del año",
    imageBrief:
      "Escena del negocio decorada acorde a la fecha/temporada indicada, con elementos estacionales sutiles y elegantes, sin saturar. Sin texto sobreimpreso.",
  },
  {
    key: "novedad",
    label: "Novedad / nuevo servicio",
    captionTema: "Anuncio de una novedad o nuevo servicio",
    imageBrief:
      "Imagen que presente la novedad/nuevo servicio del negocio de forma aspiracional y moderna, protagonista claro, estética premium del sector. Sin texto sobreimpreso.",
  },
  {
    key: "recordatorio",
    label: "Recordatorio (pedir cita)",
    captionTema: "Recordatorio amable para reservar cita",
    imageBrief:
      "Imagen acogedora del local listo para recibir clientes (recepción/sala cuidada), invita a reservar, sensación de cercanía y profesionalidad. Sin texto sobreimpreso.",
  },
];

export function resolveTopic(key: string | undefined): MartaTopic {
  return MARTA_TOPICS.find((t) => t.key === key) ?? MARTA_TOPICS[0];
}
