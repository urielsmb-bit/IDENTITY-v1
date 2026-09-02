import { useRef, useCallback, useState, useEffect } from 'react';
import * as musicService from '@/lib/music';

/**
 * Hook for the unified music player.
 * Manages YouTube/Spotify/Manual playback state.
 */
export function useMusic() {
  const [playing, setPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<ReturnType<typeof musicService.crearReproductor> | null>(null);

  const init = useCallback((
    container: HTMLElement,
    tracks: musicService.Track[],
  ) => {
    if (playerRef.current) {
      playerRef.current.destroy?.();
    }

    // crearReproductor avisa con nombres en español; pasarle onPlay/onPause
    // dejaba el estado congelado en "pausado" aunque sonara.
    playerRef.current = musicService.crearReproductor(container, tracks, {
      alEstado: (sonando: boolean) => setPlaying(sonando),
      alPista: (i: number) => setCurrentTrack(i),
      alAvanzar: (t: number, d: number) => {
        setTime(t);
        setDuration(d);
      },
    });

    // Devuelve null cuando no hay ninguna pista reproducible.
    if (!playerRef.current) setPlaying(false);
  }, []);

  const play = useCallback(() => playerRef.current?.play(), []);
  const pause = useCallback(() => playerRef.current?.pause(), []);
  const next = useCallback(() => playerRef.current?.siguiente?.(), []);
  const prev = useCallback(() => playerRef.current?.anterior?.(), []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playerRef.current?.destroy?.();
    };
  }, []);

  return {
    init,
    play,
    pause,
    next,
    prev,
    playing,
    currentTrack,
    time,
    duration,
    formatTime: musicService.mmss,
  };
}
