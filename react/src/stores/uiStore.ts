import { create } from 'zustand';

interface ToastData {
  message: string;
  warn?: boolean;
}

interface UIState {
  /** Current toast notification, or null if none visible */
  toast: ToastData | null;

  /** Show a toast message */
  showToast: (message: string, warn?: boolean) => void;

  /** Clear the current toast */
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  toast: null,

  showToast: (message, warn = false) => {
    set({ toast: { message, warn } });
  },

  clearToast: () => {
    set({ toast: null });
  },
}));
