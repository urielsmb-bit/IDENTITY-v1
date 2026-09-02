/**
 * Block and section definitions — migrated from data.js
 */

import type { CatalogItem } from './themes';

// ── Hero Blocks ─────────────────────────────────────────────
/** Blocks available in the hero area. Users can toggle each on/off. */
export const BLOCKS: CatalogItem[] = [
  { id: 'avatar',  name: 'Avatar' },
  { id: 'name',    name: 'Nombre' },
  { id: 'handle',  name: '@usuario' },
  { id: 'meta',    name: 'Oficio y ubicación' },
  { id: 'joined',  name: 'Fecha de registro' },
  { id: 'fields',  name: 'Campos libres' },
  { id: 'status',  name: 'Estado' },
  { id: 'discord', name: 'Widget de Discord' },
  { id: 'live',    name: 'Actividad en vivo' },
  { id: 'bio',     name: 'Biografía' },
  { id: 'badges',  name: 'Badges' },
  { id: 'socials', name: 'Redes' },
  { id: 'music',   name: 'Música' },
  { id: 'level',   name: 'Nivel y XP' },
  { id: 'views',   name: 'Visitas (línea)' },
  { id: 'stats',   name: 'Estadísticas (caja)' },
];

// ── Default block order in the hero ─────────────────────────
export const BLOCK_ORDER: string[] = [
  'avatar', 'identity', 'handle', 'meta', 'joined',
  'fields', 'status', 'discord', 'live',
  'bio', 'badges', 'socials', 'music', 'level', 'views', 'stats',
];

// ── Scroll sections (below the hero) ────────────────────────
export const PAGE_SECTIONS: CatalogItem[] = [
  { id: 'about',    name: 'Sobre mí' },
  { id: 'links',    name: 'Enlaces' },
  { id: 'gallery',  name: 'Galería' },
  { id: 'projects', name: 'Proyectos' },
  { id: 'rate',     name: 'Califícame' },
];

// ── Blocks that accept their own box styling ────────────────
/** Avatar is excluded — it's a figure, not a box */
export const BLOQUES_CON_CAJA: string[] = [
  'identity', 'handle', 'meta', 'joined',
  'fields', 'status', 'discord',
  'live', 'bio', 'badges', 'socials', 'music', 'level', 'views', 'stats',
];

// ── Blocks that can be duplicated ───────────────────────────
/** Only blocks that carry their own content benefit from cloning.
 *  Duplicating avatar or level would just repeat the same data. */
export const BLOQUES_DUPLICABLES: string[] = ['bio', 'socials'];
