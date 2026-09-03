import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Profile } from '@/types';
import { FONTS } from '@/data/themes';
import { ProfileView } from '@/components/profile/ProfileView';
import { aplicarPlantilla } from '@/lib/plantilla';
import { safeMedia } from '@/lib/utils';

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
/* El perfil de la previa se pinta SIEMPRE a esta medida y luego se
   encoge. Fija, para que todas las tarjetas salgan iguales: si cada una
   se midiera sola, un diseño ancho y uno estrecho darian dos escalas
   distintas y la rejilla dejaria de leerse como una rejilla. */
const ANCHO_PREVIA = 860;
const ALTO_PREVIA = 540;

export function PreviaPlantilla({
  t,
  nombre,
  usuario,
  avatar,
  perfil,
}: {
  t: Partial<Profile>;
  /** Nombre, usuario y foto de quien la publico. Sin ellos sale un
   *  maniqui, que es lo que hay que enseñar cuando su perfil ya no esta. */
  nombre?: string;
  usuario?: string;
  avatar?: string;
  /** El perfil de su autor. Con el se pinta el perfil DE VERDAD, con sus
   *  bloques y su composicion; sin el, el maniqui de abajo. */
  perfil?: Profile | null;
}) {
  /* La caja mide y de ahi sale la escala. Va arriba del todo porque un
     hook no puede vivir despues de un `return`. */
  const caja = useRef<HTMLDivElement | null>(null);
  const [escala, setEscala] = useState(0);

  useEffect(() => {
    const el = caja.current?.parentElement;   // .tpl__pre
    if (!el) return;
    const medir = () => {
      const a = el.clientWidth;
      if (a > 0) setEscala(a / ANCHO_PREVIA);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [perfil]);

  /* Con el perfil de su autor se pinta el perfil entero, encogido. El
     maniqui de abajo dibujaba un avatar, un nombre y dos rayas: sobre un
     diseño con bloques de musica, presencia de Discord y un nombre
     enorme, eso no se parecia en nada y se leia como que la plantilla no
     se habia guardado bien.

     La plantilla se aplica ENCIMA de su perfil, y eso hace dos cosas a la
     vez: se ve la composicion de verdad, y el fondo desaparece solo,
     porque `extraerPlantilla` no se lleva imagenes ni videos ajenos. O
     sea que la previa enseña exactamente lo que te vas a llevar, ni mas
     ni menos.

     Sin `particles` no: esas SI viajan, asi que se quedan.

     El encogido lo hace el mismo motor de escalado del perfil publico:
     mide el hueco y se ajusta solo. Aqui el hueco es la caja de la
     tarjeta. */
  if (perfil) {
    /* El perfil se pinta a 860x540 y se encoge a lo que mida su tarjeta.
       La escala la mide este componente y NO la hoja de estilos: se probo
       con `transform: scale(calc(100cqw / 860))` y no funciona, porque
       `scale()` pide un NUMERO y `100cqw` es una longitud. Una declaracion
       invalida se tira en silencio, asi que no habia escala ninguna: el
       perfil salia a tamaño real dentro de una caja de 267px y se veia el
       trozo de la izquierda. Se veia raro y no habia ningun error.

       Con la medida hecha aqui, todas las tarjetas quedan a la misma
       proporcion y ninguna se corta. */
    return (
      <div
        className="tpl__escala"
        ref={caja}
        aria-hidden="true"
        style={{
          width: ANCHO_PREVIA,
          height: ALTO_PREVIA,
          transform: `scale(${escala})`,
          /* Hasta que se mide, invisible: a escala 1 se veria un fogonazo
             del perfil a tamaño real antes de encogerse. */
          visibility: escala ? 'visible' : 'hidden',
        }}
      >
        <ProfileView profile={aplicarPlantilla(perfil, t)} preview />
      </div>
    );
  }

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
        {/* Con la foto y el nombre de quien la publico, no con un maniqui.
            Un «Tu nombre / @tu_usuario» sobre un diseño ajeno se lee como
            que la plantilla no se guardo bien, y ademas enseña de menos:
            lo que convence de un diseño es verlo puesto sobre alguien de
            verdad. El contenido NO viaja dentro de la plantilla —eso lo
            sigue impidiendo la lista blanca—; esto se pide aparte, al
            perfil publico de su autor, y solo para pintar la previa. */}
        <span className="plt-prev__av">
          {avatar ? <img src={safeMedia(avatar)} alt="" loading="lazy" /> : null}
        </span>
        <span className="plt-prev__nom">{nombre || usuario || 'Tu nombre'}</span>
        <span className="plt-prev__at">@{usuario || 'tu_usuario'}</span>
        <span className="plt-prev__linea plt-prev__linea--a" />
        <span className="plt-prev__linea plt-prev__linea--b" />
        <span className="plt-prev__chips">
          <i /><i /><i />
        </span>
      </div>
    </div>
  );
}
