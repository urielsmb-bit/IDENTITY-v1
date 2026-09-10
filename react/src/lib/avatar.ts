import type { Profile } from '@/types';
import { safeMedia } from './utils';

/**
 * Que cara se le pone a un perfil.
 *
 * Un perfil recien hecho no tiene foto, y hasta ahora eso era un hueco:
 * un cuadro vacio con una letra sobre el gris del tema, igual para todo el
 * mundo. La primera impresion de alguien que acaba de entrar era que la
 * pagina no habia terminado de cargar.
 *
 * Hay tres caras posibles, y se prueban EN ESTE ORDEN:
 *
 *   1. La que subiste tu. Manda siempre.
 *   2. La de Discord, si tienes la cuenta conectada.
 *   3. Tu inicial sobre un color solido.
 *
 * Ese orden resuelve solo las cuatro reglas que hacen falta, sin guardar
 * nada y sin preguntar nada:
 *
 *   · si pusiste foto, sigue la tuya;
 *   · si conectas Discord DESPUES, tu foto no se toca;
 *   · si conectas Discord sin tener foto, sale la de Discord;
 *   · y si un dia quitas la tuya, vuelve a salir la de Discord.
 *
 * NO se copia la de Discord dentro de `avatarUrl` al conectar la cuenta, que
 * era la otra forma de hacerlo. Dos razones. Una, esa direccion cambia cuando
 * cambias tu foto en Discord: copiada, el perfil se quedaria enseñando una
 * cara que ya no usas. Y dos, copiarla no se puede deshacer — «no tengo foto»
 * y «elegi esta» pasarian a ser lo mismo, y entonces la regla de arriba, la
 * de no pisar lo que elegiste, ya no se podria cumplir.
 */
export interface Avatar {
  /** La imagen. Vacio = no hay ninguna y se pinta `signo`. */
  url: string;
  /** Lo que se pinta sin imagen: tu emoji si pusiste uno, y si no tu inicial. */
  signo: string;
  /** El fondo solido de `signo`. */
  color: string;
  /** Si la imagen sale de Discord y no de una que subieras tu. */
  deDiscord: boolean;
}

/**
 * Un tono a partir del nombre.
 *
 * «Aleatorio» de verdad no sirve: un color echado a suertes en cada pintada
 * parpadea al recargar, y ademas te saldria uno en tu perfil, otro en el
 * ranking y otro en Descubrir. Siendo el mismo perfil, seria raro tres veces.
 *
 * Sale del @usuario, que no cambia. Asi cada persona tiene SU color: siempre
 * el mismo, en todas partes, y sin guardarlo en ningun sitio.
 *
 * FNV-1a y, despues, una vuelta de mezcla.
 *
 * La mezcla no sobra. Sin ella, los tres usuarios que hay hoy en la base
 * —`shark`, `iamerick` y `arlettex3`— salian en 206, 214 y 145: los tres
 * azules, 69 grados de nada entre el primero y el ultimo. Una rejilla de
 * perfiles se veia de un solo color.
 *
 * FNV-1a reparte bien en conjunto, pero deja buena parte de la diferencia
 * en los bits altos, y cortar por `% 360` mira sobre todo los bajos. Estas
 * tres vueltas de xor-desplazar-multiplicar son el remate de `murmurhash3`
 * y bajan esos bits: los mismos tres nombres pasan a 187, 104 y 214.
 *
 * Lo que esto NO promete es que dos nombres cualesquiera caigan lejos. Con
 * 360 tonos y un puñado de personas, que dos coincidan es cuestion de
 * tiempo y no es un fallo: el color acompaña a la inicial, no la sustituye.
 */
function tono(semilla: string): number {
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i++) {
    h ^= semilla.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  /* `>>> 0` y no `Math.abs`: `Math.imul` devuelve un entero con signo, y lo
     que hace falta aqui es leer los mismos 32 bits sin signo, no doblar los
     negativos sobre los positivos. */
  return (h >>> 0) % 360;
}

/* La saturacion y la luminosidad son fijas, y por eso el color puede ser
   «cualquiera» sin riesgo: a 44% de luz, un texto blanco encima se lee con
   los 360 tonos. Dejando el azar suelto por los tres canales tarde o
   temprano sale un amarillo claro con una letra blanca invisible. */
const SATURACION = 52;
const LUZ = 44;

export function avatarDe(p: Partial<Profile>): Avatar {
  const propia = safeMedia(p.avatarUrl);
  const deDiscord = safeMedia(p.discordAvatar);
  const nombre = String(p.name || p.username || '').trim();

  return {
    url: propia || deDiscord,
    /* El emoji va antes que la inicial porque lo pusiste tu a mano: es una
       eleccion, y la letra es lo que ponemos nosotros cuando no hay ninguna. */
    signo: p.emoji || nombre.charAt(0).toUpperCase() || '?',
    color: `hsl(${tono(String(p.username || nombre))} ${SATURACION}% ${LUZ}%)`,
    deDiscord: !propia && !!deDiscord,
  };
}
