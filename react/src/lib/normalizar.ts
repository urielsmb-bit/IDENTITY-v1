import * as validar from './validar';
import type { Profile } from '@/types';
import {
  THEMES, ALIGNS, SURFACES, AV_SHAPES, AV_POS, AVATAR_FX, SOCIAL_STYLES, BADGE_STYLES,
  MUSIC_STYLES, BLOCK_STYLES, LAYOUT_MODES, STACK_POS, WIDTH_MODES, HOVER_FX,
  ENTER_FX, NAME_WEIGHTS, NAME_CASES, CURSORS, PARTICLES, STATUS_STATES,
  BLOCK_SURFACES, BLOCK_ANIMS, FONTS, ANIM_DIRS, ANIM_EASINGS, TRAIL_FX,
} from '@/data/themes';

/**
 * Catálogos que `validar.perfil` consulta para decidir qué valores son
 * legales en cada campo de lista (tema, partículas, cursor…).
 *
 * OJO: antes los buscaba en `window.ID`, que en esta app de React no existe
 * nunca. Con los catálogos vacíos, `deLista()` no encuentra ningún valor
 * válido y TODO campo de lista cae a su valor por defecto: sanear un perfil
 * le borraba el tema, las partículas, la fuente y la forma del avatar.
 * Por eso `perfil()` ahora exige los catálogos como parámetro obligatorio.
 */
export const CATALOGOS = {
  THEMES, ALIGNS, SURFACES, AV_SHAPES, AV_POS, AVATAR_FX, SOCIAL_STYLES, BADGE_STYLES,
  MUSIC_STYLES, BLOCK_STYLES, LAYOUT_MODES, STACK_POS, WIDTH_MODES, HOVER_FX,
  ENTER_FX, NAME_WEIGHTS, NAME_CASES, CURSORS, PARTICLES, STATUS_STATES,
  BLOCK_SURFACES, BLOCK_ANIMS, FONTS, ANIM_DIRS, ANIM_EASINGS, TRAIL_FX,
};

/**
 * Sanea un perfil que viene de un origen no fiable: localStorage (que el
 * usuario puede editar a mano) o la fila de otra persona en el servidor.
 *
 * Recorta textos, acota números a su rango, descarta URLs y `data:` que no
 * cumplan, limita las colecciones y deja fuera cualquier campo que no esté
 * en el esquema. Conserva las marcas internas (`_id`, `_actualizado`,
 * `_sucio`), de las que dependen el guardado y la sincronización.
 */
export function normalizarPerfil(p: unknown, defectos?: Partial<Profile>): Profile {
  return validar.perfil(p, defectos, CATALOGOS) as Profile;
}
