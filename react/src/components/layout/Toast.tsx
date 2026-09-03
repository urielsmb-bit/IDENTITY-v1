import { useEffect, useRef } from 'react';
import { useUIStore } from '@/stores/uiStore';

/**
 * Toast notification overlay — mirrors the original `<div id="toast">`.
 * Displays messages for 2.6s with optional warning style.
 */
export function Toast() {
  const toast = useUIStore((s) => s.toast);
  const clearToast = useUIStore((s) => s.clearToast);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!toast) return;

    // Auto-dismiss after 2.6s
    timerRef.current = setTimeout(() => {
      clearToast();
    }, 2600);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast, clearToast]);

  if (!toast) return null;

  return (
    <div
      className={`toast${toast.warn ? ' toast--warn' : ''} toast--visible`}
      id="toast"
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
}
