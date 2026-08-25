"use client";

// La barra de las tres pantallas de trabajo (Vencimientos, El saco, Correo).
//
// No tiene lógica propia: es `BarraChat` con `lanzaAlChat`. Aquí no hay hilo de
// conversación a propósito — escribes, le das, y te lleva al chat con la
// pregunta hecha. Tener la conversación también aquí sería dos chats abiertos
// con dos historias distintas, y encima taparía la pantalla que has venido a
// mirar.
//
// Se mantiene como fichero aparte para que las páginas no tengan que saber qué
// props lleva el componente compartido.

import BarraChat from "./BarraChat";

export default function BarraGestoria() {
  return <BarraChat lanzaAlChat className="mb-5" />;
}
