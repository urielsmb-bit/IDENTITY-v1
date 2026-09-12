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
  /* Como se llama lo que suena. Lo tuyo si lo escribiste; si no, lo que
     diga YouTube, que lo sabe desde que el reproductor esta listo. */
  const [ficha, setFicha] = useState({ titulo: '', autor: '' });
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
      alFicha: (f: { titulo: string; autor: string }) => setFicha(f),
    });

    // Devuelve null cuando no hay ninguna pista reproducible.
    if (!playerRef.current) setPlaying(false);

    /* Y se prepara YA, sin sonar.
    
       `precalentar` existia y no lo llamaba nadie, asi que el reproductor no
       se creaba hasta el primer `play()` — o sea DENTRO del clic. Para un
       audio suelto eso vale; para YouTube no: hay que crear el iframe y
       esperar a que su API diga que esta listo, y para cuando lo dice, el
       permiso que da el clic ya se ha gastado. Resultado: unas veces sonaba
       y otras no, sin patron visible.
    
       Creado de antemano, al clic solo le queda decir «suena». */
    playerRef.current?.precalentar?.();
  }, []);

  const play = useCallback(() => playerRef.current?.play(), []);
  const pause = useCallback(() => playerRef.current?.pause(), []);
  const next = useCallback(() => playerRef.current?.siguiente?.(), []);
  /* Mover la aguja. El motor ya lo sabia hacer y no lo ofrecia nadie:
     la barra de progreso era un dibujo que no se podia tocar. */
  const seek = useCallback((seg: number) => playerRef.current?.buscar?.(seg), []);
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
    seek,
    titulo: ficha.titulo,
    autor: ficha.autor,
    formatTime: musicService.mmss,
  };
}
