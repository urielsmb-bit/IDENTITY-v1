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

/**
 * ────────────────────────────────────────────────────────────────────────
 * EL CAJON DE PERFILES TIENE FONDO
 * ────────────────────────────────────────────────────────────────────────
 *
 * `receiveFromServer` guardaba en `localStorage` TODOS los perfiles que
 * visitas, para siempre y sin tope. Y un perfil no es poca cosa: el saneado
 * admite imagenes incrustadas de hasta ocho megas en `avatarUrl` o en el
 * fondo, asi que UNO SOLO puede llenar la cuota del navegador entera.
 *
 * Lo grave no es el espacio: es lo que pasa despues. `write` se traga el
 * error de cuota en silencio —y hace bien, no hay nada que decirle a nadie—,
 * asi que a partir de ese momento deja de guardarse TAMBIEN TU PROPIO
 * PERFIL. El editor sigue funcionando, no avisa de nada, y al recargar te
 * faltan los ultimos cambios. Un fallo de guardado disfrazado de cache.
 *
 * Con tope, eso no puede pasar:
 *
 *   · el tuyo no se toca nunca;
 *   · de los demas se quedan los DIEZ ultimos que miraste, que es de sobra
 *     para el unico uso que tiene esto —pintar algo si el servidor no
 *     contesta al volver a un perfil—;
 *   · y ademas hay un tope de tamaño, porque diez perfiles ligeros caben y
 *     uno con una foto incrustada no. Se van cayendo los mas viejos hasta
 *     que entra.
 */
const TOPE_AJENOS = 10;
/**
 * El reloj de las visitas, que NO es `Date.now()` a secas.
 *
 * Con `Date.now()`, dos perfiles vistos en el mismo milisegundo empatan, y un
 * empate lo desharia el orden de insercion: se quedaria el MAS VIEJO, que es
 * justo al reves de lo que hay que hacer. Con esto cada visita es siempre
 * mayor que la anterior, y como parte de la hora de verdad, el orden tambien
 * se sostiene entre sesiones.
 */
let ultimaVisita = 0;
function ahora(): number {
  ultimaVisita = Math.max(Date.now(), ultimaVisita + 1);
  return ultimaVisita;
}
/** Kilobyte arriba o abajo, la cuota tipica es de cinco megas. */
const TOPE_BYTES = 1_200_000;

function podar(mapa: Record<string, Profile>, mio: string | null): Record<string, Profile> {
  const ajenos = Object.entries(mapa)
    .filter(([u]) => u !== mio)
    .sort((a, b) => (Number((b[1] as any)._visto) || 0) - (Number((a[1] as any)._visto) || 0));
  if (ajenos.length <= TOPE_AJENOS) {
    // Aun asi hay que mirar el tamaño: uno solo puede pasarse.
    if (JSON.stringify(mapa).length <= TOPE_BYTES) return mapa;
  }

  const salen = ajenos.slice(0, TOPE_AJENOS);
  const fuera: Record<string, Profile> = {};
  if (mio && mapa[mio]) fuera[mio] = mapa[mio];
  for (const [u, p] of salen) fuera[u] = p;

  /* Y por peso, del mas viejo al mas nuevo. El tuyo se queda aunque sea el
     que se pasa: es el unico que no se puede volver a pedir al servidor si
     todavia no se ha subido. */
  while (salen.length > 0 && JSON.stringify(fuera).length > TOPE_BYTES) {
    const [u] = salen.pop()!;
    delete fuera[u];
  }
  return fuera;
}

/** Guarda el mapa ya podado. */
function escribirPerfiles(mapa: Record<string, Profile>, mio: string | null) {
  write(PROFILES_KEY, podar(mapa, mio));
}

// ── Storage keys (matching original localStorage keys) ─────
/* Los nombres llevan «identity» porque asi se llamaba esto antes, y se
   quedan: son llaves de localStorage, no texto que lea nadie. Cambiarlas
   por «sharee» le borraria a cada persona que ya use la pagina su perfil
   local, sus favoritas y sus votos, que es un precio muy alto por una
   palabra que no se ve. */
const PROFILES_KEY = 'identity.profiles.v2';
const MINE_KEY = 'identity.mine.v1';
const VOTES_KEY = 'identity.votes.v1';

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

// ── Profile Store ─────────────────────────────────────────
interface ProfileState {
  /** In-memory profile map (the "espejo" / mirror) */
  profiles: Record<string, Profile>;

  /** Username of the user's own active profile */
  mineName: string | null;

  // ── Actions ─────────────────────────────────────────────

  /** Get a profile by username */
  get: (username: string) => Profile | undefined;

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
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: leerPerfiles(),
  mineName: read<string | null>(MINE_KEY, null),

  get: (username) => {
    return get().profiles[username];
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

      /* El nombre nuevo se calcula ANTES de guardar. Al renombrar tu propio
         perfil, la entrada vieja se acaba de borrar; si la poda recibiera el
         nombre viejo, el tuyo entraria como el de un desconocido y podria
         caer con los demas. */
      const mineName =
        prevUsername && state.mineName === prevUsername ? username : state.mineName;
      escribirPerfiles(next, mineName);
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
      escribirPerfiles(next, state.mineName);
      return { profiles: next };
    });
  },

  remove: (username) => {
    set((state) => {
      const next = { ...state.profiles };
      delete next[username];
      escribirPerfiles(next, state.mineName);

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

      /* La marca de cuando lo viste. Es lo que decide quien se queda
         cuando hay que podar, y lleva `_` delante como todas las marcas
         internas: `aFila` no sube al servidor nada que empiece asi. */
      const next = {
        ...state.profiles,
        [username]: { ...profile, _visto: ahora() } as Profile,
      };
      escribirPerfiles(next, state.mineName);
      return { profiles: next };
    });
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

/* Aqui vivia un contador de visitas de andar por casa: `countView` apuntaba
   en localStorage cada perfil que mirabas y `getStats` lo leia. Las
   analiticas pasaron al servidor hace tiempo —contar visitas en el
   navegador de quien mira significaba que desde el movil veias ceros— y al
   mudarse se llevaron la lectura pero no la escritura. Lo que quedaba era
   una lista que crecia sola en el disco de cada visitante, una fila por
   cada perfil visitado y por cada dia, que no leia ni iba a leer nadie.
   Las visitas de verdad las cuenta `registrar-vista`, que es el unico
   sitio donde se ve la IP y por tanto el unico que puede distinguir a una
   persona de otra. */
