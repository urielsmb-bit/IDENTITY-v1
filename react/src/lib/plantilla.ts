import type { Profile } from '@/types';

/**
 * Plantillas: que se copia de un perfil y que NO.
 *
 * Una plantilla es el ASPECTO de un perfil, no su contenido. Cuando
 * alguien publica la suya, lo que viaja a una tabla publica son colores,
 * tipografias y colocacion —nunca su nombre, su biografia, su avatar, sus
 * enlaces, sus redes ni ningun archivo suyo—.
 *
 * Por eso esto es una lista BLANCA: se nombra lo que se lleva. Con una
 * lista negra —«todo menos estos»— basta que alguien añada un campo al
 * perfil y se olvide de apuntarlo aqui para que se publique sin querer, y
 * ese fallo no avisa: sale bien en las pruebas y mal en la vida de
 * alguien. Aqui un campo nuevo se queda fuera por defecto, que es el lado
 * correcto por el que equivocarse.
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
] as const satisfies readonly (keyof Profile)[];

export type AjustesPlantilla = Partial<Profile>;

/**
 * Fondos que SI viajan.
 *
 * Un color o un degradado son una decision de diseño y no son de nadie.
 * Una imagen o un video son un archivo de su dueño: publicarlos dentro de
 * una plantilla los repartiria por todos los perfiles que la usen, y ni
 * quien la publica lo esperaria ni quien la usa lo querria. Ademas
 * `bgValue` seria un enlace a su carpeta del cubo, que puede borrar
 * cuando quiera y dejar a todo el mundo con un hueco.
 */
const FONDOS_QUE_VIAJAN = ['none', 'color', 'gradient'] as const;

/** Saca de un perfil lo que se puede publicar, y nada mas. */
export function extraerPlantilla(p: Partial<Profile>): AjustesPlantilla {
  const out: Record<string, unknown> = {};

  for (const campo of CAMPOS_PLANTILLA) {
    const v = (p as Record<string, unknown>)[campo];
    if (v !== undefined) out[campo] = v;
  }

  const tipo = p.bgType;
  if (tipo && (FONDOS_QUE_VIAJAN as readonly string[]).includes(tipo)) {
    out.bgType = tipo;
    out.bgValue = tipo === 'none' ? '' : (p.bgValue ?? '');
  }
  /* Y si tenia foto o video, la plantilla NO DICE NADA del fondo: ni el
     campo aparece.

     Antes decia `bgType:'none'`, y eso hacia dos cosas mal a la vez. Una,
     al aplicarla le BORRABA el fondo a quien la usaba: ponias una
     plantilla y perdias tu video sin que nadie te avisara. Y dos, mentia
     sobre el diseño: «sin fondo» era una decision de su autor, no lo que
     habia pasado. Lo que habia pasado es que no podiamos llevarnos su
     archivo.
     
     Callando el campo, las dos cosas quedan bien: un autor que de verdad
     eligio «sin fondo» lo dice —eso SI viaja, esta en la lista de
     arriba— y uno que tenia una foto no toca el fondo de nadie. */

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
