import type { AudioTrack, Profile, ProfileAudio } from '@/types';

/**
 * Plantillas: que se copia de un perfil y que NO.
 *
 * La frontera era «aspecto si, contenido no». Con ella una plantilla
 * llegaba a medias: se llevaba la forma de las cajas y la colocacion,
 * pero no la cancion ni el fondo, que en un perfil de estos son la mitad
 * del diseño. Quien la aplicaba se encontraba con algo que no se parecia
 * a lo que habia visto, y la culpa no era suya.
 *
 * La de ahora es otra y es mas fina: **de quien es el archivo**.
 *
 *  - Un enlace a un sitio publico —YouTube, Spotify, Vimeo, una imagen en
 *    cualquier servidor— no es de su autor, lo carga cualquiera y no se
 *    rompe porque el toque su perfil. VIAJA.
 *
 *  - Un archivo SUYO no. `subirMedio` guarda en una ruta fija por persona
 *    y por tipo —«<id>/fondo.mp4», con `upsert`— o sea que la direccion NO
 *    cambia al sustituir el archivo. Una plantilla que se la llevara no
 *    estaria copiando un fondo: estaria apuntando a un sitio que su autor
 *    reescribe cuando quiere. El dia que el cambie el suyo, cambia el de
 *    todos los perfiles que usen su plantilla, y no se entera nadie. Y
 *    «media:» ni siquiera sale del navegador donde se guardo.
 *
 * Lo que sigue sin viajar, y por lo de siempre, es QUIEN ERES: el nombre,
 * la biografia, el avatar, las redes, los enlaces, la galeria, la cuenta
 * de Discord y el texto de la pantalla de entrada —ese llega a llevar
 * contraseñas—. Eso no es el diseño de nadie: es la persona.
 *
 * Por eso esto sigue siendo una lista BLANCA: se nombra lo que se lleva.
 * Con una lista negra —«todo menos estos»— basta que alguien añada un
 * campo al perfil y se olvide de apuntarlo aqui para que se publique sin
 * querer, y ese fallo no avisa: sale bien en las pruebas y mal en la vida
 * de alguien. Aqui un campo nuevo se queda fuera por defecto, que es el
 * lado correcto por el que equivocarse.
 */
export const CAMPOS_PLANTILLA = [
  /* aspecto */
  'theme', 'accent', 'colText', 'colBg', 'colIcon', 'align', 'surface',
  'avShape', 'avPos', 'avatarFx', 'socialStyle', 'musicStyle', 'badgeStyle',
  'blockStyle', 'layoutMode', 'stackPos', 'widthMode', 'hoverFx', 'enterFx',
  'enterDir', 'enterMs', 'enterDelay', 'enterI', 'enterE',
  'nameWeight', 'nameCase', 'cursor', 'cursorSize', 'cursorTrail',
  'cursorTrailFx', 'particles', 'font', 'fontDisplay',

  /* medidas */
  'avSize', 'stackWidth', 'gap', 'radius', 'iconSize', 'nameSize', 'bioSize',
  'sBlur', 'sGlow', 'sBorderW', 'sWidthPct', 'sHeightPx', 'bgOpacity',
  'bgBlur', 'bgScale', 'bgDim', 'vignette', 'nameSpacing', 'lineHeight',
  'pad', 'sOpacity', 'sBorder', 'blockRadius', 'sColor', 'sBorderColor',

  /* interruptores de aspecto */
  'sBorderOn', 'avBorder', 'avGlow', 'monoIcons', 'bgFixed', 'gradient',
  'animatedName', 'glowName', 'glowSocials', 'glowBadges', 'noise', 'tilt',

  /* colocacion: sin esto una plantilla de rejilla libre no se parece en
     nada a lo que se publico, porque las coordenadas son el diseño */
  'blockOrder', 'blocksOff', 'canvasH', 'pos', 'bstyle',

  /* De que plantilla de arranque salio. Viaja porque quien la aplica se
     lleva EXACTAMENTE ese diseño, y el editor tiene que poder decirle cual
     es: sin esto, aplicar una plantilla publicada dejaba el perfil con el
     aspecto de «Vitrina» y el rotulo de la plantilla que hubiera antes. */
  'base',
] as const satisfies readonly (keyof Profile)[];

export type AjustesPlantilla = Partial<Profile>;

/**
 * Un enlace que se puede repartir dentro de una plantilla.
 *
 * Devuelve el enlace si es de fuera, y cadena vacia si no.
 *
 * Solo http(s). «media:» vive en el IndexedDB del navegador de su dueño y
 * para cualquier otra persona es un hueco; «blob:» muere con la pestaña
 * que lo creo; y «data:» meteria el archivo entero, byte a byte, dentro
 * de una fila de la tabla que se lee en bucle en la pagina de plantillas.
 *
 * Y fuera tambien el cubo de subidas —«/storage/v1/object/»—, que es el
 * caso explicado arriba: direccion fija que su dueño reescribe.
 */
export function enlaceCompartible(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s || !/^https?:\/\//i.test(s)) return '';
  if (/\/storage\/v\d+\/object\//i.test(s)) return '';
  return s;
}

/** Texto corto y saneado: lo que se pueda leer, con un tope. */
function corto(v: unknown, max = 120): string {
  return String(v ?? '').trim().slice(0, max);
}

/**
 * Una pista, si queda algo por donde sonar.
 *
 * `yt` es un id de YouTube y `embed` la direccion de un reproductor: ni
 * uno ni otro son un archivo de nadie, asi que pasan. `url` y `preview`
 * si pueden serlo, y por eso pasan por el filtro.
 *
 * Si despues de filtrar no queda NADA que suene, la pista se cae entera:
 * una fila con titulo y caratula que al pulsar no hace nada es peor que
 * no tener musica, porque promete.
 */
function pistaCompartible(v: unknown): AudioTrack | null {
  if (!v || typeof v !== 'object') return null;
  const t = v as Record<string, unknown>;

  const yt = corto(t.yt, 24);
  const embed = enlaceCompartible(t.embed);
  const url = enlaceCompartible(t.url);
  const preview = enlaceCompartible(t.preview);
  if (!yt && !embed && !url && !preview) return null;

  const src = t.src === 'youtube' || t.src === 'spotify' ? t.src : 'manual';
  return {
    title: corto(t.title),
    artist: corto(t.artist),
    length: corto(t.length, 12),
    cover: enlaceCompartible(t.cover),
    src,
    yt,
    preview,
    url,
    embed,
  };
}

/**
 * La musica de la plantilla.
 *
 * El titulo y el artista viajan con la cancion: son el nombre de una
 * obra, no algo que su autor haya escrito sobre si mismo.
 *
 * Devuelve `null` cuando no queda nada sonable, y entonces la plantilla
 * NO DICE NADA de la musica —igual que con el fondo—, asi que aplicarla
 * no le borra a nadie la suya.
 */
function audioCompartible(v: unknown): ProfileAudio | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as Record<string, unknown>;

  const pistas = Array.isArray(a.tracks)
    ? a.tracks.slice(0, 24).map(pistaCompartible).filter((t): t is AudioTrack => t !== null)
    : [];

  const yt = corto(a.yt, 24);
  const ytUrl = enlaceCompartible(a.ytUrl);
  if (pistas.length === 0 && !yt && !ytUrl) return null;

  const src = a.src === 'youtube' || a.src === 'spotify' ? a.src : 'manual';
  return {
    provider: corto(a.provider, 24),
    src,
    title: corto(a.title),
    artist: corto(a.artist),
    cover: enlaceCompartible(a.cover),
    yt,
    ytUrl,
    tracks: pistas,
  };
}

/** Saca de un perfil lo que se puede publicar, y nada mas. */
export function extraerPlantilla(p: Partial<Profile>): AjustesPlantilla {
  const out: Record<string, unknown> = {};

  for (const campo of CAMPOS_PLANTILLA) {
    const v = (p as Record<string, unknown>)[campo];
    if (v !== undefined) out[campo] = v;
  }

  /* ---- el fondo ----------------------------------------------------
     Un color o un degradado son una decision de diseño y no son de
     nadie. Una foto o un video, depende: de fuera va dentro de la
     plantilla como cualquier otro ajuste; archivo suyo, la plantilla NO
     DICE NADA del fondo y ni el campo aparece.

     Callar no es lo mismo que decir «sin fondo», y la diferencia importa.
     Antes se ponia `bgType:'none'` y eso hacia dos cosas mal a la vez:
     al aplicar la plantilla le BORRABA el fondo a quien la usara —ponias
     una y perdias tu video sin que nadie te avisara— y ademas mentia
     sobre el diseño, porque «sin fondo» es una decision de su autor y
     esto era otra cosa: que no podiamos llevarnos su archivo. */
  const tipo = p.bgType;
  if (tipo === 'none' || tipo === 'color' || tipo === 'gradient') {
    out.bgType = tipo;
    out.bgValue = tipo === 'none' ? '' : (p.bgValue ?? '');
  } else if (tipo === 'image' || tipo === 'video') {
    const enlace = enlaceCompartible(p.bgValue);
    if (enlace) {
      out.bgType = tipo;
      out.bgValue = enlace;
      /* El poster va con el fondo o no va: una plantilla con poster y sin
         video enseñaria una foto fija que nadie puso. Y por la misma regla
         que el fondo: si esta en nuestro cubo es un archivo de su autor, y
         el dia que lo cambie deja a todo el que la use con otra imagen. */
      const poster = enlaceCompartible(p.bgPoster);
      if (poster) out.bgPoster = poster;
      /* La proporcion se lee de Vimeo al pegar el enlace. Sin ella hay
         que dar por hecho 16:9, y un video en otro formato sale con
         franjas en vez de cubrir la pantalla. */
      if (tipo === 'video' && p.bgRatio) out.bgRatio = p.bgRatio;
    }
  }

  /* ---- el cursor ---------------------------------------------------
     El cursor es del diseño, no de la persona, asi que va por la misma
     regla que el fondo: uno dibujado y colgado en cualquier sitio viaja;
     uno subido al cubo, no. */
  const cursor = enlaceCompartible(p.cursorImg);
  if (cursor) out.cursorImg = cursor;

  /* ---- la musica ---------------------------------------------------- */
  const audio = audioCompartible(p.audio);
  if (audio) out.audio = audio;

  return out as AjustesPlantilla;
}

/**
 * Aplica una plantilla sobre un perfil.
 *
 * Se vuelve a filtrar aunque los ajustes vengan de la base: esa fila la
 * escribio otra persona, y entre que se publico y ahora pudo cambiar el
 * catalogo de campos. Filtrar dos veces cuesta nada; que una plantilla
 * pueda pisar el nombre o la biografia de quien la aplica, mucho.
 */
export function aplicarPlantilla(
  perfil: Profile,
  ajustes: AjustesPlantilla | null | undefined,
): Profile {
  if (!ajustes || typeof ajustes !== 'object') return perfil;
  return { ...perfil, ...extraerPlantilla(ajustes) };
}
