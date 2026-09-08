import { useState } from 'react';
import type { Profile } from '@/types';
import {
  BASE_PERSONALIZADA,
  PLANTILLAS_BASE,
  PLANTILLA_BASE_POR_ID,
  type PlantillaBase,
} from '@/data/plantillasBase';
import { aplicarBase, coincideBase } from '@/lib/plantillaBase';
import { Modal } from '@/components/ui/Modal';
import { DIBUJOS } from './dibujos';

interface Props {
  profile: Profile;
  update: (partial: Partial<Profile>) => void;
  /**
   * `bienvenida` es la pantalla del primer dia: ocupa el editor entero y no
   * hay nada mas que hacer hasta elegir. `panel` es la fila de tarjetas que
   * vive dentro de «Diseño», para cambiar de plantilla mas adelante.
   */
  variante?: 'panel' | 'bienvenida';
  /** Se llama despues de elegir, para cerrar la bienvenida. */
  alElegir?: () => void;
  /**
   * Pasar al lienzo libre. Lo hace quien nos pinta, porque sembrar las
   * coordenadas exige medir la vista previa que hay en pantalla.
   */
  alLienzoLibre?: () => void;
}

/**
 * Las cinco plantillas, para elegir.
 *
 * Elegir una es un movimiento grande y a proposito: sustituye la
 * composicion entera —el ancho, la caja, los huecos y el tamaño de cada
 * bloque— por la de la plantilla. Lo que NO toca es nada de lo que has
 * escrito ni subido, ni que bloques tienes encendidos.
 *
 * Por eso solo se pregunta cuando hay algo concreto que perder: unos
 * ajustes de bloque hechos a mano o una colocacion en el lienzo libre.
 * Preguntar siempre convierte la confirmacion en un tramite que se pulsa
 * sin leer, y entonces no protege de nada.
 */
export function ElegirPlantilla({
  profile,
  update,
  variante = 'panel',
  alElegir,
  alLienzoLibre,
}: Props) {
  const [porConfirmar, setPorConfirmar] = useState<PlantillaBase | null>(null);

  const elegida = profile.base || '';
  const activa = PLANTILLA_BASE_POR_ID[elegida] ?? null;
  /** Sin plantilla previa, la elegida siembra ademas sus bloques. */
  const primeraVez = !profile.base;

  /* «Clásica» y «Clásica, con cosas cambiadas» no son lo mismo, y decirlo
     evita la pregunta de por que el perfil no se ve como la tarjeta que
     aparece marcada. */
  const tocada = !!activa && !coincideBase(profile, activa);

  /* Con el lienzo libre no manda ninguna plantilla: cada pieza esta donde
     su dueño la solto. Se marca esa tarjeta y ninguna otra, porque decir
     «Clásica» sobre un diseño colocado a mano seria mentir. */
  const libre = (profile.layoutMode || 'stack') === 'free';

  /**
   * Lo que se perderia al recolocar: ajustes hechos A MANO, o el lienzo.
   *
   * Ojo con `bstyle` a secas: las plantillas lo escriben ELLAS —los
   * tamaños de cada bloque son parte del diseño— asi que en cuanto eliges
   * una cualquiera, «hay ajustes de bloque» es cierto siempre. Con esa
   * comprobacion la confirmacion saltaba en TODOS los cambios de
   * plantilla, y una confirmacion que sale siempre se pulsa sin leer:
   * deja de proteger de nada y solo estorba.
   *
   * Lo que de verdad hay que proteger es lo que has tocado tu, y para eso
   * ya existe `coincideBase`: si el perfil sigue siendo tal cual lo dejo
   * su plantilla, no hay nada hecho a mano que perder.
   */
  const hayTrabajoFino =
    profile.layoutMode === 'free' ||
    (activa ? tocada : Object.keys(profile.bstyle ?? {}).length > 0);

  function aplicar(pl: PlantillaBase) {
    update(aplicarBase(pl, primeraVez));
    setPorConfirmar(null);
    alElegir?.();
  }

  function pedir(pl: PlantillaBase) {
    if (pl.id === elegida && !tocada) return;
    if (hayTrabajoFino && !primeraVez) {
      setPorConfirmar(pl);
      return;
    }
    aplicar(pl);
  }

  return (
    <>
      <div
        className={`plbase${variante === 'bienvenida' ? ' plbase--grande' : ''}`}
        role="group"
        aria-label="Plantillas de arranque"
      >
        {PLANTILLAS_BASE.map((pl) => {
          const on = pl.id === elegida && !libre;
          return (
            <button
              key={pl.id}
              type="button"
              className={`plbase__it${on ? ' on' : ''}`}
              aria-pressed={on}
              onClick={() => pedir(pl)}
            >
              <span className="plbase__fig" aria-hidden="true">
                {DIBUJOS.BASES?.[pl.id]}
              </span>
              <span className="plbase__n">
                {pl.nombre}
                {on && tocada && <em> · modificada</em>}
              </span>
              <span className="plbase__d">{pl.descripcion}</span>
            </button>
          );
        })}

        {/* La sexta, en el hueco que dejan cinco tarjetas en una rejilla de
            tres. No es una plantilla —es soltarlas todas— y por eso se
            dibuja con el trazo discontinuo del lienzo y no con el marco de
            las demas. Estaba enterrada en el panel de la tarjeta, debajo de
            siete deslizadores, con el nombre «Colocación de los bloques»:
            la capacidad mas llamativa del editor, invisible. */}
        {alLienzoLibre && (
          <button
            type="button"
            className={`plbase__it plbase__it--libre${libre ? ' on' : ''}`}
            aria-pressed={libre}
            onClick={() => !libre && alLienzoLibre()}
          >
            <span className="plbase__fig" aria-hidden="true">
              {DIBUJOS.LAYOUT_MODES?.free}
            </span>
            <span className="plbase__n">Rejilla libre</span>
            <span className="plbase__d">
              Coloca cada bloque donde quieras arrastrándolo en la vista previa.
              Parte de donde esté tu diseño ahora.
            </span>
          </button>
        )}
      </div>

      {/* Un perfil de antes de las plantillas, o uno ya trabajado, no
          coincide con ninguna. Decirlo es mas util que dejar las cinco
          tarjetas apagadas sin explicar por que. */}
      {elegida === BASE_PERSONALIZADA && variante === 'panel' && (
        <p className="dash__pista">
          Tu diseño es tuyo: no es el de ninguna de las cinco. Elegir una lo
          sustituye entero, pero no toca ni tu texto, ni tus redes, ni los
          bloques que tienes encendidos.
        </p>
      )}

      <Modal
        abierto={!!porConfirmar}
        alCerrar={() => setPorConfirmar(null)}
        titulo={`Cambiar a «${porConfirmar?.nombre ?? ''}»`}
        desc={
          profile.layoutMode === 'free'
            ? 'Los bloques vuelven a la columna y se colocan como diga la plantilla: la posición que les diste a mano en el lienzo se pierde. Tu texto, tus redes y tus archivos no se tocan.'
            : 'Los ajustes que hayas hecho bloque a bloque —tamaños, cajas, alineación— se sustituyen por los de la plantilla. Tu texto, tus redes y tus archivos no se tocan.'
        }
        acciones={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => porConfirmar && aplicar(porConfirmar)}
          >
            Cambiar de plantilla
          </button>
        }
      />
    </>
  );
}
