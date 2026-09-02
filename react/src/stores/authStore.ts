import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useProfileStore } from './profileStore';

interface AuthState {
  /** Whether the initial auth check has completed */
  initialized: boolean;

  /** Current Supabase session, or null */
  session: Session | null;

  /** Current user, or null */
  user: User | null;

  /** Set the session (called by auth state listener) */
  setSession: (session: Session | null) => void;

  /** Mark auth as initialized */
  setInitialized: () => void;

  /** Sign out of Supabase and clear local session state */
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  initialized: false,
  session: null,
  user: null,

  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
    });
  },

  setInitialized: () => {
    set({ initialized: true });
  },

  signOut: async () => {
    // Cerrar en Supabase primero: si sólo se limpiara el estado local,
    // la sesión seguiría en localStorage y volvería al recargar.
    try {
      if (supabase) await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.warn('[auth] signOut', err);
    }
    // Soltar el puntero al perfil propio. Sin esto, la siguiente persona
    // que entrara en este navegador abría el editor sobre el borrador de la
    // anterior: `mineName` seguía apuntando a su perfil.
    try {
      useProfileStore.getState().setMine(null);
    } catch (err) {
      console.warn('[auth] setMine', err);
    }

    set({ session: null, user: null });
  },
}));
