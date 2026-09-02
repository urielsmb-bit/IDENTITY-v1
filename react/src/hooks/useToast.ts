import { useCallback } from 'react';
import { useUIStore } from '@/stores/uiStore';

/**
 * Hook for showing toast notifications.
 */
export function useToast() {
  const showToast = useUIStore((s) => s.showToast);

  const toast = useCallback(
    (message: string, warn = false) => {
      showToast(message, warn);
    },
    [showToast],
  );

  return { toast };
}
