import type { CSSProperties } from 'react';
import type { Profile } from '@/types';
import { FONTS } from '@/data/themes';

/**
 * Previa de una plantilla.
 *
 * Antes esto era un emoji de paleta; luego un cuadro con dos rayas del
 * color del tema. Las dos enseñaban de menos: quien entra a esta pagina
 * viene a ver COMO QUEDA, y un color no dice si la tarjeta es de cristal,
 * si tiene halo, si las esquinas son redondas o si la letra es de maquina
 * de escribir.
 *
 * Asi que esto no imita el perfil: lo usa. Lleva `pf` y `pf-stack` con los
 * mismos `data-*` y las mismas variables que el perfil de verdad, o sea
 * que las reglas de superficie —`glass` con su desenfoque, `solid`,
 * `glow`— son literalmente las mismas lineas de CSS. Si algun dia se
 * cambia como se ve el cristal, esto cambia con ello. Lo unico propio son
 * las medidas, para que quepa en una tarjeta.
 *
 * No lleva particulas ni animaciones de entrada: son doce de estas en una
 * pagina, y lo que hay que ver es la composicion, no el movimiento.
 */
export function PreviaPlantilla({ t }: { t: Partial<Profile> }) {
  const pila = FONTS.find((f) => f.id === t.font)?.stack;
  const pilaTitulo = FONTS.find((f) => f.id === t.fontDisplay)?.stack;

  const vars: CSSProperties = {};
  if (t.accent) (vars as Record<string, string>)['--p-primary'] = t.accent;
  if (t.radius != null) (vars as Record<string, string>)['--u-radius'] = `${t.radius}px`;
  if (pila) (vars as Record<string, string>)['--u-font'] = pila;
  if (pilaTitulo) (vars as Record<string, string>)['--u-fontd'] = pilaTitulo;

  return (
    <div
      className="pf plt-prev"
      data-theme={t.theme || 'dark'}
      data-surface={t.surface || 'none'}
      data-avshape={t.avShape || 'circle'}
      data-avborder={t.avBorder === false ? 'off' : 'on'}
      data-avglow={t.avGlow === false ? 'off' : 'on'}
      data-blockstyle={t.blockStyle || 'inherit'}
      style={vars}
      aria-hidden="true"
    >
      <div className="pf-stack plt-prev__stack">
        <span className="plt-prev__av" />
        <span className="plt-prev__nom">Tu nombre</span>
        <span className="plt-prev__at">@tu_usuario</span>
        <span className="plt-prev__linea plt-prev__linea--a" />
        <span className="plt-prev__linea plt-prev__linea--b" />
        <span className="plt-prev__chips">
          <i /><i /><i />
        </span>
      </div>
    </div>
  );
}
