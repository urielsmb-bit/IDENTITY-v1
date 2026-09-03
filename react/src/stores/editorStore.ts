import { create } from 'zustand';
import type { Profile } from '@/types';

// ── Undo/Redo with manual history stack ─────────────────
// (Replaces the dashboard.js hist/hi undo system)

interface EditorState {
  /** Profile being edited */
  profile: Profile | null;

  /** Active editor section */
  section: string;

  /** Whether there are unsaved changes */
  dirty: boolean;

  /** Simulated viewport for preview */
  viewport: 'desktop' | 'tablet' | 'mobile';

  /** Editor complexity mode */
  mode: 'simple' | 'avanzado';

  /** Currently selected block for contextual editing */
  selectedBlock: string | null;

  /** Undo history stack (serialized profile snapshots).
   *  Invariante: history[historyIndex] es siempre el estado actual. */
  history: string[];

  /** Current position in history */
  historyIndex: number;

  /** Marca de tiempo y campo de la última entrada, para fundir pulsaciones */
  lastPushAt: number;
  lastPushKey: string | null;

  // ── Actions ─────────────────────────────────────────────

  /** Initialize the editor with a profile */
  init: (profile: Profile) => void;

  /** Update the profile being edited */
  update: (partial: Partial<Profile>) => void;

  /** Update a single field */
  updateField: <K extends keyof Profile>(key: K, value: Profile[K]) => void;

  /** Set the active section */
  setSection: (section: string) => void;

  /** Set the viewport */
  setViewport: (vp: 'desktop' | 'tablet' | 'mobile') => void;

  /** Set editor mode */
  setMode: (mode: 'simple' | 'avanzado') => void;

  /** Select a block for editing */
  selectBlock: (blockId: string | null) => void;

  /** Undo to previous state */
  undo: () => void;

  /** Redo to next state */
  redo: () => void;

  /** Check if undo is available */
  canUndo: () => boolean;

  /** Check if redo is available */
  canRedo: () => boolean;

  /** Mark as clean (after saving) */
  markClean: () => void;

  /** Merge server-owned marks into the draft WITHOUT marking it dirty —
   *  hacerlo con update() dispararía otro autoguardado en bucle. */
  syncMeta: (partial: Partial<Profile>) => void;

  /** Reset editor state */
  reset: () => void;
}

const MAX_HISTORY = 60;

/** Ventana en la que dos cambios al mismo campo cuentan como uno solo. */
const FUSION_MS = 600;

/** Marcas que son propiedad del servidor y no deben viajar en el historial:
 *  si un deshacer devolviera un perfil sin `_id`, el siguiente guardado
 *  intentaría crear un perfil nuevo en vez de actualizar el que ya existe. */
function conservarMarcas(restaurado: Profile, actual: Profile | null): Profile {
  if (!actual) return restaurado;
  if (actual._id) restaurado._id = actual._id;
  if (actual._actualizado) restaurado._actualizado = actual._actualizado;
  return restaurado;
}

/** Calcula el nuevo historial tras un cambio. Pulsaciones seguidas sobre el
 *  mismo campo se funden en una entrada: si no, escribir una palabra
 *  consumiría el historial entero y deshacer iría letra a letra. */
function historial(state: EditorState, profile: Profile, key: string | null) {
  const snapshot = JSON.stringify(profile);
  const now = Date.now();

  const funde =
    key !== null &&
    key === state.lastPushKey &&
    now - state.lastPushAt < FUSION_MS &&
    state.historyIndex >= 0;

  if (funde) {
    const history = state.history.slice();
    history[state.historyIndex] = snapshot;
    return { history, historyIndex: state.historyIndex, lastPushAt: now, lastPushKey: key };
  }

  // Un cambio nuevo descarta lo que hubiera por delante (rama de rehacer).
  const history = state.history.slice(0, state.historyIndex + 1);
  history.push(snapshot);
  if (history.length > MAX_HISTORY) history.shift();

  return { history, historyIndex: history.length - 1, lastPushAt: now, lastPushKey: key };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  profile: null,
  section: 'overview',
  dirty: false,
  viewport: 'desktop',
  mode: 'simple',
  selectedBlock: null,
  history: [],
  historyIndex: -1,
  lastPushAt: 0,
  lastPushKey: null,

  init: (profile) => {
    const snapshot = JSON.stringify(profile);
    set({
      profile: JSON.parse(snapshot),
      dirty: false,
      history: [snapshot],
      historyIndex: 0,
      section: 'overview',
      selectedBlock: null,
      lastPushAt: 0,
      lastPushKey: null,
    });
  },

  update: (partial) => {
    set((state) => {
      if (!state.profile) return state;
      const profile = { ...state.profile, ...partial };
      const keys = Object.keys(partial);
      const key = keys.length === 1 ? keys[0]! : null;
      return { profile, dirty: true, ...historial(state, profile, key) };
    });
  },

  updateField: (key, value) => {
    set((state) => {
      if (!state.profile) return state;
      const profile = { ...state.profile, [key]: value };
      return { profile, dirty: true, ...historial(state, profile, String(key)) };
    });
  },

  setSection: (section) => set({ section }),
  setViewport: (viewport) => set({ viewport }),
  setMode: (mode) => set({ mode }),
  selectBlock: (blockId) => set({ selectedBlock: blockId }),

  undo: () => {
    const { history, historyIndex, profile } = get();
    if (historyIndex <= 0) return;

    const newIndex = historyIndex - 1;
    const restaurado = JSON.parse(history[newIndex]!) as Profile;
    set({
      profile: conservarMarcas(restaurado, profile),
      historyIndex: newIndex,
      dirty: true,
      lastPushKey: null,
    });
  },

  redo: () => {
    const { history, historyIndex, profile } = get();
    if (historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;
    const restaurado = JSON.parse(history[newIndex]!) as Profile;
    set({
      profile: conservarMarcas(restaurado, profile),
      historyIndex: newIndex,
      dirty: true,
      lastPushKey: null,
    });
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  markClean: () => set({ dirty: false }),

  syncMeta: (partial) => {
    set((state) => {
      if (!state.profile) return state;
      return { profile: { ...state.profile, ...partial } };
    });
  },

  reset: () => set({
    profile: null,
    section: 'overview',
    dirty: false,
    viewport: 'desktop',
    mode: 'simple',
    selectedBlock: null,
    history: [],
    historyIndex: -1,
    lastPushAt: 0,
    lastPushKey: null,
  }),
}));
