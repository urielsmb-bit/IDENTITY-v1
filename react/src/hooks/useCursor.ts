import { useEffect } from 'react';
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
  } = {},
) {
  const { img = '', size = null, trail = null, trailFx = '' } = opciones;
  useEffect(() => {
    // Con imagen propia se monta aunque el tipo sea "default".
    if (!enabled || (type === 'default' && !img)) return;

    const cleanup = createCursor(type, { img, size, trail, trailFx });
    return () => {
      cleanup?.();
    };
  }, [type, enabled, img, size, trail, trailFx]);
}
