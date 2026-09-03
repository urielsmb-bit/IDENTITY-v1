import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProfileView } from '@/components/profile/ProfileView';
import { useProfile } from '@/hooks/useProfile';
import { num } from '@/lib/utils';
import type { Profile } from '@/types';

/**
 * Una posición del carrusel.
 *
 * Pide el perfil COMPLETO. La consulta de Descubrir devuelve un resumen de
 * siete campos —nombre, avatar, oficio, tema, acento, emoji y si está
 * verificado— pensado para tarjetas: pintando eso salía la foto y el nombre
 * sobre un perfil por defecto, sin la composición que su dueño montó.
 *
 * Mientras llega el completo se pinta el resumen: así no hay hueco vacío, y
 * lo que ya se ve no cambia de sitio, solo se completa.
 */
function Slot({ base, activo }: { base: Profile; activo: boolean }) {
  const { profile } = useProfile(base.username);
  const p = (profile as Profile | null) ?? base;
  // Al vecino se le apagan las partículas y la puerta: un lienzo animado al
  // 82 % y en penumbra no aporta, y una puerta taparía lo que asoma.
  const usar = activo ? p : { ...p, particles: 'none', gate: false };
  return <ProfileView profile={usar} preview />;
}

interface CarruselPerfilesProps {
  perfiles: Profile[];
  /** Cada cuánto pasa al siguiente, en ms */
  cada?: number;
}

/**
 * Carrusel de perfiles reales para la portada.
 *
 * Sustituye a la demo fija: enseñar perfiles de gente convence más que
 * enseñar uno de mentira con selectores de color.
 *
 * Solo se montan TRES a la vez —el de en medio y sus dos vecinos— por caro
 * que sea uno solo: `ProfileView` trae partículas, música y efectos. Y a los
 * vecinos se les apagan las partículas antes de pasárselos, porque un lienzo
 * animado que se ve al 82 % y en penumbra no aporta nada y sí cuesta.
 */
export function CarruselPerfiles({ perfiles, cada = 5200 }: CarruselPerfilesProps) {
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const n = perfiles.length;

  // Si la lista encoge (llega la respuesta del servidor, por ejemplo) el
  // índice puede quedarse fuera de rango.
  useEffect(() => {
    if (n > 0 && i >= n) setI(0);
  }, [n, i]);

  useEffect(() => {
    if (pausado || n < 2) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % n), cada);
    return () => window.clearInterval(t);
  }, [pausado, n, cada]);

  /** Los tres visibles, con su desplazamiento respecto al centro. */
  const visibles = useMemo(() => {
    if (n === 0) return [];
    // Con uno o dos perfiles no hay vecinos que enseñar sin repetirlos.
    const offs = n >= 3 ? [-1, 0, 1] : [0];
    return offs.map((off) => {
      const idx = (((i + off) % n) + n) % n;
      return { off, idx, perfil: perfiles[idx]! };
    });
  }, [perfiles, i, n]);

  if (n === 0) return null;
  const actual = perfiles[i]!;

  return (
    <div
      className="carr"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div className="carr__pista">
        {visibles.map(({ off, idx, perfil }) => (
          <div
            key={idx}
            className={`carr__slot${off === 0 ? ' is-activo' : ''}`}
            data-off={off}
            // Los vecinos no reciben ni foco ni lectura: son decorado.
            aria-hidden={off !== 0}
            inert={off !== 0}
          >
            <Slot base={perfil} activo={off === 0} />
          </div>
        ))}

        {/* EL REFLEJO.
            Es el mismo perfil otra vez, del reves y desvanecido. Antes
            aqui habia una repisa pintada con degradados y no colaba: un
            suelo oscuro NO es mas claro que lo que lo rodea, y pintar una
            mancha clara debajo de una tarjeta oscura sobre fondo oscuro
            se lee como un estante iluminado, no como suelo. Lo que se ve
            de verdad en una superficie oscura es lo que tiene encima.

            Por eso esto es el contenido de verdad, no una imitacion: si
            el perfil del centro tiene el nombre en morado, el reflejo lo
            tiene en morado, y cuando cambia de perfil, cambia con el. No
            hay nada que mantener en dos sitios.

            Solo el del centro. Los de los lados estan desenfocados y a
            media luz; un reflejo suyo no se distinguiria del fondo y
            costaria otro perfil entero de pintar. */}
        <div className="carr__reflejo" aria-hidden="true" inert>
          <Slot base={actual} activo={false} />
        </div>

        {/* La ficha del que está en medio, encima del propio perfil. */}
        <Link className="carr__pie" to={`/u/${actual.username}`}>
          <span className="carr__at">@{actual.username}</span>
          <span className="carr__v">{num(actual.views || 0)} visitas</span>
        </Link>
      </div>

      <div className="carr__barra">
        <div className="carr__dots" role="tablist" aria-label="Perfiles destacados">
          {perfiles.map((p, k) => (
            <button
              key={p.username || k}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={`Perfil ${k + 1}: ${p.name || p.username}`}
              className={`carr__dot${k === i ? ' on' : ''}`}
              onClick={() => setI(k)}
            />
          ))}
        </div>
        <button
          type="button"
          className="carr__play"
          aria-label={pausado ? 'Reanudar' : 'Pausar'}
          aria-pressed={pausado}
          onClick={() => setPausado((v) => !v)}
        >
          {pausado ? '▶' : '❚❚'}
        </button>
      </div>
    </div>
  );
}
