import { EditorBloque } from '@/components/dashboard/EditorBloque';
import { Piezas } from '@/components/dashboard/Piezas';
import { PanelInsignias } from '@/components/dashboard/PanelInsignias';
import { ElegirPlantilla } from '@/components/dashboard/ElegirPlantilla';
import { BLOQUES, BLOQUE_POR_ID } from '@/data/bloques';
import type { IdHerramienta } from '@/data/herramientasMovil';
import type { DatosInsignias } from '@/lib/insignias';
import type { Profile } from '@/types';

/**
 * Lo que va dentro de cada hoja.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LA REGLA DE ESTE ARCHIVO
 * ────────────────────────────────────────────────────────────────────────
 *
 * No pinta ni un control. Ninguno. Lo único que hace es decidir QUÉ
 * componente ya existente le toca a cada herramienta y pasárselo hecho.
 *
 * Eso no es pereza: es lo que garantiza la paridad. Si un control se
 * pintara aquí, existirían dos versiones de él —la del ordenador y la del
 * teléfono— y el día que alguien arregle una, la otra se queda con el
 * fallo. Pasando por `EditorBloque`, los dos editores enseñan literalmente
 * el mismo componente con los mismos datos.
 *
 * Añadir un control a un bloque sigue siendo tocar `data/bloques.ts`, y
 * aparece en los dos editores solo.
 *
 * ────────────────────────────────────────────────────────────────────────
 * DOS CAMINOS A LO MISMO, A PROPOSITO
 * ────────────────────────────────────────────────────────────────────────
 *
 * «Texto» y «Perfil» y «Bloques» llevan a editar cosas que se solapan. No
 * es un descuido:
 *
 *   Perfil   quién eres      — avatar, nombre, @usuario, bio
 *   Texto    cómo se lee     — los mismos, pero entrando por la tipografía
 *   Bloques  qué hay y dónde — la estructura entera, con su visibilidad
 *
 * Son tres preguntas distintas que a veces terminan en el mismo sitio. En
 * una pantalla pequeña eso ayuda: se llega antes por el camino en el que
 * ya estabas pensando.
 */

/** Los que forman la identidad. Salen del catálogo, no de una lista
 *  escrita a mano: si mañana se añade un bloque de identidad, entra solo. */
const DE_PERFIL = ['avatar', 'name', 'handle', 'bio', 'meta', 'joined'];
/** Los que llevan texto propio, que es lo que «Texto» viene a tocar. */
const DE_TEXTO = BLOQUES.filter((b) => b.campoTexto).map((b) => b.id);

export interface ContenidoProps {
  herramienta: IdHerramienta;
  /** El bloque abierto dentro de la herramienta, si hay uno. */
  bloque: string | null;
  profile: Profile;
  update: (p: Partial<Profile>) => void;
  premium: boolean;
  insignias: string[];
  datosInsignias: DatosInsignias;
  onAbrirBloque: (id: string) => void;
  onVolver: () => void;
}

/** Una fila que abre un bloque. Alta de verdad: 56px es lo que un pulgar
 *  acierta sin mirar, y estas listas se usan con el teléfono en una mano. */
function Fila({ id, onAbrir }: { id: string; onAbrir: (id: string) => void }) {
  const def = BLOQUE_POR_ID[id];
  if (!def) return null;
  return (
    <button type="button" className="em__fila" onClick={() => onAbrir(id)}>
      <span className="em__fila-i" aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: def.icono }} />
      <span className="em__fila-t">
        <strong>{def.nombre}</strong>
        {def.descripcion && <small>{def.descripcion}</small>}
      </span>
      <svg className="em__fila-v" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );
}

function Lista({ ids, onAbrir }: { ids: string[]; onAbrir: (id: string) => void }) {
  return (
    <div className="em__lista">
      {ids.map((id) => <Fila key={id} id={id} onAbrir={onAbrir} />)}
    </div>
  );
}

/** Lo que todavía no se ha conectado. Dice QUÉ falta y dónde vive, no un
 *  «próximamente»: eso no ayuda a nadie a saber si su función existe. */
function Pendiente({ que, donde }: { que: string; donde: string }) {
  return (
    <p className="em__pendiente">
      <strong>{que}</strong> todavía se edita desde el ordenador. Sus controles viven
      en <code>{donde}</code> y se conectan aquí sin escribir ninguno nuevo.
    </p>
  );
}

export function ContenidoHerramienta({
  herramienta, bloque, profile, update, premium, insignias, datosInsignias,
  onAbrirBloque, onVolver,
}: ContenidoProps) {
  /* Un bloque abierto manda sobre la herramienta desde la que se llegó: el
     editor es el MISMO del escritorio, en modo compacto —sin la miga de
     pan ni el título, que aquí los pone la cabecera de la hoja—. */
  if (bloque && BLOQUE_POR_ID[bloque]) {
    return (
      <EditorBloque
        def={BLOQUE_POR_ID[bloque]}
        profile={profile}
        update={update}
        onVolver={onVolver}
        compacto
        premium={premium}
        insignias={insignias}
      />
    );
  }

  switch (herramienta) {
    case 'diseno':
      return (
        <ElegirPlantilla
          profile={profile}
          update={update}
          variante="panel"
          premium={premium}
        />
      );

    case 'perfil':
      return <Lista ids={DE_PERFIL} onAbrir={onAbrirBloque} />;

    case 'texto':
      return <Lista ids={DE_TEXTO} onAbrir={onAbrirBloque} />;

    case 'bloques':
      /* El mismo panel del escritorio: trae la visibilidad, el orden y la
         entrada al editor de cada uno. No hacía falta nada nuevo. */
      return (
        <Piezas
          profile={profile}
          update={update}
          onAbrir={onAbrirBloque}
          insignias={insignias}
          premium={premium}
        />
      );

    case 'redes':
      return (
        <EditorBloque
          def={BLOQUE_POR_ID.socials!}
          profile={profile}
          update={update}
          onVolver={onVolver}
          compacto
          premium={premium}
          insignias={insignias}
        />
      );

    case 'musica':
      return (
        <EditorBloque
          def={BLOQUE_POR_ID.music!}
          profile={profile}
          update={update}
          onVolver={onVolver}
          compacto
          premium={premium}
          insignias={insignias}
        />
      );

    case 'avatar':
      return (
        <EditorBloque
          def={BLOQUE_POR_ID.avatar!}
          profile={profile}
          update={update}
          onVolver={onVolver}
          compacto
          premium={premium}
          insignias={insignias}
        />
      );

    case 'badges':
      return <PanelInsignias datos={datosInsignias} />;

    case 'fondo':
      return <Pendiente que="El fondo" donde="SubirFondo + los controles de fondo" />;

    case 'animaciones':
      return <Pendiente que="Las animaciones" donde="PanelAnimacion" />;

    case 'efectos':
      return <Pendiente que="Los efectos" donde="SelectorEstela + partículas" />;

    case 'ajustes':
      return <Pendiente que="Los ajustes de la cuenta" donde="AjustesCuenta" />;

    default:
      return null;
  }
}
