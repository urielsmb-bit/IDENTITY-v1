import { useQuery } from '@tanstack/react-query';
import { useProfileStore } from '@/stores/profileStore';
import { useAuthStore } from '@/stores/authStore';
import * as backend from '@/lib/backend';
import { hasBackend } from '@/lib/supabase';

/**
 * Hook to load and access a profile by username.
 * Uses TanStack Query for server-state caching with fallback to local store.
 */
export function useProfile(username: string | undefined) {
  const localProfile = useProfileStore((s) => username ? s.profiles[username] : undefined);

  const query = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      if (!username) return null;

      // Try server first if backend is available
      if (hasBackend()) {
        const remote = await backend.cargarPerfil(username);
        if (remote) {
          useProfileStore.getState().receiveFromServer(remote);
          return remote;
        }
      }

      // Fall back to local
      return useProfileStore.getState().get(username) ?? null;
    },
    enabled: !!username,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  return {
    profile: query.data ?? localProfile ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to load the current user's own profile.
 */
export function useMyProfile() {
  const mineName = useProfileStore((s) => s.mineName);
  /**
   * La cuenta forma parte de la clave.
   *
   * Sin ella, la respuesta se guardaba bajo `['my-profile']` a secas y valía
   * cinco minutos: entrar con otra cuenta dentro de ese rato servía el perfil
   * de la anterior desde la cache, sin llegar a preguntar al servidor.
   */
  const idCuenta = useAuthStore((s) => s.user?.id ?? null);
  const listaAuth = useAuthStore((s) => s.initialized);

  const query = useQuery({
    queryKey: ['my-profile', idCuenta],
    // Mientras no se sepa si hay sesión no se pregunta: una consulta lanzada
    // antes de tiempo vuelve vacía y deja el editor creando un perfil nuevo.
    enabled: listaAuth,
    queryFn: async () => {
      if (hasBackend()) {
        const remote = await backend.cargarMio();
        if (remote) {
          useProfileStore.getState().receiveFromServer(remote);
          useProfileStore.getState().setMine(remote.username);
          return remote;
        }
      }
      return useProfileStore.getState().mine() ?? null;
    },
    staleTime: 1000 * 60 * 5,
  });

  return {
    profile: query.data ?? (mineName ? useProfileStore.getState().get(mineName) : undefined) ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/** El vocabulario de la interfaz no es el de las columnas del servidor. */
const ORDEN_SERVIDOR: Record<string, string> = {
  trending: 'puntuacion',
  popular: 'vistas',
  rating: 'nota',
  new: 'nuevos',
};

/**
 * Hook to discover public profiles.
 */
export function useDiscoverProfiles(options?: { order?: string; limit?: number }) {
  return useQuery({
    queryKey: ['discover', options?.order ?? null, options?.limit ?? null],
    queryFn: async () => {
      if (!hasBackend()) return [];
      return backend.descubrir({
        orden: ORDEN_SERVIDOR[options?.order ?? ''] ?? 'puntuacion',
        limite: options?.limit ?? 30,
      });
    },
    staleTime: 1000 * 60 * 2,
  });
}
