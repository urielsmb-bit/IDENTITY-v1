import { BLOQUE_POR_ID } from '@/data/bloques';

/**
 * Lo que aparece al tocar algo en el lienzo.
 *
 * ────────────────────────────────────────────────────────────────────────
 * DE DONDE SALEN LOS BOTONES
 * ────────────────────────────────────────────────────────────────────────
 *
 * De la propia declaración del bloque. Cada uno ya dice en qué grupos se
 * reparten sus controles, y esos grupos SON las opciones que tiene sentido
 * enseñar al seleccionarlo:
 *
 *     avatar  →  Contenido · Forma y sitio · Borde y resplandor
 *     name    →  Texto · Tipografía · Color · Efectos · Resplandor · Composición
 *
 * Escribir esa lista a mano habría sido una tercera copia de algo que ya
 * está dicho dos veces —en el catálogo y en el editor— y la primera que se
 * quedaría vieja: se añade un grupo a un bloque y aquí no aparece, sin que
 * nada falle ni avise.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUE NO ABRE LA HOJA DIRECTAMENTE
 * ────────────────────────────────────────────────────────────────────────
 *
 * Tocar algo y que salte un panel tapando media pantalla es violento
 * cuando lo único que querías era ver qué es eso. Primero se selecciona
 * —el lienzo lo marca, esta barra dice qué has cogido y qué se le puede
 * hacer— y solo al elegir una opción sube la hoja.
 *
 * Un paso más, pero reversible: tocar fuera deselecciona y no ha pasado
 * nada.
 */

export interface BarraContextualProps {
  bloque: string;
  /** Abre la hoja de ese bloque, en el grupo elegido. */
  onGrupo: (bloque: string, grupo: string) => void;
  onCerrar: () => void;
}

export function BarraContextual({ bloque, onGrupo, onCerrar }: BarraContextualProps) {
  const def = BLOQUE_POR_ID[bloque];
  if (!def) return null;

  return (
    <div className="em__ctx" role="toolbar" aria-label={`Opciones de ${def.nombre}`}>
      <span className="em__ctx-q">
        <span className="em__ctx-i" aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: def.icono }} />
        {def.nombre}
      </span>

      <div className="em__ctx-ops">
        {def.grupos.map((g) => (
          <button
            key={g.titulo}
            type="button"
            className="em__ctx-b"
            onClick={() => onGrupo(bloque, g.titulo)}
          >
            {g.titulo}
          </button>
        ))}
      </div>

      <button type="button" className="em__ctx-x" onClick={onCerrar} aria-label="Quitar selección">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
