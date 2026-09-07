import type { Profile } from '@/types';
import { BLOQUE_POR_ID, type DefBloque } from '@/data/bloques';

/**
 * Cuánto le falta a tu perfil.
 *
 * El CSS de esto llevaba escrito desde hace mucho —`.prog`, `.prog__bar`,
 * `.prog--done`, la rejilla de pendientes— y no lo usaba nadie. Sexto
 * sistema que aparece dibujado y sin conectar.
 *
 * No se solapa con la Guía, aunque lo parezca. La Guía ENSEÑA: una pista
 * cada vez, en la sección donde estás, sobre algo que quizá no sabías que
 * existía. Esto MIDE: de un vistazo, qué le falta a tu perfil para servir
 * a quien lo abra. Una te descubre el cursor personalizado; la otra te dice
 * que no tienes foto.
 *
 * Cinco cosas y no quince. Son las que cambian lo que ve un visitante, y
 * cada una se puede hacer ahora mismo. Meter «llega a 10 visitas» —que es
 * lo que hace la competencia— seria poner en una lista de tareas algo que
 * no depende de ti.
 *
 * Y cada linea SALTA a donde se arregla. Una lista de pendientes que no
 * lleva a ninguna parte es una regañina.
 */

interface Paso {
  id: string;
  texto: string;
  hecho: (p: Profile) => boolean;
  seccion: string;
  /** El bloque que hay que abrir, si el arreglo vive dentro de uno. */
  bloque?: string;
}

const PASOS: Paso[] = [
  {
    id: 'avatar',
    texto: 'Pon tu foto',
    hecho: (p) => !!p.avatarUrl,
    seccion: 'design',
  },
  {
    id: 'bio',
    texto: 'Di quién eres',
    // El oficio vale igual que la biografia: las dos contestan lo mismo.
    hecho: (p) => !!(p.bio?.trim() || p.title?.trim()),
    seccion: 'design',
  },
  {
    id: 'fondo',
    texto: 'Elige un fondo',
    hecho: (p) => (p.bgType || 'none') !== 'none',
    seccion: 'design',
  },
  {
    id: 'redes',
    texto: 'Añade tus redes',
    hecho: (p) => (p.socials?.length ?? 0) > 0,
    seccion: 'links',
  },
  {
    id: 'discord',
    texto: 'Conecta tu Discord',
    hecho: (p) => !!p.discordId,
    seccion: 'design',
    bloque: 'discord',
  },
];

export function Progreso({
  profile,
  irA,
}: {
  profile: Profile;
  irA: (r: { seccion: string; bloque?: DefBloque }) => void;
}) {
  const estado = PASOS.map((p) => ({ ...p, ok: p.hecho(profile) }));
  const hechos = estado.filter((p) => p.ok).length;
  const pct = Math.round((hechos / PASOS.length) * 100);
  const listo = hechos === PASOS.length;

  return (
    <div className={`prog${listo ? ' prog--done' : ''}`}>
      <div className="prog__bar">
        <i style={{ width: `${pct}%` }} />
      </div>

      <div className="prog__head">
        <b>
          {listo
            ? 'Tu perfil está completo.'
            : `Te ${PASOS.length - hechos === 1 ? 'falta una cosa' : `faltan ${PASOS.length - hechos} cosas`}.`}
        </b>
        <span>{pct}%</span>
      </div>

      {/* Terminado no se enseña la lista: cinco líneas tachadas ocupando
          sitio para siempre no le dicen nada a nadie. Queda la barra en
          verde, que es lo que celebra. */}
      {!listo && (
        <div className="prog__items">
          {estado.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`prog__it${p.ok ? ' ok' : ''}`}
              disabled={p.ok}
              onClick={() =>
                irA({
                  seccion: p.seccion,
                  bloque: p.bloque ? BLOQUE_POR_ID[p.bloque] : undefined,
                })
              }
            >
              <span className="prog__mark" aria-hidden="true">{p.ok ? '✓' : ''}</span>
              {p.texto}
              {!p.ok && <span className="prog__go" aria-hidden="true">→</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
