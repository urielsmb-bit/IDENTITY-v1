/**
 * Las fuentes, aplicadas.
 *
 * La hoja de Google esta en el HTML con `media="print"` para que no bloquee
 * el pintado; esto es lo que la enciende. Es un modulo propio y el PRIMER import de `main.tsx`, y eso
 * no es manía: un `import` se evalua antes que cualquier codigo suelto del
 * fichero, aunque el codigo este escrito mas arriba. Puesto como bloque en
 * `main.tsx` habria corrido despues de React, del enrutador y de las diez
 * hojas de estilo; asi corre antes que nada. Cada milisegundo que tarde es
 * un milisegundo mas de texto con la letra del sistema.
 *
 * No puede estar en un `onload=` del propio `<link>`: el CSP de produccion
 * es `script-src 'self'` sin `unsafe-inline` y el navegador se negaria a
 * ejecutarlo. La hoja se quedaria en `print` para siempre, todo el sitio se
 * veria con la letra del sistema, y en la consola no habria mas pista que
 * un aviso de CSP que nadie relaciona con las fuentes.
 */
export {};

const hoja = document.getElementById('hoja-fuentes') as HTMLLinkElement | null;
if (hoja) hoja.media = 'all';
