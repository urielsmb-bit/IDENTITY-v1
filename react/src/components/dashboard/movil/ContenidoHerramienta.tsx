import { useEffect, useRef, type ReactNode } from 'react';
import { EditorBloque } from '@/components/dashboard/EditorBloque';
import { Piezas } from '@/components/dashboard/Piezas';
import { PanelInsignias } from '@/components/dashboard/PanelInsignias';
import { ElegirPlantilla } from '@/components/dashboard/ElegirPlantilla';
import { SelectorEstela } from '@/components/dashboard/SelectorEstela';
import { AjustesCuenta } from '@/components/dashboard/AjustesCuenta';
import { Campo, Tarjetas, Pro, Deslizador } from '@/components/dashboard/Controles';
import { PARTICLES } from '@/data/themes';
import { DIBUJOS } from '@/components/dashboard/dibujos';
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
  /** El grupo al que bajar nada más abrir, si se llegó por la barra
   *  contextual. Es el título tal cual lo declara el bloque. */
  grupoDestino?: string | null;
  onGrupoVisto?: () => void;
  onAbrirBloque: (id: string) => void;
  onVolver: () => void;
  /**
   * Lo que solo sabe construir `DashboardPage`.
   *
   * Fondo y Animaciones se arman ahi con una docena de cierres locales
   * —qué miniatura enseñar, a dónde sube cada archivo, cómo se traduce
   * cada ajuste de animación a su campo del perfil—. Se pasan HECHOS, ya
   * pintados, en vez de rehacerlos aquí: rehacerlos seria tener dos
   * versiones de esa logica, que es justo lo que este archivo existe para
   * evitar. El escritorio pinta ESTOS MISMOS nodos.
   */
  nodoFondo?: ReactNode;
  nodoAnimacion?: ReactNode;
  /** Lo que `AjustesCuenta` necesita y no sale del perfil. */
  ajustes?: {
    /* La firma EXACTA que declara `AjustesCuenta`, copiada tal cual. La
       primera version puso `() => void` «porque total, es un guardado», y
       `tsc -b` lo cazó al construir: recibe un parche y devuelve una
       promesa, y estrecharla aqui rompia la llamada de alli. */
    guardarAhora: (cambios: Partial<Profile>) => Promise<void>;
    guiaApagada: boolean;
    aprendidas: number;
    totalPistas: number;
    reiniciarGuia: () => void;
  };
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
  grupoDestino, onGrupoVisto, onAbrirBloque, onVolver,
  nodoFondo, nodoAnimacion, ajustes,
}: ContenidoProps) {
  const caja = useRef<HTMLDivElement>(null);

  /**
   * Bajar al grupo por el que se entró.
   *
   * Se busca por el TEXTO del encabezado y no por un identificador porque
   * `EditorBloque` no pone ninguno — y añadírselo sería tocar el editor
   * que comparte con el escritorio por una comodidad de este lado. Los
   * títulos ya son únicos dentro de un bloque, que es todo lo que hace
   * falta aquí.
   *
   * Y NO se esconden los demás grupos. Filtrar dejaría el resto
   * inalcanzable desde este camino, y el objetivo era llegar antes a una
   * cosa, no perder las otras.
   */
  useEffect(() => {
    if (!grupoDestino || !bloque) return;
    const t = window.setTimeout(() => {
      const enc = Array.from(caja.current?.querySelectorAll('.grupo__t') ?? [])
        .find((h) => h.textContent?.trim() === grupoDestino);
      enc?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      onGrupoVisto?.();
    }, 60);
    return () => window.clearTimeout(t);
  }, [grupoDestino, bloque, onGrupoVisto]);
  /* Un bloque abierto manda sobre la herramienta desde la que se llegó: el
     editor es el MISMO del escritorio, en modo compacto —sin la miga de
     pan ni el título, que aquí los pone la cabecera de la hoja—. */
  if (bloque && BLOQUE_POR_ID[bloque]) {
    return (
      <div ref={caja}>
      <EditorBloque
        def={BLOQUE_POR_ID[bloque]}
        profile={profile}
        update={update}
        onVolver={onVolver}
        compacto
        premium={premium}
        insignias={insignias}
      />
      </div>
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
      return nodoFondo ?? <Pendiente que="El fondo" donde="SubirFondo" />;

    case 'animaciones':
      return nodoAnimacion ?? <Pendiente que="Las animaciones" donde="PanelAnimacion" />;

    case 'efectos':
      /* Aqui SI se cablea a mano, y se puede: son dos controles que
         escriben campos del perfil sin ninguna logica intermedia. Los
         componentes —`Tarjetas`, `SelectorEstela`— son los mismos del
         escritorio; lo unico que se repite es a que campo va cada uno, que
         es una linea. Fondo y Animaciones no se pueden hacer asi porque
         ahi si hay logica que copiar. */
      return (
        <>
          <Pro bloqueado={!premium}>
            <Campo label="Partículas">
              <Tarjetas
                opciones={PARTICLES}
                dibujos={DIBUJOS.PARTICLES}
                value={profile.particles || 'none'}
                onChange={(v) => update({ particles: v })}
              />
            </Campo>
          </Pro>
          <Pro bloqueado={!premium}>
            {/* `Deslizador` trae su propia etiqueta, no va dentro de un
                `Campo`: envolverlo pintaba el rotulo dos veces. */}
            <Deslizador
              label="Viñeta"
              sufijo="%"
              min={0}
              max={100}
              value={profile.vignette ?? 0}
              onChange={(v) => update({ vignette: v })}
            />
          </Pro>
          <Pro bloqueado={!premium}>
            <SelectorEstela
              fx={profile.cursorTrailFx || 'chispas'}
              color={profile.cursorTrailColor || ''}
              intensidad={profile.cursorTrailInt ?? 100}
              cantidad={
                profile.cursorTrail ??
                (profile.cursor === 'dot' || profile.cursor === 'blade' ? 5 : 0)
              }
              direccion={profile.cursorTrailDir || 'seguimiento'}
              onCambio={(cambio) => update(cambio)}
            />
          </Pro>
        </>
      );

    case 'ajustes':
      return ajustes ? (
        <AjustesCuenta
          profile={profile}
          update={update}
          guardarAhora={ajustes.guardarAhora}
          guiaApagada={ajustes.guiaApagada}
          aprendidas={ajustes.aprendidas}
          totalPistas={ajustes.totalPistas}
          reiniciarGuia={ajustes.reiniciarGuia}
        />
      ) : <Pendiente que="Los ajustes" donde="AjustesCuenta" />;

    default:
      return null;
  }
}
