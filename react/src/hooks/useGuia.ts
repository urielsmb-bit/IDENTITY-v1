import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Profile } from '@/types/profile';
import { PISTAS, TOTAL_PISTAS, type Pista } from '@/data/pistas';

const LLAVE = 'identity.guia.v1';

interface EstadoGuia {
  /** Pistas ya aprendidas: hechas o descartadas. No vuelven. */
  vistas: string[];
  apagada: boolean;
}

const VACIO: EstadoGuia = { vistas: [], apagada: false };

function leer(): EstadoGuia {
  try {
    const s = localStorage.getItem(LLAVE);
    if (!s) return VACIO;
    const j = JSON.parse(s);
    return {
      vistas: Array.isArray(j?.vistas) ? j.vistas.filter((x: unknown) => typeof x === 'string') : [],
      apagada: j?.apagada === true,
    };
  } catch {
    // Navegación privada, almacenamiento lleno o JSON roto: la guía no es
    // motivo para que reviente el editor.
    return VACIO;
  }
}

function guardar(e: EstadoGuia): EstadoGuia {
  try {
    localStorage.setItem(LLAVE, JSON.stringify(e));
  } catch {
    /* sin sitio donde guardar; la guía sigue funcionando esta sesión */
  }
  return e;
}

/** Espera antes de asomar una pista al entrar en una sección, en ms. */
const RESPIRO = 900;

/**
 * Decide qué pista toca, si es que toca alguna.
 *
 * La regla que sostiene todo lo demás: **una cada vez**. Enseñar tres a la
 * vez es enseñar una pared, y una pared se cierra sin leerla. Y la que sale
 * es siempre la de la sección en la que estás, porque una pista sobre el
 * cursor no significa nada mientras rellenas tu nombre.
 */
export function useGuia(profile: Profile | null, seccion: string) {
  const [estado, setEstado] = useState<EstadoGuia>(leer);
  const [listo, setListo] = useState(false);

  /* Al cambiar de sección se espera un momento. Si la pista saltara a la vez
     que la sección, se leería como parte de la interfaz —o como un anuncio—
     y no como un consejo sobre lo que se está mirando. */
  useEffect(() => {
    setListo(false);
    const t = setTimeout(() => setListo(true), RESPIRO);
    return () => clearTimeout(t);
  }, [seccion]);

  /* Lo que ya está hecho se da por aprendido en silencio.
     Quien llega con el perfil montado no merece que le expliquen cómo subir
     un avatar que ya tiene puesto. */
  useEffect(() => {
    if (!profile) return;
    const logradas = PISTAS.filter(
      (p) => !estado.vistas.includes(p.id) && p.hecha(profile),
    ).map((p) => p.id);
    if (!logradas.length) return;
    setEstado((e) => guardar({ ...e, vistas: [...e.vistas, ...logradas] }));
  }, [profile, estado.vistas]);

  /* Las que podrían salir ahora, en orden. El componente se queda con la
     primera que tenga su ancla puesta en pantalla. */
  const candidatas = useMemo<Pista[]>(() => {
    if (!profile || estado.apagada || !listo) return [];
    return PISTAS.filter(
      (p) =>
        p.seccion === seccion &&
        !estado.vistas.includes(p.id) &&
        p.cuando(profile) &&
        !p.hecha(profile),
    ).sort((a, b) => a.orden - b.orden);
  }, [profile, seccion, estado.vistas, estado.apagada, listo]);

  const descartar = useCallback((id: string) => {
    setEstado((e) =>
      e.vistas.includes(id) ? e : guardar({ ...e, vistas: [...e.vistas, id] }),
    );
  }, []);

  const apagar = useCallback(() => {
    setEstado((e) => guardar({ ...e, apagada: true }));
  }, []);

  const reiniciar = useCallback(() => {
    setEstado(guardar({ vistas: [], apagada: false }));
  }, []);

  return {
    candidatas,
    descartar,
    apagar,
    reiniciar,
    apagada: estado.apagada,
    aprendidas: estado.vistas.length,
    total: TOTAL_PISTAS,
  };
}
