import { useQuery } from '@tanstack/react-query';
import { useProfileStore } from '@/stores/profileStore';
import { useAuthStore } from '@/stores/authStore';
/* De `publico` y no de `backend`: leer un perfil se hace con `fetch`, y
   asi esta ruta —la que recibe las visitas— no arrastra los 55 kB del SDK
   de Supabase para un GET. */
import * as publico from '@/lib/publico';

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
      if (publico.hayBackend()) {
        const remote = await publico.cargarPerfil(username);
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
    /**
     * Todavía no hay respuesta.
     *
     * Es `isPending` y no `isLoading`, que no son lo mismo y la diferencia
     * se paga cara aquí. `isLoading` quiere decir «pendiente Y pidiendo
     * ahora mismo», así que se apaga en cuanto la consulta deja de estar en
     * el aire — incluido cuando queda EN PAUSA porque el navegador se ha
     * quedado sin red. En esa pausa no hay perfil, no hay error y no hay
     * carga: los tres a la vez, que es justo el hueco por el que la página
     * se iba a «este perfil no existe». A alguien sin cobertura se le decía
     * que su página había desaparecido.
     *
     * `isPending` dice lo que de verdad hace falta saber: no se sabe nada
     * todavía.
     */
    esperando: query.isPending,
    /** En pausa por falta de red: pendiente, pero sin pedir nada. */
    sinRed: query.isPending && query.fetchStatus === 'paused',
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
      if (publico.hayBackend()) {
        /* Al vuelo. Esto es el perfil DEL DUEÑO: hace falta la sesion, y la
           sesion es el SDK. Pero quien mira el perfil de otra persona nunca
           llega aqui, y con un `import` normal arriba se lo bajaria igual. */
        const backend = await import('@/lib/backend');
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
  new: 'nuevos',
};

/**
 * Hook to discover public profiles.
 */
export function useDiscoverProfiles(options?: { order?: string; limit?: number }) {
  return useQuery({
    queryKey: ['discover', options?.order ?? null, options?.limit ?? null],
    queryFn: async () => {
      if (!publico.hayBackend()) return [];
      const backend = await import('@/lib/backend');
      return backend.descubrir({
        orden: ORDEN_SERVIDOR[options?.order ?? ''] ?? 'puntuacion',
        limite: options?.limit ?? 30,
      });
    },
    staleTime: 1000 * 60 * 2,
  });
}
