import { useCallback } from 'react';
import type { CatalogItem } from '@/data/themes';
import { ANIM_DIRS, ANIM_EASINGS } from '@/data/themes';
import { Campo, Deslizador, Interruptor, Tarjetas } from './Controles';
import { DIBUJOS } from './dibujos';

/**
 * Lo que necesita el panel, sin importar de dónde salga.
 *
 * `BlockStyle` lo cumple tal cual, y el perfil entero lo cumple con un
 * adaptador de cinco líneas. Asi el panel es UNO: si mañana se le añade un
 * control, aparece a la vez en las piezas y en la superficie.
 */
export interface AjustesAnim {
  anim?: string;
  animDir?: string;
  animMs?: number | null;
  animDelay?: number | null;
  animI?: number | null;
  animE?: string;
}

/** Los tipos a los que la dirección les cambia algo. En «Aparecer» o
 *  «Acercar» no hay de dónde venir, así que el control sobra. */
const CON_DIRECCION = ['rise', 'slide', 'bounce', 'flip'];

/** Lo que valía cada cosa antes de que fuera ajustable. Se usan como valor
 *  mostrado cuando el bloque todavía no ha guardado el suyo, para que el
 *  deslizador no arranque en cero fingiendo que está apagado. */
const POR_DEFECTO = { ms: 700, delay: 0, intensidad: 100, easing: 'suave', dir: 'up' };

interface PanelAnimacionProps {
  /** Selector de lo que se anima DENTRO de la vista previa, para repetirla */
  destino: string;
  /** Los tipos disponibles: no son los mismos para una pieza que para la
   *  superficie entera (ésta tiene «Escalonado», por ejemplo). */
  catalogo: CatalogItem[];
  /** Cómo se llama lo que se anima, para el texto del interruptor */
  queEs: string;
  estilo: AjustesAnim;
  set: (k: keyof AjustesAnim, v: unknown) => void;
}

/**
 * Animación de entrada de una pieza, de principio a fin.
 *
 * Todo lo que se toca aquí acaba en `bstyle` del perfil, que es lo que lee
 * `ProfileView` para pintar las variables de CSS. O sea que lo que se ve en
 * la vista previa es exactamente lo que verá quien entre al perfil: no hay
 * un camino para el editor y otro para el público.
 */
export function PanelAnimacion({ destino, catalogo, queEs, estilo, set }: PanelAnimacionProps) {
  const tipo = estilo.anim || '';
  const encendida = tipo !== '' && tipo !== 'none';

  /**
   * Repite la animación en la vista previa.
   *
   * Se toca el DOM de la previa a propósito: la animación ya se ejecutó al
   * montar y CSS no la repite por cambiar una propiedad. Hay que quitarla,
   * forzar un reflujo y devolverla. Montar de nuevo el bloque desde React
   * costaría perder el estado de lo que tenga dentro (el reproductor, por
   * ejemplo) para ganar lo mismo.
   */
  const repetir = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`.dashboard__preview ${destino}`);
    if (!el) return;
    // Si lo que se repite es la superficie, sus piezas tienen animacion
    // propia y hay que reiniciarlas tambien: reiniciar el padre no reinicia
    // a los hijos. Un solo reflujo para todas.
    const todos = [el, ...el.querySelectorAll<HTMLElement>('[data-bloque]')];
    const antes = todos.map((x) => x.style.animation);
    for (const x of todos) x.style.animation = 'none';
    void el.offsetHeight;
    todos.forEach((x, i) => { x.style.animation = antes[i] ?? ''; });
  }, [destino]);

  return (
    <>
      <Interruptor
        label="Animar la entrada"
        desc={`Cómo aparece ${queEs} al abrirse el perfil`}
        on={encendida}
        onChange={(v) => set('anim', v ? 'fade' : 'none')}
      />

      {encendida && (
        <>
          <Campo label="Tipo">
            <Tarjetas
              // Sin «Del perfil» ni «Ninguna»: eso lo decide el interruptor.
              opciones={catalogo.filter((a) => a.id !== '' && a.id !== 'none')}
                  dibujos={DIBUJOS.BLOCK_ANIMS}
              value={tipo}
              onChange={(v) => set('anim', v)}
            />
          </Campo>

          {CON_DIRECCION.includes(tipo) && (
            <Campo label="Desde dónde">
              <Tarjetas
                opciones={ANIM_DIRS}
                  dibujos={DIBUJOS.ANIM_DIRS}
                value={estilo.animDir || POR_DEFECTO.dir}
                onChange={(v) => set('animDir', v)}
              />
            </Campo>
          )}

          <Deslizador
            label="Duración"
            sufijo="ms"
            min={100}
            max={3000}
            step={50}
            value={estilo.animMs ?? POR_DEFECTO.ms}
            onChange={(v) => set('animMs', v)}
          />

          <Deslizador
            label="Retraso"
            desc="Cuánto espera antes de empezar. Escalona varias piezas."
            sufijo="ms"
            min={0}
            max={3000}
            step={50}
            value={estilo.animDelay ?? POR_DEFECTO.delay}
            onChange={(v) => set('animDelay', v)}
          />

          <Deslizador
            label="Intensidad"
            desc="100 % es lo normal: cuánta distancia, giro o desenfoque recorre"
            sufijo="%"
            min={0}
            max={200}
            step={5}
            value={estilo.animI ?? POR_DEFECTO.intensidad}
            onChange={(v) => set('animI', v)}
          />

          <Campo label="Curva">
            <Tarjetas
              opciones={ANIM_EASINGS}
                  dibujos={DIBUJOS.ANIM_EASINGS}
              value={estilo.animE || POR_DEFECTO.easing}
              onChange={(v) => set('animE', v)}
            />
          </Campo>

          <div className="anim__pie">
            <button type="button" className="btn btn--sm btn--ghost" onClick={repetir}>
              ▶ Reproducir
            </button>
            <button
              type="button"
              className="lnk anim__reset"
              onClick={() => {
                // A los valores de siempre, sin apagar la animación: es
                // «vuelve a como estaba», no «quítala».
                set('animDir', POR_DEFECTO.dir);
                set('animMs', null);
                set('animDelay', null);
                set('animI', null);
                set('animE', '');
              }}
            >
              Restablecer
            </button>
          </div>
        </>
      )}
    </>
  );
}
