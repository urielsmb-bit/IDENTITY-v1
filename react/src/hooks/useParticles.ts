import { useEffect, useRef } from 'react';
import { particles as createParticles } from '@/lib/effects';

/**
 * Hook to render canvas particles on a canvas element.
 * Returns a ref to attach to a <canvas> element.
 */
export function useParticles(
  type: string,
  color: string,
  enabled = true,
  /** `light` baja la cantidad: en la vista previa del editor no hace falta
   *  la densidad completa y el panel se mantiene fluido mientras se edita. */
  ligero = false,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!enabled || type === 'none' || !canvasRef.current) return;

    const cleanup = createParticles(canvasRef.current, type, color, {
      light: ligero,
    });
    return () => {
      cleanup?.();
    };
  }, [type, color, enabled, ligero]);

  return canvasRef;
}
