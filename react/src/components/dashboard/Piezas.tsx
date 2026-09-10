import { useMemo, useState, type ReactNode } from 'react';
import type { Profile } from '@/types';
import { BLOQUES, type DefBloque } from '@/data/bloques';
import { NETS } from '@/data/nets';
import { BADGES } from '@/data/badges';
import { CURSORS, SURFACES } from '@/data/themes';
import { DIBUJOS } from './dibujos';
import { EditorBloque } from './EditorBloque';

interface Props {
  profile: Profile;
  update: (partial: Partial<Profile>) => void;
  /** Abrir el overlay de una pieza: un id de bloque, 'fondo' o 'tarjeta'. */
  onAbrir: (id: string) => void;
  /** Las insignias que de verdad tiene, para enseñarlas y no contarlas mal. */
  insignias?: string[];
  /**
   * Si tiene el plan. Lo que hay en la FILA es de todos —encender la pieza,
   * escribir lo que dice—; lo que hay detrás del engranaje es de pago.
   *
   * El engranaje se pulsa igual sin plan: lo que cambia es que lo de dentro
   * sale apagado. Aquí solo se dibuja el candado, para que se sepa antes de
   * pulsar y no después.
   */
  premium?: boolean;
  /** Las dos cajas de subir, ya cableadas. Vienen de fuera porque llevan
   *  detrás el cubo de archivos, y eso no es asunto de una lista. */
  cajaAvatar: ReactNode;
  cajaFondo: ReactNode;
}

const ENGRANAJE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </svg>
);

const CARET = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

const OJO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const OJO_TACHADO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3l18 18" />
    <path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17.6 17.6 0 0 1-3.2 3.9" />
    <path d="M6.6 6.7A17.3 17.3 0 0 0 2 12s3.6 6 10 6a9.7 9.7 0 0 0 4-.8" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

/** Lo que se enseña cuando la pieza no tiene nada dentro todavía. */
function Vacio({ children }: { children: ReactNode }) {
  return <span className="pza__vacio">{children}</span>;
}

/**
 * La vista de cada pieza: SU contenido, no una descripción de él.
 *
 * «Biografía · El párrafo que cuenta quién eres» obliga a abrir la pieza
 * para saber qué pone hoy. Enseñando el texto de verdad —el nombre que hay
 * puesto, los iconos que hay puestos, la foto que hay puesta— la lista se
 * lee de un vistazo y contesta sola las dos preguntas que se hacen aquí:
 * qué tengo y qué me falta.
 */
function vista(id: string, p: Profile, insignias: string[]): ReactNode {
  switch (id) {
    case 'name':
      return p.name ? <span className="pza__nombre">{p.name}</span> : <Vacio>Sin nombre</Vacio>;

    case 'handle':
      return <span className="pza__mono">@{p.username || 'tu_usuario'}</span>;

    case 'meta': {
      const linea = [p.title, p.location].filter(Boolean).join(' · ');
      return linea ? <span>{linea}</span> : <Vacio>Sin oficio ni ciudad</Vacio>;
    }

    case 'bio':
      return p.bio ? <span className="pza__parrafo">{p.bio}</span> : <Vacio>Sin biografía</Vacio>;

    case 'joined': {
      const d = p.joined ? new Date(p.joined) : null;
      const ok = d && !Number.isNaN(d.getTime());
      return (
        <span>
          Desde{' '}
          {ok ? d.toLocaleDateString('es', { month: 'long', year: 'numeric' }) : 'hoy'}
        </span>
      );
    }

    case 'views':
      return <span>{(p.views ?? 0).toLocaleString('es')} visitas</span>;

    case 'socials': {
      const nets = p.socials ?? [];
      if (!nets.length) return <Vacio>Sin redes</Vacio>;
      return (
        <span className="pza__iconos">
          {nets.slice(0, 7).map((s, i) => {
            const glifo = NETS[s.net]?.icon;
            return glifo ? (
              <i key={`${s.net}${i}`} dangerouslySetInnerHTML={{ __html: glifo }} />
            ) : null;
          })}
          {nets.length > 7 && <em>+{nets.length - 7}</em>}
        </span>
      );
    }

    case 'badges': {
      if (!insignias.length) return <Vacio>Todavía ninguna</Vacio>;
      return (
        <span className="pza__iconos">
          {insignias.slice(0, 7).map((b) =>
            BADGES[b] ? <i key={b} dangerouslySetInnerHTML={{ __html: BADGES[b]!.icon }} /> : null,
          )}
          {insignias.length > 7 && <em>+{insignias.length - 7}</em>}
        </span>
      );
    }

    case 'music': {
      const t = p.audio?.title;
      if (!t) return <Vacio>Sin pista</Vacio>;
      return (
        <span>
          {t}
          {p.audio?.artist ? ` · ${p.audio.artist}` : ''}
        </span>
      );
    }

    case 'discord': {
      const n = p.discordName || p.discordUser;
      return n ? <span>{n}</span> : <Vacio>Sin cuenta enlazada</Vacio>;
    }

    default:
      return null;
  }
}

/**
 * Las piezas del perfil, con su contenido a la vista.
 *
 * Una fila por pieza y dos cosas que hacer con ella: el ojo la enciende o la
 * apaga, y el engranaje abre TODOS sus ajustes en un panel encima —la
 * tipografía, los colores, la caja, dónde se coloca—. La plantilla ya le ha
 * dado un sitio y un tamaño a cada una; el engranaje es para cuando ese
 * sitio no te vale.
 *
 * El avatar y el fondo van arriba y no en la lista porque son imágenes: su
 * control es la propia caja donde se sueltan, que enseña lo que hay puesto
 * mejor que cualquier fila.
 */
export function Piezas({
  profile,
  update,
  onAbrir,
  insignias = [],
  premium = false,
  cajaAvatar,
  cajaFondo,
}: Props) {
  const apagados = useMemo(() => new Set(profile.blocksOff ?? []), [profile.blocksOff]);
  /** La pieza cuyo contenido está desplegado. Una sola: dos formularios
   *  abiertos a la vez convierten la lista en una pared. */
  const [abierta, setAbierta] = useState<string | null>(null);

  function alternar(id: string) {
    const off = new Set(apagados);
    if (off.has(id)) off.delete(id);
    else off.add(id);
    update({ blocksOff: [...off] });
  }

  const fila = (b: DefBloque) => {
    const puesto = !apagados.has(b.id);
    /* ¿Tiene esta pieza algo que ESCRIBIR? Su primer grupo es el de
       contenido, y en las que no tienen ninguno —la fecha de registro, las
       visitas— ese grupo es solo «mostrar u ocultar», que ya es el ojo de
       la izquierda. Desplegar ahi una casilla repetida seria prometer algo
       que editar donde no lo hay: esas abren sus ajustes directamente. */
    const contenido = (b.grupos[0]?.controles ?? []).some((c) => c !== 'visible');
    const desplegada = abierta === b.id;
    return (
      <li
        key={b.id}
        className={`pza${puesto ? '' : ' is-off'}`}
        /* Para que la guia pueda señalar una pieza concreta. */
        data-guia={`pieza-${b.id}`}
      >
        <button
          type="button"
          className="pza__ojo"
          aria-pressed={puesto}
          onClick={() => alternar(b.id)}
          title={puesto ? `Quitar ${b.nombre} del perfil` : `Poner ${b.nombre} en el perfil`}
          aria-label={puesto ? `Quitar ${b.nombre} del perfil` : `Poner ${b.nombre} en el perfil`}
        >
          {puesto ? OJO : OJO_TACHADO}
        </button>

        {/* Pulsar la fila abre lo que esa pieza DICE: el nombre que se
            lee, tu @usuario, qué insignias enseñas. Es lo que se viene a
            hacer aquí nueve de cada diez veces, y antes llevaba al mismo
            sitio que el engranaje —treinta mandos de aspecto— para
            escribir una palabra. */}
        <button
          type="button"
          className="pza__cuerpo"
          aria-expanded={contenido ? desplegada : undefined}
          onClick={() => (contenido ? setAbierta(desplegada ? null : b.id) : onAbrir(b.id))}
        >
          <span className="pza__ico" aria-hidden="true" dangerouslySetInnerHTML={{ __html: b.icono }} />
          <span className="pza__txt">
            <span className="pza__n">{b.nombre}</span>
            <span className="pza__v">{vista(b.id, profile, insignias)}</span>
          </span>
          {contenido && (
            <span className="pza__caret" aria-hidden="true">
              {CARET}
            </span>
          )}
        </button>

        <button
          type="button"
          className="pza__cfg"
          onClick={() => onAbrir(b.id)}
          title={`Ajustes de ${b.nombre}`}
          aria-label={`Ajustes de ${b.nombre}`}
        >
          {ENGRANAJE}
        </button>

        {/* El contenido, debajo y dentro de la misma fila. Es el editor de
            siempre recortado a su primer grupo: un solo sitio donde vive
            cada control, y una pieza que gane un campo nuevo lo tiene aqui
            sin tocar nada. */}
        {desplegada && (
          <div className="pza__abre">
            <EditorBloque
              compacto
              soloContenido
              def={b}
              profile={profile}
              update={update}
              onVolver={() => setAbierta(null)}
            />
          </div>
        )}
      </li>
    );
  };

  return (
    /* `display:contents`: envuelve para poder marcar los engranajes de una
       vez —son cinco repartidos por el archivo— sin meter una caja que
       cambie la colocación de nada. */
    <div className="pzas-todo" data-pro={premium ? undefined : 'on'}>
      {/* Las dos imágenes, en fila y con su engranaje en la esquina. */}
      <div className="f-row pza-fila">
        <div className="pza-caja">
          {cajaAvatar}
          <button
            type="button"
            className="pza__cfg pza__cfg--flota"
            onClick={() => onAbrir('avatar')}
            title="Ajustes del avatar"
            aria-label="Ajustes del avatar"
          >
            {ENGRANAJE}
          </button>
        </div>

        <div className="pza-caja">
          {cajaFondo}
          <button
            type="button"
            className="pza__cfg pza__cfg--flota"
            onClick={() => onAbrir('fondo')}
            title="Ajustes del fondo"
            aria-label="Ajustes del fondo"
          >
            {ENGRANAJE}
          </button>
        </div>
      </div>

      <ul className="pzas" data-guia="bloques">
        {BLOQUES.filter((b) => b.id !== 'avatar').map(fila)}

        {/* El cursor. No es un bloque —no se pinta dentro de la tarjeta—
            pero se elige igual que uno, y estaba enterrado entre los
            deslizadores de la caja. */}
        <li className="pza pza--caja">
          <button type="button" className="pza__cuerpo" onClick={() => onAbrir('cursor')}>
            <span className="pza__ico pza__ico--dib" aria-hidden="true">
              {DIBUJOS.CURSORS?.[profile.cursor || 'default']}
            </span>
            <span className="pza__txt">
              <span className="pza__n">Cursor</span>
              <span className="pza__v">
                {profile.cursorImg
                  ? 'Imagen propia'
                  : CURSORS.find((c) => c.id === (profile.cursor || 'default'))?.name ??
                    'El del sistema'}
                {(profile.cursorTrail ?? 0) > 0 ? ' · con estela' : ''}
              </span>
            </span>
          </button>

          <button
            type="button"
            className="pza__cfg"
            onClick={() => onAbrir('cursor')}
            title="Ajustes del cursor"
            aria-label="Ajustes del cursor"
          >
            {ENGRANAJE}
          </button>
        </li>

        {/* La tarjeta es la caja que envuelve a todas, asi que va la
            ultima y sin ojo: apagarla no es quitarla, es elegir «sin
            caja», y eso se decide dentro. */}
        <li className="pza pza--caja">
          <button type="button" className="pza__cuerpo" onClick={() => onAbrir('tarjeta')}>
            <span className="pza__ico pza__ico--dib" aria-hidden="true">
              {DIBUJOS.SURFACES?.[profile.surface || 'none']}
            </span>
            <span className="pza__txt">
              <span className="pza__n">La tarjeta</span>
              <span className="pza__v">
                {SURFACES.find((x) => x.id === (profile.surface || 'none'))?.name ?? 'Sin caja'}
                {' · '}
                {profile.sWidthPct ?? 50}% de ancho
              </span>
            </span>
          </button>

          <button
            type="button"
            className="pza__cfg"
            onClick={() => onAbrir('tarjeta')}
            title="Ajustes de la tarjeta"
            aria-label="Ajustes de la tarjeta"
          >
            {ENGRANAJE}
          </button>
        </li>
      </ul>
    </div>
  );
}
