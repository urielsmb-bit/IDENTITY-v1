import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProfileStore } from '@/stores/profileStore';
import { useAuthStore } from '@/stores/authStore';
import { useMyProfile } from '@/hooks/useProfile';
import { useIdDiscordDeLaSesion } from '@/hooks/useDiscord';
import { useEditorStore } from '@/stores/editorStore';
import { useToast } from '@/hooks/useToast';
import { ProfileView } from '@/components/profile/ProfileView';
import {
  SURFACES, LAYOUT_MODES, PARTICLES, CURSORS, ENTER_FX, TRAIL_FX,
} from '@/data/themes';
import { NETS, NET_GROUPS, NET_ORDER } from '@/data/nets';
import {
  Campo,
  ColorRGB,
  Deslizador,
  Interruptor,
  Tarjetas,
  Subpanel,
} from '@/components/dashboard/Controles';
import { SubirMedio } from '@/components/dashboard/SubirMedio';
import { EditorBloque } from '@/components/dashboard/EditorBloque';
import { LienzoBloques } from '@/components/dashboard/LienzoBloques';
import { PanelAnimacion } from '@/components/dashboard/PanelAnimacion';
import { esVimeo, idVimeo } from '@/lib/vimeo';
import { useVimeo } from '@/hooks/useVimeo';
import { SubirFondo } from '@/components/dashboard/SubirFondo';
import { AjustesCuenta } from '@/components/dashboard/AjustesCuenta';
import { Guia } from '@/components/dashboard/Guia';
import { Frontera } from '@/components/layout/Frontera';
import { useGuia } from '@/hooks/useGuia';
import { PanelInsignias } from '@/components/dashboard/PanelInsignias';
import { DIBUJOS } from '@/components/dashboard/dibujos';
import { BLOQUES, BLOQUE_POR_ID, type DefBloque, BLOQUES_APAGADOS_POR_DEFECTO } from '@/data/bloques';
import { safeMedia } from '@/lib/utils';
import * as backend from '@/lib/backend';
import { hasBackend } from '@/lib/supabase';
import type { Profile, BlockPos, SocialLink } from '@/types';


/** 2.354 no le dice nada a nadie; 21:9 sí. Se busca el nombre conocido más
 *  cercano y, si no hay ninguno, se enseña el número. */
function proporcionVimeo(r: number): string {
  const conocidas: [number, string][] = [
    [16 / 9, '16:9'], [21 / 9, '21:9'], [4 / 3, '4:3'],
    [1, '1:1'], [9 / 16, '9:16'], [2.35, '2.35:1'],
  ];
  for (const [v, nombre] of conocidas) {
    if (Math.abs(r - v) < 0.06) return nombre;
  }
  return `${r.toFixed(2)}:1`;
}

/** Un icono propio es una URL o un data URI; lo demas es el id de una red
 *  del catalogo o un emoji. */
function esImagen(v: string): boolean {
  return v.startsWith('data:') || v.startsWith('http');
}

/**
 * Toma una foto de dónde está cada bloque ahora mismo y la convierte en
 * coordenadas del lienzo (% de la caja). Se mide el DOM real, así que da
 * igual el tema o los tamaños: se entra al lienzo viendo exactamente lo
 * mismo que se estaba viendo.
 */
function sembrarLienzo(profile: Profile): { pos: Record<string, BlockPos>; canvasH: number | null } {
  const pila = document.querySelector<HTMLElement>('.dashboard__preview .pf-stack');
  if (!pila) return { pos: profile.pos ?? {}, canvasH: profile.canvasH ?? null };

  const base = pila.getBoundingClientRect();
  if (!base.width || !base.height) {
    return { pos: profile.pos ?? {}, canvasH: profile.canvasH ?? null };
  }

  const salida: Record<string, BlockPos> = { ...(profile.pos ?? {}) };
  pila.querySelectorAll<HTMLElement>('[data-bloque]').forEach((el) => {
    const id = el.dataset.bloque;
    if (!id) return;
    const r = el.getBoundingClientRect();
    salida[id] = {
      ...(salida[id] ?? { col: 1, span: 12, align: 'stretch' }),
      // Se copia la caja tal cual está: posición Y tamaño. Así entrar al
      // lienzo no cambia el formato — Normal, Split o Minimal se ven igual
      // que antes de entrar, y cada bloque conserva el tamaño de su
      // contenido en vez de estirarse a todo el ancho.
      x: Math.round(((r.left - base.left) / base.width) * 1000) / 10,
      y: Math.round(r.top - base.top),
      // Medio punto de holgura: al pasar de píxeles a % el redondeo dejaba
      // las cajas justas al límite y el contenido se partía de línea (las
      // redes se apilaban, "0 visitas" caía en dos renglones).
      w: Math.min(100, Math.ceil((r.width / base.width) * 1000) / 10 + 0.5),
    };
  });
  // El lienzo hereda el alto que tenía el diseño: así entrar en él no
  // recentra la tarjeta ni desplaza el conjunto.
  return { pos: salida, canvasH: Math.round(base.height) };
}

/** Color de relleno que usa cada superficie mientras nadie elija uno. */
const COLOR_SUPERFICIE: Record<string, string> = {
  glass: '#FFFFFF',
  solid: '#0D0D0D',
  outline: '#FFFFFF',
  glow: '#0D0D0D',
};

/** Opacidad por defecto de cada superficie, según profile.css. */
const OPACIDAD_SUPERFICIE: Record<string, number> = {
  glass: 9,
  solid: 92,
  outline: 0,
  glow: 55,
};

/**
 * Formatos del perfil.
 *
 * No son un motor de layout aparte: cada uno aplica una combinación de
 * campos que ya existen. "Split" es la posición de avatar "al lado", y
 * "Minimal" quita la caja. Guardar además un campo `formato` habría creado
 * dos fuentes de verdad para lo mismo.
 */
const FORMATOS = [
  {
    id: 'normal' as const,
    name: 'Normal',
    ajustes: { avPos: 'center', align: 'center' },
    dibujo: (
      <svg viewBox="0 0 54 34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="27" cy="8" r="5" fill="currentColor" stroke="none" />
        <path d="M15 19h24M11 25h32M19 31h16" />
      </svg>
    ),
  },
  {
    id: 'split' as const,
    name: 'Split',
    // No toca `align`: Split solo pega la cabecera al avatar; el resto
    // del perfil se queda como estuviera, normalmente centrado.
    ajustes: { avPos: 'side' },
    dibujo: (
      <svg viewBox="0 0 54 34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="13" r="6" fill="currentColor" stroke="none" />
        <path d="M25 10h18M25 17h13" />
        <path d="M6 28h42" opacity=".55" />
      </svg>
    ),
  },
  {
    id: 'minimal' as const,
    name: 'Minimal',
    ajustes: { avPos: 'center', align: 'center', surface: 'none' },
    dibujo: (
      <svg viewBox="0 0 54 34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="27" cy="7" r="4" fill="currentColor" stroke="none" />
        <path d="M18 16h18" />
        <rect x="13" y="23" width="8" height="7" rx="2" fill="currentColor" stroke="none" />
        <rect x="23" y="23" width="8" height="7" rx="2" fill="currentColor" stroke="none" />
        <rect x="33" y="23" width="8" height="7" rx="2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

/* Iconos de trazo, no emoji. Un emoji lo dibuja el sistema operativo: cambia
   de forma y de color en cada aparato, no hereda el color del tema y no se
   le puede dar resplandor. Estos son nuestros y se comportan. */
const SECTIONS = [
  { id: 'overview', name: 'Perfil', desc: 'Tu foto, tu fondo y quién eres.', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>` },
  { id: 'design', name: 'Diseño', desc: 'Tema, colores, tipografía y forma de la tarjeta.', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20 20 4"/><path d="M4 20h6"/><path d="M4 20v-6"/><path d="M14 4h6v6"/></svg>` },
  { id: 'blocks', name: 'Bloques', desc: 'Qué piezas aparecen en tu perfil y en qué orden.', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>` },
  { id: 'links', name: 'Redes & Enlaces', desc: 'Adónde lleva tu perfil: redes, enlaces y contacto.', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13.5a4 4 0 0 0 5.7.3l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10.5a4 4 0 0 0-5.7-.3l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.5-1.5"/></svg>` },
  { id: 'badges', name: 'Badges', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 3 8l9 14 9-14-9-6Z"/><path d="M3 8h18M9 8l3 14M15 8l-3 14"/></svg>` },
  { id: 'settings', name: 'Ajustes', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/></svg>` },
];

function createBlankProfile(username = 'usuario'): Profile {
  return {
    username,
    name: 'Tu Nombre',
    title: 'Creador Digital',
    location: '',
    pronouns: '',
    emoji: '✨',
    age: null,
    avatarUrl: '',
    bio: '¡Hola! Este es mi perfil en IDENTITY.',
    about: '',
    joined: new Date().toISOString(),
    theme: 'cyberpunk',
    accent: '#A855F7',
    colText: '',
    colBg: '',
    colIcon: '',
    align: 'center',
    surface: 'glass',
    avShape: 'circle',
    avPos: 'center',
    avatarFx: 'pulse',
    socialStyle: 'icons',
    musicStyle: 'compact',
    badgeStyle: 'icons',
    blockStyle: 'glass',
    layoutMode: 'stack',
    stackPos: 'center',
    widthMode: 'fixed',
    hoverFx: 'lift',
    enterFx: 'rise',
    nameWeight: '700',
    nameCase: 'none',
    cursor: 'default',
    particles: 'stars',
    font: 'space',
    fontDisplay: 'display',
    avSize: 112,
    stackWidth: 460,
    gap: 16,
    radius: 18,
    iconSize: 20,
    nameSize: 0,
    bioSize: 0,
    sBlur: 22,
    sGlow: 40,
    sBorderW: 1,
    sWidthPct: null,
    sHeightPx: null,
    bgScale: 100,
    sColor: '',
    sBorderColor: '',
    sBorderOn: true,
    bgOpacity: 100,
    bgBlur: 0,
    bgDim: 30,
    vignette: 40,
    nameSpacing: 0,
    lineHeight: 0,
    pad: null,
    sOpacity: null,
    sBorder: null,
    blockRadius: null,
    views: 0,
    avBorder: true,
    avGlow: true,
    monoIcons: false,
    bgFixed: true,
    gradient: true,
    animatedName: true,
    glowName: true,
    glowSocials: true,
    glowBadges: true,
    noise: true,
    tilt: true,
    gate: false,
    verified: false,
    discoverable: true,
    showStats: true,
    showRate: true,
    bgType: 'gradient',
    bgValue: 'linear-gradient(135deg, #0d0c22 0%, #1e1b4b 50%, #0f172a 100%)',
    socials: [
      { net: 'github', url: 'https://github.com', label: 'GitHub' },
      { net: 'x', url: 'https://x.com', label: 'X' },
    ],
    links: [],
    projects: [],
    gallery: [],
    tags: ['developer'],
    blocksOff: [...BLOQUES_APAGADOS_POR_DEFECTO],
    blockOrder: [],
    canvasH: null,
    pos: {},
    bstyle: {},
  };
}

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const claimParam = searchParams.get('claim');
  const { toast } = useToast();

  // Se observa el nombre (string), no el objeto perfil: dependiendo del objeto,
  // cada autoguardado reiniciaba el editor entero.
  const mineName = useProfileStore((s) => s.mineName);
  const saveProfileToStore = useProfileStore((s) => s.save);
  const markSynced = useProfileStore((s) => s.markSynced);

  /**
   * El perfil de la CUENTA, traído del servidor.
   *
   * Antes el editor solo miraba el almacén local, así que entrar con una
   * cuenta en un navegador limpio abría un `mi_perfil` en blanco en vez del
   * perfil de esa cuenta; y entrar con otra cuenta en un navegador que ya
   * tenía uno editaba el del anterior. El hook existía y no lo llamaba nadie.
   */
  const { profile: perfilDeLaCuenta, isLoading: cargandoCuenta } = useMyProfile();
  const idCuenta = useAuthStore((s) => s.user?.id ?? null);
  /** Hasta que Supabase no responde no se sabe si hay sesión, y sin saberlo
   *  no se puede decidir de quién es el perfil que hay que abrir. */
  const authLista = useAuthStore((s) => s.initialized);
  /** Cuenta para la que ya se montó el editor, para detectar el cambio. */
  const cuentaMontada = useRef<string | null | undefined>(undefined);

  const {
    profile,
    section,
    viewport,
    dirty,
    init,
    update,
    updateField,
    setSection,
    setViewport,
    undo,
    redo,
    canUndo,
    canRedo,
    markClean,
    syncMeta,
  } = useEditorStore();

  /* La guia. Mira lo que hay hecho en el perfil y en que seccion estas para
     decidir que pista toca, si es que toca alguna. */
  const guia = useGuia(profile, section);

  const [saving, setSaving] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [activeNetGroup, setActiveNetGroup] = useState('all');
  /** Fila cuyo selector de icono está abierto. null = ninguno. */
  const [iconoAbierto, setIconoAbierto] = useState<number | null>(null);
  /** Bloque abierto en su editor. null = la lista. */
  const [bloqueAbierto, setBloqueAbierto] = useState<DefBloque | null>(null);

  /** Handle bajo el que el borrador vive hoy en el store. Cambia al renombrar. */
  const storeKeyRef = useRef('');
  /** Perfil para el que ya se inicializó el editor (undefined = ninguno todavía). */
  const initializedFor = useRef<string | null | undefined>(undefined);

  // Initialize editor with current profile or a blank profile.
  // Sólo se reinicia cuando cambia el perfil dueño: reiniciar en cada guardado
  // borraba el historial de deshacer y devolvía la sección a "Identidad".
  useEffect(() => {
    // Con servidor hay que esperar la respuesta antes de montar nada: montar
    // primero creaba un perfil en blanco, lo guardaba, y cuando llegaba el de
    // la cuenta ya había un borrador falso ocupando su sitio.
    if (hasBackend() && (!authLista || cargandoCuenta)) return;

    const cambioDeCuenta = cuentaMontada.current !== idCuenta;
    if (!cambioDeCuenta && initializedFor.current === mineName) return;

    const store = useProfileStore.getState();
    // El del servidor manda: es el de esta cuenta. Si no hay (cuenta recién
    // creada) se conserva el borrador local, que es justo lo que la persona
    // acaba de montar antes de registrarse.
    let p =
      perfilDeLaCuenta ??
      (mineName ? store.profiles[mineName] : undefined);

    if (!p) {
      p = createBlankProfile(claimParam || 'mi_perfil');
      store.save(p);
      store.setMine(p.username);
    }

    cuentaMontada.current = idCuenta;
    initializedFor.current = p.username;
    storeKeyRef.current = p.username;
    init(p);
  }, [mineName, claimParam, init, perfilDeLaCuenta, cargandoCuenta, idCuenta, authLista]);

  const handleSave = useCallback(async () => {
    if (!profile) return;
    // Sin handle no hay clave bajo la que guardar: se deja sucio y se reintenta.
    if (!profile.username) return;

    setSaving(true);
    try {
      saveProfileToStore(profile, storeKeyRef.current);
      // Los refs se actualizan antes de que el efecto de init vuelva a correr,
      // para que un renombrado no se confunda con un cambio de perfil.
      storeKeyRef.current = profile.username;
      initializedFor.current = profile.username;
      markClean();

      if (hasBackend()) {
        const saved = await backend.guardarPerfil(profile);
        // Devolver la marca del servidor mantiene viva la concurrencia optimista
        // y limpia `_sucio`, que si no bloqueaba para siempre receiveFromServer().
        const marks: Partial<Profile> = {};
        if (saved?._id) marks._id = saved._id;
        if (saved?._actualizado) marks._actualizado = saved._actualizado;
        markSynced(profile.username, marks);
        syncMeta(marks);
      }
    } catch (err: any) {
      // `_sucio` sigue en true: se reintenta al siguiente cambio y el servidor
      // no pisa lo que hay en local.
      console.error('Error al guardar en backend:', err);
      toast(err?.message || 'No se pudo guardar en la nube', true);
    } finally {
      setSaving(false);
    }
  }, [profile, saveProfileToStore, markSynced, markClean, syncMeta, toast]);

  /**
   * Guarda unos cambios concretos y espera a que esten arriba.
   *
   * `handleSave` lee `profile` de su cierre, asi que llamarlo justo despues
   * de `update()` guardaria la version de ANTES del cambio: el callback que
   * se tiene en la mano es el viejo hasta el siguiente render. Aqui se
   * aplica el cambio y se relee el perfil del almacen —zustand escribe de
   * forma sincrona—, con lo que se guarda exactamente lo que se acaba de
   * tocar. Y lanza en vez de avisar con un toast, para que quien llama pueda
   * enseñar el error dentro de su propio formulario.
   */
  const guardarAhora = useCallback(
    async (cambios: Partial<Profile>) => {
      update(cambios);
      const p = useEditorStore.getState().profile;
      if (!p?.username) throw new Error('Ponle un nombre de usuario antes de guardar.');

      setSaving(true);
      try {
        saveProfileToStore(p, storeKeyRef.current);
        storeKeyRef.current = p.username;
        initializedFor.current = p.username;
        markClean();

        if (hasBackend()) {
          const guardado = await backend.guardarPerfil(p);
          const marcas: Partial<Profile> = {};
          if (guardado?._id) marcas._id = guardado._id;
          if (guardado?._actualizado) marcas._actualizado = guardado._actualizado;
          markSynced(p.username, marcas);
          syncMeta(marcas);
        }
      } finally {
        setSaving(false);
      }
    },
    [update, saveProfileToStore, markSynced, markClean, syncMeta],
  );

  /**
   * Guarda AHORA y abre el perfil.
   *
   * El guardado automático espera segundo y medio, así que pulsar «ver» sin
   * esto podía abrir la pestaña con el cambio recién hecho todavía sin subir.
   * Se espera al guardado antes de abrir, y solo entonces.
   */
  const publicarYVer = useCallback(async () => {
    if (!profile?.username) {
      toast('Ponle un nombre de usuario antes de publicar', true);
      return;
    }
    setPublicando(true);
    try {
      if (dirty) await handleSave();
      // La pestaña nueva sin acceso a la que la abrió: es lo correcto aunque
      // el destino sea nuestro, y evita el aviso de los analizadores.
      window.open(`/u/${profile.username}`, '_blank', 'noopener,noreferrer');
    } finally {
      setPublicando(false);
    }
  }, [profile?.username, dirty, handleSave, toast]);

  // Autosave when dirty after 1.5s debounce
  useEffect(() => {
    if (!dirty || !profile) return;
    const timer = setTimeout(() => {
      handleSave();
    }, 1500);
    return () => clearTimeout(timer);
  }, [dirty, profile, handleSave]);

  // Social net toggle handler
  const handleToggleNet = (netId: string) => {
    if (!profile) return;
    const exists = profile.socials?.some((s) => s.net === netId);
    if (exists) {
      update({ socials: profile.socials.filter((s) => s.net !== netId) });
    } else {
      const net = NETS[netId];
      update({
        socials: [
          ...(profile.socials || []),
          { net: netId, url: net?.prefix || '', label: net?.label || netId },
        ],
      });
    }
  };

  /**
   * El id de Discord se pone solo.
   *
   * Quien entra con Discord ya nos ha dado su id en el login: pedirselo
   * escrito es pedir un dato que la pagina tiene delante, y ademas es el
   * dato mas facil de copiar mal.
   *
   * Se rellena SOLO si el campo no existe todavia. Si alguien lo borra a
   * proposito pasa a ser cadena vacia —que si existe— y no se vuelve a
   * poner: la decision de quitarlo es suya, no nuestra.
   */
  const idDiscordSesion = useIdDiscordDeLaSesion();
  useEffect(() => {
    if (!profile || !idDiscordSesion) return;
    if (profile.discordId !== undefined) return;
    updateField('discordId', idDiscordSesion);
  }, [profile, idDiscordSesion, updateField]);

  /** Escribe una fila de enlaces sin pisar las demás. */
  const escribirEnlace = useCallback(
    (idx: number, parche: Partial<SocialLink>) => {
      if (!profile?.socials) return;
      const lista = [...profile.socials];
      const fila = lista[idx];
      if (!fila) return;
      lista[idx] = { ...fila, ...parche };
      update({ socials: lista });
    },
    [profile?.socials, update],
  );

  const formatoActual: 'normal' | 'split' | 'minimal' =
    profile?.avPos === 'side'
      ? 'split'
      : profile?.surface === 'none'
        ? 'minimal'
        : 'normal';

  const vimeoActivo = profile?.bgType === 'video' && esVimeo(profile.bgValue);
  /** El zoom del fondo solo tiene sentido si hay algo que encuadrar. */
  const esMedia = profile?.bgType === 'image' || profile?.bgType === 'video';
  const modoLibre = (profile?.layoutMode || 'stack') === 'free';

  // La proporción se guarda en el perfil para que la vista pública no tenga
  // que preguntarle nada a Vimeo: sin esto, cada visita a un perfil con vídeo
  // haría una petición a un tercero antes de poder pintar el fondo.
  const urlVimeo = vimeoActivo ? profile.bgValue : '';
  const { info: fichaVimeo, estado: estadoVimeo } = useVimeo(urlVimeo, (d) => {
    if (d.ratio !== profile?.bgRatio) updateField('bgRatio', d.ratio);
  });

  /** El tamaño del avatar se guarda en px (40–240). El control va en %. */
  const avatarPct = Math.round((profile?.avSize ?? 112) / 2.4);

  const nombreSuperficie = useMemo(
    () => SURFACES.find((s) => s.id === profile?.surface)?.name ?? 'la superficie',
    [profile?.surface],
  );

  const filteredNets = useMemo(() => {
    return Object.entries(NETS).filter(([_, n]) => {
      if (activeNetGroup === 'all') return true;
      return n.group === activeNetGroup;
    });
  }, [activeNetGroup]);

  if (!profile) {
    return <div className="cargando" aria-busy="true" />;
  }

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <aside className="dashboard__sidebar">
        <div>
          <div className="dash__quien">
            <div className="dash__quien-t">Editor de Perfil</div>
            <div className="dash__quien-u">@{profile.username}</div>
          </div>

          <nav className="dash__nav">
            {SECTIONS.map((sec) => (
              <button
                key={sec.id}
                type="button"
                className={`btn btn--sm ${section === sec.id ? 'btn--primary' : 'btn--quiet'}`}
                style={{ justifyContent: 'flex-start', textAlign: 'left', gap: '10px' }}
                onClick={() => {
                  setSection(sec.id);
                  setBloqueAbierto(null);
                }}
              >
                <span
                  className="dash__ico"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: sec.icon }}
                />
                <span>{sec.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Undo/Redo and Save Status Footer */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              disabled={!canUndo()}
              onClick={undo}
              title="Deshacer"
            >
              ↩
            </button>
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              disabled={!canRedo()}
              onClick={redo}
              title="Rehacer"
            >
              ↪
            </button>
          </div>

          <span className="t-meta" style={{ fontSize: 'var(--t2)' }}>
            {saving ? 'Guardando...' : dirty ? '● Cambios sin guardar' : '✓ Guardado'}
          </span>
        </div>
      </aside>

      {/* Main Form Section */}
      <main
        className="dashboard__editor"
      >
        {/* Una frontera por columna, y no una para las dos: si revienta un
            control del editor no tiene por que llevarse la vista previa por
            delante, ni al reves. `reintentarCon` la seccion hace que el
            fallo se cure solo al cambiar de seccion. */}
        <Frontera donde="el editor" reintentarCon={section}>
        {/* Las secciones entraban directas en los controles: el primer
            elemento de «Diseño» era un rotulo que ponia «Fondo», y desde
            ahi no se sabia ni en que seccion estabas ni para que servia.
            Los tres sub-paneles —cuenta, insignias y editor de bloque— si
            llevaban encabezado, asi que ademas era incoherente. Se usa su
            mismo patron; las que ya lo traen se quedan fuera de esta
            lista para no ponerselo dos veces. */}
        {(() => {
          const s = SECTIONS.find((x) => x.id === section);
          return s?.desc ? (
            <header className="dash__enc">
              <h2 className="dash__h2">{s.name}</h2>
              <p className="dash__sub">{s.desc}</p>
            </header>
          ) : null;
        })()}
        {/* SECTION: Overview / Identidad */}
        {section === 'overview' && (
          <div className="dash__seccion">
            {/* Los dos en fila: cada caja ocupaba el ancho entero y había
                que hacer scroll para ver el segundo. */}
            <div className="f-row">
              <SubirMedio
                guia="avatar"
                titulo="Avatar"
                destino="avatar"
                lado={512}
                maxAnimadoMB={2}
                value={profile.avatarUrl || ''}
                onChange={(r) => updateField('avatarUrl', r.url)}
              />

              <SubirFondo
                guia="fondo"
                titulo="Fondo"
                previa={
                  vimeoActivo
                    ? fichaVimeo?.miniatura
                    : profile.bgType === 'image'
                      ? profile.bgValue
                      : ''
                }
                onSubido={(r) =>
                  update(
                    r.tipo === 'video'
                      ? { bgType: 'video', bgValue: r.url, bgRatio: r.ratio }
                      : { bgType: 'image', bgValue: r.url },
                  )
                }
                anterior={profile.bgValue || ''}
                onQuitar={() => {
                  /* El archivo se va del cubo, no solo del perfil. Antes
                     esto dejaba el fichero arriba para siempre, y como
                     hay un tope de ocho por cuenta, quien probaba varios
                     formatos acababa bloqueado con un aviso que decia
                     «Borra alguno antes de subir otro» sin que existiera
                     ninguna forma de borrar ninguno.

                     Si el fondo es de Vimeo esto no hace nada: el video
                     vive en la cuenta de Vimeo de su dueño y borrarlo de
                     ahi es otra decision, no la de quitarlo del perfil. */
                  void backend.borrarMedioPorUrl(profile.bgValue || '');
                  update({ bgType: 'none', bgValue: '' });
                }}
              />
            </div>

            {esMedia && (
              <Deslizador
                label="Tamaño del fondo"
                desc="Acerca la imagen o el vídeo y recorta por los bordes"
                sufijo="%"
                min={100}
                max={300}
                step={5}
                value={profile.bgScale ?? 100}
                onChange={(v) => updateField('bgScale', v)}
              />
            )}

            <Campo
              label="…o pegar un enlace de Vimeo"
              valor={vimeoActivo ? `ID ${idVimeo(profile.bgValue)}` : undefined}
            >
              <input
                type="url"
                className="inp"
                placeholder="https://vimeo.com/123456789"
                value={profile.bgType === 'video' ? profile.bgValue || '' : ''}
                onChange={(e) => {
                  const url = e.target.value.trim();
                  update(
                    url
                      ? { bgType: 'video', bgValue: url }
                      : { bgType: 'gradient', bgValue: '' },
                  );
                }}
              />
              {profile.bgType === 'video' && profile.bgValue && !vimeoActivo && (
                <p className="drop__err" role="alert">
                  No reconozco ese enlace de Vimeo.
                </p>
              )}
              {vimeoActivo && estadoVimeo === 'error' && (
                <p className="drop__err" role="alert">
                  Vimeo no da la ficha de ese vídeo. Si es privado, copia el
                  enlace completo con su código; si no, comprueba que se puede
                  incrustar.
                </p>
              )}
              {vimeoActivo && (
                <p className="vimeo__ficha">
                  {estadoVimeo === 'cargando' && 'Leyendo el vídeo…'}
                  {estadoVimeo === 'listo' && fichaVimeo && (
                    <>
                      {fichaVimeo.titulo || 'Sin título'} ·{' '}
                      <b>{proporcionVimeo(fichaVimeo.ratio)}</b>
                      {Math.abs(fichaVimeo.ratio - 16 / 9) > 0.05 && (
                        <>
                          {' '}
                          — no es 16:9, así que el fondo se recorta por los
                          lados para cubrir la pantalla.
                        </>
                      )}
                    </>
                  )}
                </p>
              )}
            </Campo>

            <section className="grupo">
              <h3 className="grupo__t">Fondo</h3>
              {esMedia && (
                <>
                  <Deslizador
                    label="Opacidad del fondo"
                    sufijo="%"
                    min={0}
                    max={100}
                    value={profile.bgOpacity ?? 100}
                    onChange={(v) => updateField('bgOpacity', v)}
                  />
                  <Deslizador
                    label="Desenfoque del fondo"
                    sufijo="px"
                    min={0}
                    max={40}
                    value={profile.bgBlur ?? 0}
                    onChange={(v) => updateField('bgBlur', v)}
                  />
                </>
              )}

              <Deslizador
                label="Viñeta"
                desc="Oscurece los bordes para que la tarjeta destaque"
                sufijo="%"
                min={0}
                max={100}
                value={profile.vignette ?? 0}
                onChange={(v) => updateField('vignette', v)}
              />
              <Campo label="Partículas">
                <Tarjetas
                  opciones={PARTICLES}
                  dibujos={DIBUJOS.PARTICLES}
                  value={profile.particles || 'none'}
                  onChange={(v) => updateField('particles', v)}
                />
              </Campo>
            </section>

            <div className="f-row">
              <Campo label="Nombre visible">
                <input
                  type="text"
                  className="inp"
                  placeholder="Tu nombre"
                  value={profile.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </Campo>

              <Campo label="Nombre de usuario" guia="usuario">
                <div className="f-pre">
                  <span>@</span>
                  <input
                    type="text"
                    className="inp"
                    placeholder="usuario"
                    value={profile.username}
                    onChange={(e) =>
                      updateField(
                        'username',
                        e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                      )
                    }
                  />
                </div>
              </Campo>
            </div>

            <Campo label="Oficio">
              <input
                type="text"
                className="inp"
                placeholder="Ej: Diseñador gráfico"
                value={profile.title || ''}
                onChange={(e) => updateField('title', e.target.value)}
              />
            </Campo>

            <Campo label="Ubicación">
              <input
                type="text"
                className="inp"
                placeholder="Ej: Ciudad de México"
                value={profile.location || ''}
                onChange={(e) => updateField('location', e.target.value)}
              />
            </Campo>

            <Campo label="Biografía" valor={`${(profile.bio || '').length}/1200`}>
              <textarea
                className="ta"
                rows={3}
                placeholder="Cuéntanos sobre ti…"
                value={profile.bio || ''}
                onChange={(e) => updateField('bio', e.target.value)}
              />
            </Campo>
          </div>
        )}

        {/* SECTION: Design / Diseño */}
        {section === 'design' && (
          <div className="dash__seccion">
            <h2 className="dash__h2">Diseño · Controles</h2>

            <Campo label="Tipo de superficie">
              <Tarjetas
                opciones={SURFACES}
                  dibujos={DIBUJOS.SURFACES}
                value={profile.surface || 'none'}
                onChange={(v) => updateField('surface', v)}
              />
            </Campo>

            {/* Los ajustes finos sólo tienen sentido si hay caja que ajustar. */}
            {profile.surface && profile.surface !== 'none' && (
              <Subpanel titulo={`Configuración de ${nombreSuperficie}`}>
                <ColorRGB
                  label="Color RGB"
                  value={profile.sColor || ''}
                  porDefecto={COLOR_SUPERFICIE[profile.surface] ?? '#FFFFFF'}
                  onChange={(hex) => updateField('sColor', hex)}
                />

                <Deslizador
                  label="Opacidad"
                  sufijo="%"
                  min={0}
                  max={100}
                  value={profile.sOpacity ?? OPACIDAD_SUPERFICIE[profile.surface] ?? 60}
                  onChange={(v) => updateField('sOpacity', v)}
                />

                <Interruptor
                  label="Agregar borde"
                  on={profile.sBorderOn !== false}
                  onChange={(v) => updateField('sBorderOn', v)}
                />

                {profile.sBorderOn !== false && (
                  <>
                    <ColorRGB
                      label="Borde"
                      value={profile.sBorderColor || ''}
                      porDefecto="#FFFFFF"
                      onChange={(hex) => updateField('sBorderColor', hex)}
                    />
                    <Deslizador
                      label="Grosor"
                      sufijo="px"
                      min={0}
                      max={12}
                      value={profile.sBorderW ?? 1}
                      onChange={(v) => updateField('sBorderW', v)}
                    />
                  </>
                )}

                {profile.surface === 'glass' && (
                  <Deslizador
                    label="Desenfoque"
                    sufijo="px"
                    min={0}
                    max={60}
                    value={profile.sBlur ?? 22}
                    onChange={(v) => updateField('sBlur', v)}
                  />
                )}

                {profile.surface === 'glow' && (
                  <Deslizador
                    label="Intensidad del halo"
                    min={0}
                    max={100}
                    value={profile.sGlow ?? 40}
                    onChange={(v) => updateField('sGlow', v)}
                  />
                )}
              </Subpanel>
            )}

            <Deslizador
              label="Ancho de la superficie"
              sufijo="%"
              min={10}
              max={100}
              value={profile.sWidthPct ?? 50}
              onChange={(v) => updateField('sWidthPct', v)}
            />

            <Deslizador
              label="Alto de la superficie"
              desc={
                modoLibre
                  ? '0 = el alto que se tomó del diseño al entrar en la rejilla'
                  : '0 = el alto que pida el contenido'
              }
              sufijo="px"
              min={0}
              max={1400}
              step={10}
              value={profile.sHeightPx ?? 0}
              onChange={(v) => updateField('sHeightPx', v || null)}
            />

            <Deslizador
              label="Radio de las esquinas"
              sufijo="px"
              min={0}
              max={40}
              value={profile.radius ?? 18}
              onChange={(v) => updateField('radius', v)}
            />

            {/* Estaba en «Perfil», entre la foto y el nombre, y ahi
                desentonaba: esa seccion es lo que ERES —tu foto, tu fondo,
                tu nombre— y esto es como se ve. Ademas era el unico sitio
                del editor donde se podia tocar, asi que en vez de quitarlo
                se trae aqui, con los demas mandos de aspecto. */}
            <Deslizador
              label="Tamaño del avatar"
              sufijo="%"
              min={20}
              max={100}
              value={avatarPct}
              onChange={(pct) => updateField('avSize', Math.round(pct * 2.4))}
            />

            <Campo label="Formato" guia="formato">
              <Tarjetas
                opciones={FORMATOS}
                value={formatoActual}
                onChange={(v) => {
                  const f = FORMATOS.find((x) => x.id === v);
                  if (!f) return;
                  // "Minimal" fija la superficie; los otros dos no la tocan,
                  // para no borrar la caja que se acabe de configurar.
                  update(f.ajustes as Partial<Profile>);
                }}
              />
            </Campo>

            <Campo
              guia="libre"
              label="Colocación de los bloques"
              valor={profile.layoutMode === 'free' ? 'arrastrando' : 'en columna'}
            >
              <Tarjetas
                opciones={LAYOUT_MODES}
                  dibujos={DIBUJOS.LAYOUT_MODES}
                value={profile.layoutMode || 'stack'}
                onChange={(v) => {
                  // Al entrar en el lienzo se siembran las coordenadas
                  // midiendo el diseño que hay AHORA. Sin esto, todas las
                  // piezas caerían en 0,0 amontonadas: en el lienzo cada una
                  // se coloca sola, no fluye detrás de la anterior.
                  if (v === 'free') {
                    const { pos, canvasH } = sembrarLienzo(profile);
                    update({ layoutMode: v, pos, canvasH });
                  } else {
                    updateField('layoutMode', v);
                  }
                }}
              />
            </Campo>
            {profile.layoutMode === 'free' && (
              <p className="dash__pista">
                Arrastra los bloques en la vista previa para moverlos, tira del
                borde derecho para cambiar su ancho, y púlsalos para abrir sus
                ajustes.
              </p>
            )}

            <section className="grupo" data-guia="movimiento">
              <h3 className="grupo__t">Movimiento</h3>
              {/* El mismo panel que tiene cada pieza, aplicado a la
                  superficie entera. Un solo componente para los dos. */}
              <PanelAnimacion
                destino=".pf-stack"
                catalogo={ENTER_FX}
                queEs="la superficie"
                estilo={{
                  anim: profile.enterFx,
                  animDir: profile.enterDir,
                  animMs: profile.enterMs,
                  animDelay: profile.enterDelay,
                  animI: profile.enterI,
                  animE: profile.enterE,
                }}
                set={(k, v) => {
                  const mapa: Record<string, string> = {
                    anim: 'enterFx',
                    animDir: 'enterDir',
                    animMs: 'enterMs',
                    animDelay: 'enterDelay',
                    animI: 'enterI',
                    animE: 'enterE',
                  };
                  updateField(mapa[k] as keyof Profile, v as never);
                }}
              />
              <Campo label="Cursor" guia="cursor">
                <Tarjetas
                  opciones={CURSORS}
                  dibujos={DIBUJOS.CURSORS}
                  value={profile.cursor || 'default'}
                  onChange={(v) => updateField('cursor', v)}
                />
              </Campo>

              {/* Con imagen propia manda la imagen, sea cual sea el tipo. */}
              <SubirMedio
                titulo="Imagen del cursor"
                destino="cursor"
                lado={128}
                maxAnimadoMB={1}
                value={profile.cursorImg || ''}
                onChange={(r) => updateField('cursorImg', r.url)}
              />

              {profile.cursorImg && (
                <Deslizador
                  label="Tamaño del cursor"
                  sufijo="px"
                  min={12}
                  max={96}
                  step={2}
                  value={profile.cursorSize ?? 32}
                  onChange={(v) => updateField('cursorSize', v)}
                />
              )}

              <Deslizador
                label="Estela"
                desc="Cuántas motas deja al pasar. 0 = ninguna."
                min={0}
                max={12}
                value={
                  profile.cursorTrail ??
                  (profile.cursor === 'dot' || profile.cursor === 'blade' ? 5 : 0)
                }
                onChange={(v) => updateField('cursorTrail', v)}
              />

              {(profile.cursorTrail ?? 0) > 0 && (
                <Campo label="Tipo de estela">
                  <Tarjetas
                    opciones={TRAIL_FX}
                  dibujos={DIBUJOS.TRAIL_FX}
                    value={profile.cursorTrailFx || 'chispas'}
                    onChange={(v) => updateField('cursorTrailFx', v)}
                  />
                </Campo>
              )}
              <Interruptor
                label="Inclinación 3D"
                desc="La tarjeta sigue al ratón"
                on={!!profile.tilt}
                onChange={(v) => updateField('tilt', v)}
              />
              <div data-guia="portada">
                <Interruptor
                  label="Pantalla de entrada"
                  desc="Pantalla negra hasta que el visitante hace clic; entonces entra todo el perfil"
                  on={!!profile.gate}
                  onChange={(v) => updateField('gate', v)}
                />
              </div>
              {profile.gate && (
                <Campo label="Texto de la pantalla">
                  <input
                    type="text"
                    className="inp"
                    maxLength={40}
                    placeholder="Toca para entrar"
                    value={profile.gateText || ''}
                    onChange={(e) => updateField('gateText', e.target.value)}
                  />
                </Campo>
              )}
            </section>
          </div>
        )}

        {/* SECTION: Blocks / Bloques */}
        {section === 'blocks' && (
          bloqueAbierto ? (
            <EditorBloque
              def={bloqueAbierto}
              profile={profile}
              update={update}
              onVolver={() => setBloqueAbierto(null)}
            />
          ) : (
            <div className="dash__seccion">
              <h2 className="dash__h2">Bloques</h2>
              <p className="dash__sub">
                Cada pieza del perfil se edita por separado. Las opciones cambian
                según el bloque.
              </p>

              <ul className="blist" data-guia="bloques">
                {BLOQUES.map((b) => {
                  const oculto = (profile.blocksOff ?? []).includes(b.id);
                  return (
                    <li key={b.id}>
                      <button
                        type="button"
                        className={`blist__it${oculto ? ' is-off' : ''}`}
                        onClick={() => setBloqueAbierto(b)}
                      >
                        <span
                          className="blist__ico"
                          aria-hidden="true"
                          dangerouslySetInnerHTML={{ __html: b.icono }}
                        />
                        <span className="blist__txt">
                          <span className="blist__n">{b.nombre}</span>
                          <span className="blist__d">{b.descripcion}</span>
                        </span>
                        {/* Un ojo tachado, no la palabra «oculto»: se
                            entiende sin leer y no ocupa una esquina. */}
                        <span className="blist__ojo" title={oculto ? 'Oculto' : 'Visible'}>
                          {oculto ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 3l18 18" />
                              <path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17.6 17.6 0 0 1-3.2 3.9" />
                              <path d="M6.6 6.7A17.3 17.3 0 0 0 2 12s3.6 6 10 6a9.7 9.7 0 0 0 4-.8" />
                              <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        )}

        {/* SECTION: Links & Socials */}
        {section === 'links' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <h2 style={{ fontSize: 'var(--t5)' }}>Redes y enlaces</h2>
              <p className="t-meta" style={{ fontSize: 'var(--t3)', marginTop: '4px' }}>
                Toca un logo para añadirlo o quitarlo.
              </p>
            </div>

            <div className="tabs">
              {NET_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`pill${activeNetGroup === g.id ? ' is-active' : ''}`}
                  onClick={() => setActiveNetGroup(g.id)}
                >
                  {g.name}
                </button>
              ))}
            </div>

            <div className="netgrid" data-guia="redes">
              {filteredNets.map(([netId, n]) => {
                const puesta = profile.socials?.some((sc) => sc.net === netId);
                // El comodín no es una marca: se explica y ocupa la fila.
                if (n.custom) {
                  // A diferencia de una red, esto NO es un interruptor: cada
                  // pulsación añade otro enlace. Alternar solo dejaba tener
                  // uno, y lo normal es querer varios (tienda, portfolio,
                  // servidor...) cada uno con su nombre.
                  const cuantos = (profile.socials ?? []).filter(
                    (sc) => sc.net === 'custom',
                  ).length;
                  return (
                    <button
                      key={netId}
                      type="button"
                      data-guia="enlace-propio"
                      className="netchip netchip--ancho"
                      style={{ '--brand': n.color } as React.CSSProperties}
                      onClick={() =>
                        update({
                          socials: [
                            ...(profile.socials || []),
                            { net: 'custom', url: '', label: '', icon: '' },
                          ],
                        })
                      }
                    >
                      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: n.icon }} />
                      <span>
                        <span className="netchip__t">
                          Añadir enlace propio{cuantos > 0 ? ` · ${cuantos}` : ''}
                        </span>
                        <span className="netchip__d">
                          Tu dirección, con el nombre y el icono que elijas.
                        </span>
                      </span>
                    </button>
                  );
                }
                return (
                  <button
                    key={netId}
                    type="button"
                    className={`netchip${puesta ? ' is-on' : ''}`}
                    style={{ '--brand': n.color } as React.CSSProperties}
                    title={n.label}
                    aria-label={n.label}
                    aria-pressed={puesta}
                    onClick={() => handleToggleNet(netId)}
                    dangerouslySetInnerHTML={{ __html: n.icon }}
                  />
                );
              })}
            </div>

            {profile.socials && profile.socials.length > 0 && (
              <div>
                <h3 className="grupo__t">Tus enlaces &middot; {profile.socials.length}</h3>
                <div className="enlaces">
                  {profile.socials.map((sc, idx) => {
                    const n = NETS[sc.net];
                    return (
                      <div
                        key={`${sc.net}-${idx}`}
                        className="enlace"
                        style={{ '--brand': n?.color ?? 'var(--accent)' } as React.CSSProperties}
                      >
                        {sc.net === 'custom' ? (
                          <button
                            type="button"
                            className="enlace__ico enlace__ico--elegir"
                            aria-label="Elegir icono"
                            title="Elegir icono"
                            onClick={() => setIconoAbierto(iconoAbierto === idx ? null : idx)}
                            {...(sc.icon && !NETS[sc.icon]
                              ? {
                                  children: esImagen(sc.icon) ? (
                                    <img src={safeMedia(sc.icon)} alt="" />
                                  ) : (
                                    sc.icon
                                  ),
                                }
                              : {
                                  dangerouslySetInnerHTML: {
                                    __html: (NETS[sc.icon ?? ''] ?? n)?.icon ?? '',
                                  },
                                })}
                          />
                        ) : (
                          <span
                            className="enlace__ico"
                            aria-hidden="true"
                            dangerouslySetInnerHTML={{ __html: n?.icon ?? '' }}
                          />
                        )}
                        <label className="enlace__cuerpo">
                          {sc.net === 'custom' ? (
                            <input
                              type="text"
                              className="enlace__nom"
                              maxLength={24}
                              placeholder="Nombre del enlace"
                              aria-label="Nombre del enlace"
                              value={sc.label}
                              onChange={(e) => escribirEnlace(idx, { label: e.target.value })}
                            />
                          ) : (
                            <span className="enlace__n">{sc.label || n?.label || sc.net}</span>
                          )}
                          <input
                            type="url"
                            className="enlace__u"
                            value={sc.url}
                            placeholder={n?.ph || 'https://…'}
                            onChange={(e) => escribirEnlace(idx, { url: e.target.value })}
                          />
                        </label>
                        <button
                          type="button"
                          className="enlace__x"
                          aria-label={`Quitar ${n?.label || sc.net}`}
                          onClick={() => {
                            update({ socials: profile.socials.filter((_, i) => i !== idx) });
                            setIconoAbierto(null);
                          }}
                        >
                          &times;
                        </button>

                        {/* El selector de icono, desplegado bajo su fila.
                            Los glifos se toman del mismo catálogo de redes:
                            son los que ya tenemos dibujados y con su color de
                            marca, así que un enlace propio puede parecerse a
                            lo que enlaza. */}
                        {sc.net === 'custom' && iconoAbierto === idx && (
                          <div className="enlace__iconos">
                            {/* Lo primero, tu propia imagen: si alguien
                                abre esto es porque quiere SU icono, no uno
                                de una lista. */}
                            <SubirMedio
                              titulo="Tu icono"
                              destino={`enlace-${idx}`}
                              lado={128}
                              maxAnimadoMB={1}
                              value={
                                sc.icon && sc.icon.startsWith('data:') ||
                                sc.icon?.startsWith('http')
                                  ? sc.icon
                                  : ''
                              }
                              onChange={(r) => escribirEnlace(idx, { icon: r.url })}
                            />
                            <button
                              type="button"
                              className={`netchip${!sc.icon ? ' is-on' : ''}`}
                              title="El genérico"
                              aria-label="Icono genérico"
                              style={{ '--brand': NETS.custom?.color } as React.CSSProperties}
                              onClick={() => escribirEnlace(idx, { icon: '' })}
                              dangerouslySetInnerHTML={{ __html: NETS.custom?.icon ?? '' }}
                            />
                            {NET_ORDER.filter((k) => k !== 'custom').map((k) => (
                              <button
                                key={k}
                                type="button"
                                className={`netchip${sc.icon === k ? ' is-on' : ''}`}
                                title={NETS[k]?.label}
                                aria-label={NETS[k]?.label}
                                style={{ '--brand': NETS[k]?.color } as React.CSSProperties}
                                onClick={() => escribirEnlace(idx, { icon: k })}
                                dangerouslySetInnerHTML={{ __html: NETS[k]?.icon ?? '' }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION: Badges */}
        {section === 'badges' && <PanelInsignias profile={profile} />}

        {/* SECTION: Settings */}
        {section === 'settings' && (
          <AjustesCuenta
            profile={profile}
            update={update}
            guardarAhora={guardarAhora}
            guiaApagada={guia.apagada}
            aprendidas={guia.aprendidas}
            totalPistas={guia.total}
            reiniciarGuia={guia.reiniciar}
          />
        )}
        </Frontera>
      </main>

      {/* Live Preview Column */}
      <aside
        className="dashboard__preview"
      >
        {/* Viewport bar */}
        <div className="prevbar">
          <span className="prevbar__t">Vista previa en vivo</span>

          <button
            type="button"
            className="btn btn--sm btn--primary prevbar__pub"
            onClick={publicarYVer}
            disabled={publicando || saving || !profile.username}
            title={
              hasBackend()
                ? 'Guarda los cambios y abre tu perfil'
                : 'Sin cuenta el perfil solo vive en este navegador'
            }
          >
            {publicando ? 'Publicando…' : 'Publicar y ver ↗'}
          </button>

          <div className="prevbar__vp">
            <button
              type="button"
              className={`btn btn--sm ${viewport === 'desktop' ? 'btn--primary' : 'btn--quiet'}`}
              onClick={() => setViewport('desktop')}
            >
              🖥 Desktop
            </button>
            <button
              type="button"
              className={`btn btn--sm ${viewport === 'tablet' ? 'btn--primary' : 'btn--quiet'}`}
              onClick={() => setViewport('tablet')}
            >
              📱 Tablet
            </button>
            <button
              type="button"
              className={`btn btn--sm ${viewport === 'mobile' ? 'btn--primary' : 'btn--quiet'}`}
              onClick={() => setViewport('mobile')}
            >
              📱 Móvil
            </button>
          </div>
        </div>

        {/* Scrollable Canvas for Preview */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            justifyContent: 'center',
            padding: viewport === 'desktop' ? '0' : '24px',
          }}
        >
          <div
            style={{
              width: viewport === 'mobile' ? '375px' : viewport === 'tablet' ? '768px' : '100%',
              borderRadius: viewport === 'desktop' ? '0' : '20px',
              overflow: 'hidden',
              // La previa debe llenar la columna: sin un alto definido aquí,
              // el 100% de dentro no tiene contra qué resolverse y el fondo
              // se corta en una franja.
              minHeight: '100%',
              boxShadow: viewport === 'desktop' ? 'none' : '0 10px 40px rgba(0,0,0,0.8)',
              transition: 'width 0.3s ease',
            }}
          >
            <Frontera donde="la vista previa" reintentarCon={profile.username}>
            {profile.layoutMode === 'free' ? (
              <LienzoBloques
                profile={profile}
                update={update}
                vista={viewport}
                seleccionado={bloqueAbierto?.id ?? null}
                onAbrirBloque={(id) => {
                  const def = BLOQUE_POR_ID[id];
                  if (!def) return;
                  setSection('blocks');
                  setBloqueAbierto(def);
                }}
              >
                <ProfileView profile={profile} preview={true} />
              </LienzoBloques>
            ) : (
              <ProfileView profile={profile} preview={true} />
            )}
            </Frontera>
          </div>
        </div>
      </aside>

      <Guia
        candidatas={guia.candidatas}
        aprendidas={guia.aprendidas}
        total={guia.total}
        onDescartar={guia.descartar}
        onApagar={guia.apagar}
      />
    </div>
  );
}
