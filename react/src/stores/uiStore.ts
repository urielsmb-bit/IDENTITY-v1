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

  /**
   * La ventana de «Mejorar a Premium», abierta o no.
   *
   * Vive aquí y no en una página porque se abre desde muchos sitios —el
   * menú del editor, cada candado de una opción Pro, las plantillas— y
   * siempre ENCIMA de lo que estabas haciendo. Antes cada uno llevaba a
   * `/pricing` y te sacaba del editor justo cuando estabas decidiendo.
   */
  premiumAbierto: boolean;
  abrirPremium: () => void;
  cerrarPremium: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  toast: null,
  premiumAbierto: false,
  abrirPremium: () => set({ premiumAbierto: true }),
  cerrarPremium: () => set({ premiumAbierto: false }),

  showToast: (message, warn = false) => {
    set({ toast: { message, warn } });
  },

  clearToast: () => {
    set({ toast: null });
  },
}));
