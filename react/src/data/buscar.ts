import { BLOQUES, type ControlId, type DefBloque } from './bloques';

/**
 * El catálogo de lo que se puede encontrar.
 *
 * IDENTITY tiene 11 bloques y casi cien controles repartidos entre ellos.
 * Eso es más de lo que ofrece nadie — y no vale nada, porque para cambiar
 * «el degradado del nombre» hay que saber de antemano que vive en Bloques →
 * Nombre → Color. Si no lo sabes, la opción no existe.
 *
 * Este archivo es el índice. No añade funciones: hace alcanzable lo que ya
 * está construido.
 *
 * El mapa va tipado como `Record<ControlId, …>` A PROPÓSITO. Así, el día que
 * alguien añada un control nuevo a `bloques.ts`, esto deja de compilar hasta
 * que le ponga nombre. No es un test que se pueda olvidar de correr: es el
 * compilador negándose.
 */

interface Ficha {
  /** Como se llama en el editor. Debe coincidir con su `label`. */
  nombre: string;
  /**
   * Cómo lo llamaría alguien que no sabe cómo lo llamamos nosotros.
   *
   * Es la mitad que hace útil a un buscador. Quien quiere quitar la caja de
   * un bloque escribe «caja», «borde» o «fondo», no «superficie»; quien
   * busca la tipografía escribe «letra» o «fuente». Sin esto sólo encuentra
   * quien ya sabía la palabra, que es justamente quien no necesita buscar.
   */
  alias?: string[];
}

const CONTROL: Record<ControlId, Ficha> = {
  texto: { nombre: 'Texto', alias: ['contenido', 'escribir', 'nombre', 'bio'] },
  visible: { nombre: 'Mostrar u ocultar', alias: ['ocultar', 'esconder', 'quitar', 'apagar'] },

  degradadoNombre: { nombre: 'Degradado en el nombre', alias: ['gradiente', 'dos colores', 'morado'] },
  animarNombre: { nombre: 'Barrido de luz en el nombre', alias: ['brillo', 'animado', 'destello'] },

  fuente: { nombre: 'Fuente', alias: ['tipografía', 'letra', 'tipo de letra'] },
  caso: { nombre: 'Mayúsculas y minúsculas', alias: ['mayúsculas', 'minúsculas', 'capitalizar'] },
  espaciado: { nombre: 'Espaciado entre letras', alias: ['interletraje', 'separación', 'tracking'] },
  tamano: { nombre: 'Tamaño del texto', alias: ['más grande', 'más pequeño', 'letra grande'] },

  color: { nombre: 'Color', alias: ['tinte', 'color de las letras', 'blanco'] },
  halo: { nombre: 'Halo / Resplandor', alias: ['glow', 'brillo', 'resplandor', 'aura'] },

  superficie: { nombre: 'Superficie de la caja', alias: ['caja', 'fondo del bloque', 'cristal', 'sin caja'] },
  heredarCaja: { nombre: 'Heredar la caja del perfil', alias: ['caja', 'igual que el perfil'] },
  relleno: { nombre: 'Relleno', alias: ['padding', 'espacio dentro', 'margen interior'] },
  radio: { nombre: 'Radio de las esquinas', alias: ['esquinas', 'redondeo', 'bordes redondos'] },
  ancho: { nombre: 'Ancho', alias: ['anchura', 'más ancho', 'estrecho'] },
  centrar: { nombre: 'Centrar', alias: ['centrado', 'al medio'] },
  opacidad: { nombre: 'Opacidad', alias: ['transparencia', 'translúcido'] },
  anim: { nombre: 'Animación de la caja', alias: ['movimiento', 'latido'] },
  borde: { nombre: 'Borde', alias: ['contorno', 'línea', 'marco'] },
  desenfoque: { nombre: 'Desenfoque', alias: ['blur', 'difuminado', 'cristal esmerilado'] },
  brillo: { nombre: 'Brillo', alias: ['luminosidad', 'claro', 'oscuro'] },

  alinear: { nombre: 'Alineación', alias: ['izquierda', 'derecha', 'centrado'] },
  margen: { nombre: 'Margen', alias: ['separación', 'espacio arriba', 'espacio entre bloques'] },

  estiloRedes: { nombre: 'Estilo de las redes', alias: ['iconos', 'redes sociales'] },
  estiloInsignias: { nombre: 'Estilo de las insignias', alias: ['badges', 'insignias', 'verificado'] },
  listaRedes: { nombre: 'Tus redes', alias: ['instagram', 'tiktok', 'twitter', 'añadir red'] },
  listaInsignias: { nombre: 'Tus insignias', alias: ['badges', 'logros'] },
  monoRedes: { nombre: 'Iconos de un solo color', alias: ['monocromo', 'blanco y negro', 'sin color'] },

  enlaceMusica: { nombre: 'Enlace de la música', alias: ['canción', 'spotify', 'youtube', 'audio'] },
  portadaMusica: { nombre: 'Portada de la música', alias: ['carátula', 'disco', 'álbum'] },

  posAvatar: { nombre: 'Posición del avatar', alias: ['foto', 'al lado', 'arriba'] },
  formaAvatar: { nombre: 'Forma del avatar', alias: ['foto', 'redondo', 'cuadrado'] },

  animacion: { nombre: 'Animación de entrada', alias: ['aparecer', 'entrada', 'transición'] },

  discordId: { nombre: 'Tu cuenta de Discord', alias: ['discord', 'presencia', 'estado'] },
  marcoDiscord: { nombre: 'Marco de Discord', alias: ['nitro', 'decoración', 'avatar'] },
};

/** Las secciones del editor, para poder saltar a ellas por su nombre. */
const SECCIONES: Array<{ id: string; nombre: string; alias: string[] }> = [
  { id: 'overview', nombre: 'Perfil', alias: ['foto', 'avatar', 'fondo', 'vídeo', 'quién eres'] },
  { id: 'design', nombre: 'Diseño', alias: ['tema', 'colores', 'partículas', 'cursor', 'tipografía'] },
  { id: 'blocks', nombre: 'Bloques', alias: ['piezas', 'orden', 'lienzo', 'colocar'] },
  { id: 'links', nombre: 'Redes & Enlaces', alias: ['instagram', 'tiktok', 'enlaces', 'contacto'] },
  { id: 'badges', nombre: 'Badges', alias: ['insignias', 'logros', 'verificado'] },
  { id: 'settings', nombre: 'Ajustes', alias: ['cuenta', 'contraseña', 'correo', 'privacidad', 'borrar'] },
];

export interface Resultado {
  clave: string;
  /** Lo que se lee en grande. */
  titulo: string;
  /** Dónde vive, para que se entienda a dónde va a saltar. */
  ruta: string;
  /** A qué sección del editor lleva. */
  seccion: string;
  /** Y, si es un control o un bloque, qué bloque hay que abrir. */
  bloque?: DefBloque;
  /** Los sinónimos, sueltos y sin tildes: el orden los mira aparte. */
  alias: string[];
  /** Todo lo buscable junto y en minúsculas, ya preparado. */
  aguja: string;
}

/* El rango del corchete es U+0300–U+036F: las marcas que `NFD` separa de su
   letra. Se ven raro porque son combinantes y el editor las pinta sobre el
   corchete, pero es el rango correcto y está probado. */
const sinTildes = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * El índice entero, montado una vez.
 *
 * Sale de `BLOQUES`, que es la misma declaración que pinta el editor: un
 * bloque o un control que exista se puede encontrar por definición, y uno
 * que se quite desaparece de aquí solo. No hay una segunda lista que
 * mantener al día.
 */
export const INDICE: Resultado[] = (() => {
  const out: Resultado[] = [];

  for (const s of SECCIONES) {
    out.push({
      clave: `sec:${s.id}`,
      titulo: s.nombre,
      ruta: 'Sección',
      seccion: s.id,
      alias: s.alias.map(sinTildes),
      aguja: sinTildes([s.nombre, ...s.alias].join(' ')),
    });
  }

  for (const b of BLOQUES) {
    out.push({
      clave: `blq:${b.id}`,
      titulo: b.nombre,
      ruta: 'Bloques',
      seccion: 'blocks',
      bloque: b,
      alias: [],
      aguja: sinTildes(`${b.nombre} ${b.descripcion}`),
    });

    /* Un control puede estar en varios bloques —«Color» está en casi
       todos— y cada aparición es un destino distinto: el color del nombre
       no es el color de la biografía. Por eso se indexa una vez por bloque
       y el resultado dice de cuál es. */
    const vistos = new Set<string>();
    for (const g of b.grupos) {
      for (const id of g.controles) {
        if (vistos.has(id)) continue;
        vistos.add(id);
        const f = CONTROL[id];
        out.push({
          clave: `ctl:${b.id}:${id}`,
          titulo: f.nombre,
          ruta: `Bloques · ${b.nombre}`,
          seccion: 'blocks',
          bloque: b,
          alias: (f.alias ?? []).map(sinTildes),
          aguja: sinTildes(`${f.nombre} ${(f.alias ?? []).join(' ')} ${b.nombre} ${g.titulo}`),
        });
      }
    }
  }

  return out;
})();

/**
 * Busca.
 *
 * Todas las palabras tienen que aparecer, en cualquier orden: «color nombre»
 * encuentra el color del nombre sin que importe cómo lo escribas. Y sin
 * tildes por los dos lados, porque nadie escribe «tipografía» con tilde en
 * un buscador y quedarse sin resultados por eso es absurdo.
 */
export function buscar(q: string, tope = 12): Resultado[] {
  const palabras = sinTildes(q).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [];
  const primera = palabras[0]!;

  const hits = INDICE.filter((r) => palabras.every((p) => r.aguja.includes(p)));

  /**
   * Dónde cae el match importa más que el orden alfabético.
   *
   * Sin esto, buscar «caja» devolvía «Ancho» antes que «Superficie de la
   * caja» — porque los dos viven en el grupo «Caja» y desempataba la A. El
   * que lleva la palabra EN EL NOMBRE es el que buscabas.
   */
  const puntos = (r: Resultado): number => {
    const t = sinTildes(r.titulo);
    if (t.startsWith(primera)) return 0;
    if (t.includes(primera)) return 1;
    // Un alias que ES la palabra («letra» → Fuente) vale más que uno que
    // sólo la contiene de pasada («color de las letras» → Color).
    if (r.alias.includes(primera)) return 2;
    if (r.alias.some((a) => a.includes(primera))) return 3;
    // Sólo coincide el bloque o el grupo: es contexto, no lo que se pedía.
    return 4;
  };

  const ordenados = hits.sort(
    (a, b) => puntos(a) - puntos(b) || a.titulo.localeCompare(b.titulo),
  );

  /* Un mismo control vive en varios bloques —«Color» está en casi todos— y
     cada uno es un destino distinto de verdad. Pero ocho «Color» seguidos
     dejan fuera todo lo demás y convierten la lista en una sola respuesta
     repetida. Tres por nombre: bastantes para elegir bloque, pocos para
     tapar al resto. */
  const cuantos = new Map<string, number>();
  const salida: Resultado[] = [];
  for (const r of ordenados) {
    const n = (cuantos.get(r.titulo) ?? 0) + 1;
    if (n > 3) continue;
    cuantos.set(r.titulo, n);
    salida.push(r);
    if (salida.length >= tope) break;
  }
  return salida;
}
