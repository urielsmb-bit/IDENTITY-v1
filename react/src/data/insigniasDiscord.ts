/**
 * Las insignias de Discord, las de verdad.
 *
 * ────────────────────────────────────────────────────────────────────────
 * DE DONDE SALEN
 * ────────────────────────────────────────────────────────────────────────
 *
 * De dos sitios, los dos en la MISMA respuesta que ya se pedía para el
 * marco de avatar —`/users/@me` con el permiso `identify` del propio inicio
 * de sesión—, así que esto no cuesta ni una petición más:
 *
 *   · `premium_type`  dice si hay Nitro. 0 es no; 1, 2 y 3 son Classic,
 *                     Nitro y Basic.
 *   · `public_flags`  es un número donde cada BIT es una insignia. El 1 es
 *                     ser de Discord, el 512 ser de los primeros en pagar,
 *                     y así.
 *
 * Los iconos los sirve Discord en `cdn.discordapp.com/badge-icons/`, igual
 * que sirve los escudos de servidor que el widget ya enseña. Las claves de
 * abajo son las de sus propios archivos.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LO QUE NO SE PUEDE ENSEÑAR, Y CONVIENE SABERLO
 * ────────────────────────────────────────────────────────────────────────
 *
 * `public_flags` no lo trae todo. Quedan fuera:
 *
 *   · Impulsar un servidor, que es por servidor y no por persona.
 *   · Lo nuevo que Discord va añadiendo —misiones, orbes y demás— que no
 *     tiene bit asignado.
 *
 * O sea que alguien puede llevar en Discord una insignia que aquí no
 * aparezca. No es un fallo de esto: es que Discord no la publica en ningún
 * sitio al que se pueda preguntar.
 */

export interface InsigniaDiscord {
  id: string;
  /** El bit de `public_flags`. Nitro no tiene: va por `premium_type`. */
  bit?: number;
  /** El nombre del archivo en el CDN de Discord. */
  icono: string;
  nombre: string;
}

/* El orden es el que usa Discord al pintarlas en un perfil: primero lo que
   te da la casa, luego lo que te ganas, y el Nitro al final. */
export const INSIGNIAS_DISCORD: InsigniaDiscord[] = [
  { id: 'staff', bit: 1 << 0, icono: '5e74e9b61934fc1f67c65515d1f7e60d', nombre: 'Equipo de Discord' },
  { id: 'partner', bit: 1 << 1, icono: '3f9748e53446a137a052f3454e2de41e', nombre: 'Servidor asociado' },
  { id: 'certificado', bit: 1 << 18, icono: 'fee1624003e2fee35cb398e125dc479b', nombre: 'Moderador certificado' },
  { id: 'hypesquad', bit: 1 << 2, icono: 'bf01d1073931f921909045f3a39fd264', nombre: 'Eventos HypeSquad' },
  { id: 'bravery', bit: 1 << 6, icono: '8a88d63823d8a71cd5e390baa45efa02', nombre: 'HypeSquad Bravery' },
  { id: 'brilliance', bit: 1 << 7, icono: '011940fd013da3f7fb926e4a1cd2e618', nombre: 'HypeSquad Brilliance' },
  { id: 'balance', bit: 1 << 8, icono: '3aa41de486fa12454c3761e8e223442e', nombre: 'HypeSquad Balance' },
  { id: 'cazabichos1', bit: 1 << 3, icono: '2717692c7dca7289b35297368a940dd0', nombre: 'Cazador de bugs' },
  { id: 'cazabichos2', bit: 1 << 14, icono: '848f79194d4be5ff5f81505cbd0ce1e6', nombre: 'Cazador de bugs, nivel 2' },
  { id: 'pionero', bit: 1 << 9, icono: '7060786766c9c840eb3019e725d2b358', nombre: 'Apoyo desde el principio' },
  { id: 'desarrollador', bit: 1 << 17, icono: '6df5892e0f35b051f8b61eace34f4967', nombre: 'Desarrollador de bots verificado' },
  { id: 'activo', bit: 1 << 22, icono: '6bdc42827a38498929a4920da12695d9', nombre: 'Desarrollador activo' },
  { id: 'nitro', icono: '2ba85e8026a8614b640c2837bcdfe21b', nombre: 'Discord Nitro' },
];

export function urlInsignia(icono: string): string {
  return `https://cdn.discordapp.com/badge-icons/${icono}.png`;
}

/**
 * Las que le tocan a alguien, en el orden de arriba.
 *
 * `flags` es lo que Discord llama `public_flags`. Se comprueba que sea un
 * número de verdad porque llega de fuera: con un `undefined` el `&` daría
 * cero y no pasaría nada, pero con una cadena daría resultados raros sin
 * avisar.
 */
export function insigniasDe(flags: unknown, nitro: unknown): InsigniaDiscord[] {
  const n = typeof flags === 'number' && isFinite(flags) ? flags : 0;
  return INSIGNIAS_DISCORD.filter((b) =>
    b.bit === undefined ? nitro === true : (n & b.bit) !== 0,
  );
}
