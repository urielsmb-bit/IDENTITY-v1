import { useEffect, type RefObject } from 'react';
import { cursor as createCursor } from '@/lib/effects';

/**
 * Hook to apply a custom cursor effect.
 * The cursor is document-level (only one active at a time).
 */
export function useCursor(
  type: string,
  enabled = true,
  opciones: {
    img?: string; size?: number | null;
    trail?: number | null; trailFx?: string;
    /**
     * Donde se deja ver.
     *
     * Sin esto el cursor manda en toda la pagina, que es lo correcto en un
     * perfil publico —la pagina ES el perfil— pero no en el editor, donde
     * la mitad de la pantalla son mandos que no son del perfil. Se pasa la
     * referencia y no el nodo: al montar el efecto todavia no hay nodo.
     */
    ambitoRef?: RefObject<HTMLElement | null>;
  } = {},
) {
  const { img = '', size = null, trail = null, trailFx = '', ambitoRef } = opciones;
  useEffect(() => {
    // Con imagen propia se monta aunque el tipo sea "default".
    if (!enabled || (type === 'default' && !img)) return;

    const cleanup = createCursor(type, {
      img, size, trail, trailFx,
      ambito: ambitoRef ? ambitoRef.current : null,
    });
    return () => {
      cleanup?.();
    };
  }, [type, enabled, img, size, trail, trailFx, ambitoRef]);
}
