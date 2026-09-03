import { create } from 'zustand';
import type { Profile } from '@/types';
import { normalizarPerfil } from '@/lib/normalizar';

// ── localStorage helpers (safe reads/writes) ──────────────
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded or private mode */ }
}

// ── Storage keys (matching original localStorage keys) ─────
const PROFILES_KEY = 'identity.profiles.v2';
const STATS_KEY = 'identity.stats.v1';
const MINE_KEY = 'identity.mine.v1';
const VOTES_KEY = 'identity.votes.v1';
const SEEN_KEY = 'identity.seen.v1';

/** Lee el mapa de perfiles de localStorage saneando cada entrada: es
 *  contenido que el usuario puede editar a mano desde las herramientas del
 *  navegador y acaba alimentando variables CSS, URLs e `iframe`. */
function leerPerfiles(): Record<string, Profile> {
  const crudo = read<Record<string, unknown>>(PROFILES_KEY, {});
  const salida: Record<string, Profile> = {};
  for (const [nombre, perfil] of Object.entries(crudo)) {
    const limpio = normalizarPerfil(perfil);
    // La clave manda: un perfil guardado bajo otro nombre sería un perfil
    // huérfano imposible de abrir.
    if (limpio.username === nombre) salida[nombre] = limpio;
  }
  return salida;
}

// ── Sync events ───────────────────────────────────────────
export type SyncStatus = 'idle' | 'sending' | 'saved' | 'displaced' | 'conflict' | 'error';

interface SyncEvent {
  status: SyncStatus;
  error?: Error;
}

type SyncListener = (event: SyncEvent) => void;

// ── Profile Store ─────────────────────────────────────────
interface ProfileState {
  /** In-memory profile map (the "espejo" / mirror) */
  profiles: Record<string, Profile>;

  /** Username of the user's own active profile */
  mineName: string | null;

  /** Sync status for cloud saves */
  syncStatus: SyncStatus;

  /** Sync listeners */
  syncListeners: SyncListener[];

  // ── Actions ─────────────────────────────────────────────

  /** Load profiles from localStorage into memory */
  hydrate: () => void;

  /** Get a profile by username */
  get: (username: string) => Profile | undefined;

  /** Check if a profile exists */
  exists: (username: string) => boolean;

  /** Get all profiles as an array */
  list: () => Profile[];

  /** Save a profile locally and mark it pending cloud sync.
   *  Pass `prevUsername` when the handle changed so the entry is moved
   *  instead of duplicated. */
  save: (profile: Profile, prevUsername?: string) => void;

  /** Clear the pending-cloud flag after a successful server write, merging
   *  back the server-owned marks (`_id`, `_actualizado`). */
  markSynced: (username: string, patch?: Partial<Profile>) => void;

  /** Remove a profile */
  remove: (username: string) => void;

  /** Set the active own profile username */
  setMine: (username: string | null) => void;

  /** Get the current user's own profile */
  mine: () => Profile | undefined;

  /** Receive a profile from server (respects _sucio flag) */
  receiveFromServer: (profile: Profile) => void;

  /** Record a view for analytics */
  countView: (username: string) => void;

  /** Subscribe to sync events */
  onSync: (listener: SyncListener) => () => void;

  /** Notify sync listeners */
  notifySync: (status: SyncStatus, error?: Error) => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: leerPerfiles(),
  mineName: read<string | null>(MINE_KEY, null),
  syncStatus: 'idle' as SyncStatus,
  syncListeners: [],

  hydrate: () => {
    set({ profiles: leerPerfiles(), mineName: read<string | null>(MINE_KEY, null) });
  },

  get: (username) => {
    return get().profiles[username];
  },

  exists: (username) => {
    return username in get().profiles;
  },

  list: () => {
    return Object.values(get().profiles);
  },

  save: (profile, prevUsername) => {
    const username = profile.username;
    if (!username) return;

    // Mark as dirty for cloud sync. `_actualizado` no se toca aquí: es la
    // marca de concurrencia del servidor y pisarla obliga a guardarPerfil()
    // a tomar siempre el camino lento.
    const updated = { ...profile, _sucio: true };

    set((state) => {
      const next = { ...state.profiles, [username]: updated };

      // Renombrar el handle mueve la entrada; sin esto cada pulsación
      // dejaba un perfil huérfano en localStorage.
      if (prevUsername && prevUsername !== username) {
        delete next[prevUsername];
      }
      write(PROFILES_KEY, next);

      const mineName =
        prevUsername && state.mineName === prevUsername ? username : state.mineName;
      if (mineName !== state.mineName) write(MINE_KEY, mineName);

      return { profiles: next, mineName };
    });
  },

  markSynced: (username, patch) => {
    set((state) => {
      const existing = state.profiles[username];
      if (!existing) return state;
      const next = {
        ...state.profiles,
        [username]: { ...existing, ...(patch ?? {}), _sucio: false },
      };
      write(PROFILES_KEY, next);
      return { profiles: next };
    });
  },

  remove: (username) => {
    set((state) => {
      const next = { ...state.profiles };
      delete next[username];
      write(PROFILES_KEY, next);

      const newMine = state.mineName === username ? null : state.mineName;
      if (newMine !== state.mineName) {
        write(MINE_KEY, newMine);
      }
      return { profiles: next, mineName: newMine };
    });
  },

  setMine: (username) => {
    write(MINE_KEY, username);
    set({ mineName: username });
  },

  mine: () => {
    const { mineName, profiles } = get();
    return mineName ? profiles[mineName] : undefined;
  },

  receiveFromServer: (profile) => {
    const username = profile.username;
    if (!username) return;

    set((state) => {
      const existing = state.profiles[username];
      // Don't overwrite local unsaved changes
      if (existing?._sucio) return state;

      const next = { ...state.profiles, [username]: profile };
      write(PROFILES_KEY, next);
      return { profiles: next };
    });
  },

  countView: (username) => {
    const today = new Date().toISOString().slice(0, 10);
    const seen = read<Record<string, string>>(SEEN_KEY, {});

    // Only count once per day per profile
    if (seen[username] === today) return;

    seen[username] = today;
    write(SEEN_KEY, seen);

    // Increment view counter in stats
    const stats = read<Record<string, Record<string, number>>>(STATS_KEY, {});
    if (!stats[username]) stats[username] = {};
    stats[username][today] = (stats[username][today] || 0) + 1;
    write(STATS_KEY, stats);

    // Update profile view count in memory
    set((state) => {
      const p = state.profiles[username];
      if (!p) return state;
      const next = {
        ...state.profiles,
        [username]: { ...p, views: (p.views || 0) + 1 },
      };
      return { profiles: next };
    });
  },

  onSync: (listener) => {
    set((state) => ({
      syncListeners: [...state.syncListeners, listener],
    }));
    return () => {
      set((state) => ({
        syncListeners: state.syncListeners.filter((l) => l !== listener),
      }));
    };
  },

  notifySync: (status, error) => {
    set({ syncStatus: status });
    get().syncListeners.forEach((fn) => fn({ status, error }));
  },
}));

// ── Vote helpers ──────────────────────────────────────────
export function getMyVote(username: string): number | null {
  const votes = read<Record<string, number>>(VOTES_KEY, {});
  return votes[username] ?? null;
}

export function setMyVote(username: string, score: number): void {
  const votes = read<Record<string, number>>(VOTES_KEY, {});
  votes[username] = score;
  write(VOTES_KEY, votes);
}

// ── Analytics helpers ─────────────────────────────────────
export function getStats(username: string, days = 30): Record<string, number> {
  const stats = read<Record<string, Record<string, number>>>(STATS_KEY, {});
  const userStats = stats[username] || {};

  const now = new Date();
  const result: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result[key] = userStats[key] || 0;
  }
  return result;
}
