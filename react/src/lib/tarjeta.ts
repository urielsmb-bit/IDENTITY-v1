/**
 * Lo que se ve cuando alguien pega tu enlace.
 *
 * Vive aparte y sin depender de nada porque lo usan LOS DOS LADOS: la
 * función del borde (`api/perfil.ts`) que escribe las etiquetas `og:` que
 * lee Discord, y la previsualización del editor que te enseña cómo va a
 * quedar.
 *
 * Si cada uno armara su propio texto, acabarían diciendo cosas distintas —
 * y entonces la previsualización sería mentira, que es peor que no tener
 * ninguna. Una función, un resultado, los dos sitios.
 *
 * Sin imports a propósito: esto lo compila también el runtime del borde,
 * que no tiene alias de rutas ni nada del navegador.
 */

export const NOMBRE_SITIO = 'sharee';

/** Una línea, sin saltos y sin pasarse de largo: es para una tarjeta. */
export function linea(v: unknown, max: number): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export interface DatosTarjeta {
  username: string;
  name?: string;
  title?: string;
  bio?: string;
}

/** «Uriel (@shark) · sharee» */
export function tituloTarjeta(p: DatosTarjeta): string {
  const usuario = linea(p.username, 32);
  const nombre = linea(p.name, 60) || usuario;
  return `${nombre} (@${usuario}) · ${NOMBRE_SITIO}`;
}

/**
 * La biografía; si no hay, el oficio; si tampoco, una frase que al menos
 * diga de quién es la página. Un `og:description` vacío deja la tarjeta
 * con un hueco donde debería estar el motivo para pulsar.
 */
export function descripcionTarjeta(p: DatosTarjeta): string {
  const usuario = linea(p.username, 32);
  return (
    linea(p.bio, 160) ||
    linea(p.title, 60) ||
    `El perfil de @${usuario} en ${NOMBRE_SITIO}.`
  );
}

/**
 * La imagen de la tarjeta.
 *
 * Sólo sirve un avatar que esté en la red. `media:` apunta al almacén del
 * propio navegador —esa foto nunca sale de su máquina— así que como imagen
 * de una tarjeta no existe.
 */
export function imagenTarjeta(avatarUrl: unknown): string {
  const s = String(avatarUrl ?? '');
  return /^https:\/\//i.test(s) ? s.slice(0, 500) : '';
}
