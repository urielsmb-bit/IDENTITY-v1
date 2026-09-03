import { useEffect, useRef } from 'react';
import { tilt as createTilt } from '@/lib/effects';

/**
 * Hook to apply 3D tilt effect to a card element.
 * Attach rootRef to the container and cardRef to the tilting element.
 */
export function useTilt(enabled = true, maxDeg = 12) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !rootRef.current || !cardRef.current) return;

    const cleanup = createTilt(rootRef.current, cardRef.current, maxDeg);
    return () => {
      cleanup?.();
    };
  }, [enabled, maxDeg]);

  return { rootRef, cardRef };
}
