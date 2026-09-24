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

/**
 * La cara del perfil: la misma que enseña el perfil a quien lo abre.
 *
 * La subida, la de Discord o la de la cuenta, en ese orden — el mismo de
 * `avatarDe()`. Las etiquetas del servidor solo miraban la subida, asi que
 * quien entraba con Discord y no subia foto tenia un perfil CON cara y una
 * tarjeta SIN ella, y la previsualizacion del editor —que si miraba las
 * tres— prometia una imagen que luego no salia.
 */
export function caraTarjeta(p: {
  avatarUrl?: unknown;
  discordAvatar?: unknown;
  cuentaAvatar?: unknown;
}): string {
  return (
    imagenTarjeta(p.avatarUrl) || imagenTarjeta(p.discordAvatar) || imagenTarjeta(p.cuentaAvatar)
  );
}

/**
 * Y si no hay cara, la de la marca. Una tarjeta sin imagen se lee como un
 * enlace sospechoso, no como un perfil. Es la misma de la portada: 1200 x
 * 630, que va en tarjeta ANCHA y no en la cuadrada del avatar.
 */
export const IMAGEN_MARCA = '/compartir.jpg';

/**
 * Lo que lee Google para entender que esto es el perfil de una persona:
 * `ProfilePage` de schema.org. Es lo que le deja enseñar el nombre, la
 * foto y las redes en el resultado en vez de una linea de texto suelta.
 *
 * `sameAs` son las redes de verdad —solo direcciones https—, que es como
 * Google ata este perfil con los de esa persona en otros sitios. Y con
 * algo detras del dominio: `https://discord.gg/` a secas es una red que se
 * añadio y no se relleno, no la cuenta de nadie.
 */
export function datosEstructurados(d: {
  enlace: string;
  usuario: string;
  nombre?: string;
  bio?: string;
  cara?: string;
  redes?: unknown;
  creado?: unknown;
  actualizado?: unknown;
}): Record<string, unknown> {
  const redes = (Array.isArray(d.redes) ? d.redes : [])
    .map((r) => imagenTarjeta((r as { url?: unknown } | null)?.url))
    .filter((u) => /^https:\/\/[^/]+\/[^?#]/i.test(u))
    .slice(0, 20);
  const persona: Record<string, unknown> = {
    '@type': 'Person',
    name: linea(d.nombre, 60) || d.usuario,
    alternateName: `@${d.usuario}`,
    identifier: d.usuario,
    url: d.enlace,
  };
  const bio = linea(d.bio, 160);
  if (bio) persona.description = bio;
  if (d.cara) persona.image = d.cara;
  if (redes.length) persona.sameAs = redes;

  const pagina: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: d.enlace,
    mainEntity: persona,
  };
  if (typeof d.creado === 'string' && d.creado) pagina.dateCreated = d.creado;
  if (typeof d.actualizado === 'string' && d.actualizado) pagina.dateModified = d.actualizado;
  return pagina;
}
