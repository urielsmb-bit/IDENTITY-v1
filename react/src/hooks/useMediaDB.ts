import { useCallback, useRef, useState } from 'react';
import * as mediaService from '@/lib/media';

/**
 * Hook for interacting with IndexedDB media storage.
 */
export function useMediaDB() {
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map<string, string>());

  const save = useCallback(async (blob: Blob): Promise<string> => {
    setLoading(true);
    try {
      return await mediaService.guardar(blob);
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback(async (ref: string): Promise<Blob | null> => {
    return mediaService.obtener(ref);
  }, []);

  const remove = useCallback(async (ref: string): Promise<boolean> => {
    cacheRef.current.delete(ref);
    return mediaService.borrar(ref);
  }, []);

  const resolve = useCallback((value: string): string => {
    return mediaService.resolver(value);
  }, []);

  const preload = useCallback(async (profile: Record<string, unknown>) => {
    setLoading(true);
    try {
      return await mediaService.precargar(profile);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    save,
    get,
    remove,
    resolve,
    preload,
    isRef: mediaService.esRef,
    available: mediaService.disponible,
  };
}
