import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Profile, AudioTrack, BlockStyle } from '@/types';
import { NETS } from '@/data/nets';
import { getBadge } from '@/data/badges';
import { insigniasGanadas } from '@/lib/insignias';
import { FONTS, EASING_CSS } from '@/data/themes';
import { useParticles } from '@/hooks/useParticles';
import { useTilt } from '@/hooks/useTilt';
import { useCursor } from '@/hooks/useCursor';
import { useDiscord, COLOR_ESTADO } from '@/hooks/useDiscord';
import { useMusic } from '@/hooks/useMusic';
import { safeUrl, safeMedia } from '@/lib/utils';
import { incrustable } from '@/lib/validar';
import { esVimeo, urlFondoVimeo } from '@/lib/vimeo';

interface ProfileViewProps {
  profile: Profile;
  /**
   * Las insignias ya resueltas, de quien las haya pedido al servidor.
   *
   * Sin esto se calculan aqui con lo que trae el propio perfil, que alcanza
   * para las de antiguedad pero no para las que concede el equipo. Nunca se
   * leen de `profile.badges`: ese campo lo escribia su dueno.
   */
  insignias?: string[];
  preview?: boolean;
  onVote?: (score: number) => void;
  myVote?: number | null;
}

/* ---- Limites del escalado del perfil ----------------------
   El perfil se encoge y se agranda entero para encajar en la pantalla, en
   vez de recolocarse. Estos son los frenos de los dos extremos.

   Por abajo: 0.42 es donde un cuerpo de 16px queda en ~7px. Menos que eso
   ya no se lee, y es preferible que la pagina se desplace a que el perfil
   sea ilegible.

   Por arriba: 1.6 aprovecha un monitor grande sin que la tarjeta se
   convierta en un cartel. Las imagenes tienen margen —los avatares se
   suben a 512px— asi que a esta escala no se ven blandas.

   `ANCHO_FULL` es el tope que su propia regla CSS le da al modo «todo el
   ancho»; se repite aqui porque el calculo necesita un numero y esa regla
   no lo expone en ninguna variable. */
const ESCALA_MIN = 0.42;
const ESCALA_MAX = 1.6;
const ANCHO_FULL = 1100;
const ANCHO_POR_DEFECTO = 460;

function fontStack(id: string) {
  const f = FONTS.find((x) => x.id === id);
  return f ? f.stack : '';
}

/**
 * Traduce los ajustes de animacion de una pieza a variables de CSS.
 *
 * La intensidad es un porcentaje sobre un valor de referencia por tipo: 100%
 * es lo que se veia antes de que esto fuera regulable, asi que un perfil que
 * no lo toque se ve igual. La direccion se convierte en un vector con signo
 * —de abajo entra con +Y, de la derecha con +X— y de ahi salen tambien los
 * ejes del volteo.
 */
function varsAnimacion(b: BlockStyle): Record<string, string> {
  const v: Record<string, string> = {};
  const k = (b.animI ?? 100) / 100;
  const dir = b.animDir || 'up';

  if (b.animMs != null) v['--b-ams'] = `${b.animMs}ms`;
  if (b.animDelay != null) v['--b-adelay'] = `${b.animDelay}ms`;
  if (b.animE) v['--b-ae'] = EASING_CSS[b.animE] ?? EASING_CSS.suave!;

  const dist = 22 * k;
  v['--b-adx'] = `${dir === 'left' ? dist : dir === 'right' ? -dist : 0}px`;
  v['--b-ady'] = `${dir === 'up' ? dist : dir === 'down' ? -dist : 0}px`;

  // Acercar por debajo de 1 y alejar por encima: al 200% entra desde el doble.
  v['--b-azoom'] = String(1 - 0.14 * k);
  v['--b-ablur'] = `${10 * k}px`;
  v['--b-arot'] = `${-8 * k}deg`;
  v['--b-aflipx'] = `${dir === 'up' ? -70 * k : dir === 'down' ? 70 * k : 0}deg`;
  v['--b-aflipy'] = `${dir === 'left' ? 70 * k : dir === 'right' ? -70 * k : 0}deg`;
  return v;
}

/** Interruptor a atributo: el CSS pregunta por "on"/"off", no por booleanos. */
const sw = (v: unknown) => (v ? 'on' : 'off');

export function ProfileView({
  profile: p,
  insignias: insigniasDadas,
  preview = false,
  onVote,
  myVote,
}: ProfileViewProps) {
  const [gateUnlocked, setGateUnlocked] = useState(!p.gate || preview);
  /** Mientras dura, el perfil ENTERO entra: el fondo sube desde negro a la
   *  vez que la tarjeta, en vez de aparecer ya puesto detrás de ella. */
  const [revelando, setRevelando] = useState(false);
  const [instaOpen, setInstaOpen] = useState(false);
  /** Hueco propio donde la API de YouTube monta su iframe. Tiene que ser un
   *  nodo sin hijos de React: si no, React y la API se pelean por el DOM. */
  const ytHostRef = useRef<HTMLDivElement>(null);

  // FX hooks
  // Las particulas estaban apagadas en la vista previa, asi que elegirlas en
  // el editor no hacia nada visible: habia que publicar y abrir el perfil
  // para saber que aspecto tenian. En la previa van en modo ligero.
  const particlesCanvasRef = useParticles(
    p.particles || 'none',
    p.accent || '#8A2BE2',
    true,
    preview,
  );
  // Apagada en el editor: la tarjeta moviendose mientras se arrastran los
  // bloques por el lienzo pelea con el propio arrastre. Se ve al publicar.
  const { rootRef, cardRef } = useTilt(!!p.tilt && !preview);
  useCursor(p.cursor || 'default', !preview, {
    img: safeMedia(p.cursorImg || ''),
    size: p.cursorSize,
    trail: p.cursorTrail,
    trailFx: p.cursorTrailFx,
  });

  const music = useMusic();
  const initMusic = music.init;

  // Clave por contenido: el objeto `profile` cambia de identidad en cada
  // re-render (contar la visita, refrescos de react-query...) y con `[p.audio]`
  // la lista se recreaba, reiniciando el reproductor a mitad de canción.
  const audioKey = p.audio ? JSON.stringify(p.audio) : '';

  const pistas: AudioTrack[] = useMemo(() => {
    const a = p.audio;
    if (!a) return [];
    if (a.tracks && a.tracks.length) return a.tracks;
    if (!a.title && !a.yt && !a.cover) return [];
    return [
      {
        title: a.title || '',
        artist: a.artist || '',
        cover: a.cover || '',
        src: a.src || 'manual',
        yt: a.yt || '',
        preview: '',
        url: a.ytUrl || '',
        length: '',
        embed: '',
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioKey]);

  // Montar el reproductor. Sin este init, crearReproductor() nunca llegaba a
  // existir y los botones de play/pausa eran decorativos.
  useEffect(() => {
    const host = ytHostRef.current;
    if (preview || !host || pistas.length === 0) return;
    initMusic(host, pistas);
  }, [pistas, preview, initMusic]);

  // ── Variables CSS ────────────────────────────────────────
  // Los nombres los fija profile.css. Escribir otro (--u-sglow en vez de
  // --u-glow) equivale exactamente a no escribir nada.
  const styleVars = useMemo(() => {
    const vars: Record<string, string> = {};
    if (p.accent) vars['--p-primary'] = p.accent;
    if (p.colText) vars['--p-text'] = p.colText;
    if (p.colBg) {
      vars['--p-bg'] = p.colBg;
      vars['--p-bg2'] = p.colBg;
    }
    if (p.colIcon) vars['--p-icon'] = p.colIcon;
    if (p.font) vars['--u-font'] = fontStack(p.font);
    if (p.fontDisplay) vars['--u-fontd'] = fontStack(p.fontDisplay);
    if (p.nameWeight) vars['--u-nameW'] = String(p.nameWeight);
    if (p.nameCase) vars['--u-nameCase'] = p.nameCase;

    vars['--p-blur'] = `${p.bgBlur || 0}px`;
    vars['--p-dim-amt'] = String((p.bgDim || 0) / 100);
    vars['--p-noise'] = String((p.noise ? 15 : 0) / 100);
    vars['--u-bg-op'] = String((p.bgOpacity ?? 100) / 100);

    // La superficie usa los MISMOS calculos que una pieza; solo cambia el
    // prefijo de las variables, porque su regla de CSS es otra.
    if ((p.enterFx || 'rise') !== 'none') {
      const a = varsAnimacion({
        animDir: p.enterDir,
        animMs: p.enterMs,
        animDelay: p.enterDelay,
        animI: p.enterI,
        animE: p.enterE,
      });
      for (const [k, v] of Object.entries(a)) vars[k.replace('--b-a', '--u-a')] = v;
    }
    // La proporción real del vídeo de fondo, para que el iframe se escale a
    // CUBRIR la pantalla en vez de encajarse dentro de un hueco 16:9.
    if (p.bgRatio) vars['--u-ar'] = String(p.bgRatio);
    if (p.bgScale && p.bgScale !== 100) vars['--u-bg-scale'] = String(p.bgScale / 100);
    if (p.sHeightPx) vars['--u-sheight'] = `${p.sHeightPx}px`;
    vars['--u-vig'] = String((p.vignette || 0) / 100);
    // El ancho va en % de un máximo de 920px, no en % del contenedor.
    // Con el % del contenedor el control era imprevisible: 100% daban ~720px
    // pero el valor por defecto eran 460px, así que BAJAR el deslizador
    // ensanchaba la tarjeta. Con esta escala 50% son los 460px de siempre y
    // el ancho solo puede crecer o menguar en el sentido que se espera.
    vars['--u-width'] =
      p.sWidthPct != null
        ? `${Math.round(p.sWidthPct * 9.2)}px`
        : `${p.stackWidth || 460}px`;
    vars['--u-gap'] = `${p.gap || 16}px`;
    if (p.canvasH != null) vars['--u-lienzo'] = `${p.canvasH}px`;
    vars['--u-radius'] = `${p.radius || 0}px`;
    vars['--u-av'] = `${p.avSize || 112}px`;
    vars['--u-ico'] = `${p.iconSize || 20}px`;
    if (p.pad != null) vars['--u-pad'] = `${p.pad}px`;
    if (p.nameSize) vars['--u-name'] = `${p.nameSize}px`;
    if (p.bioSize) vars['--u-bio'] = `${p.bioSize}px`;
    // --u-op y --u-bd se multiplican por 1% dentro del CSS: aquí van crudos.
    if (p.sOpacity != null) vars['--u-op'] = String(p.sOpacity);
    if (p.sBorder != null) vars['--u-bd'] = String(p.sBorder);
    if (p.blockRadius != null) vars['--u-brad'] = `${p.blockRadius}px`;
    if (p.sColor) vars['--u-scolor'] = p.sColor;
    if (p.sBorderColor) vars['--u-bdcolor'] = p.sBorderColor;
    vars['--u-bdw'] = `${p.sBorderW ?? 1}px`;
    vars['--u-sblur'] = `${p.sBlur ?? 22}px`;
    vars['--u-glow'] = String(p.sGlow ?? 40);

    // Espaciado y altura de línea llegan en centésimas desde el editor.
    if (p.nameSpacing) vars['--u-lsp'] = `${p.nameSpacing / 100}em`;
    if (p.lineHeight) vars['--u-lh'] = String(p.lineHeight / 100);

    // El halo del nombre: el CSS espera una distancia, no un booleano.
    vars['--u-nameglow'] = p.glowName ? '24px' : '0px';
    // data-namegrad="on" vuelve las letras transparentes y las rellena con
    // esta imagen. Sin definirla, el nombre desaparecería.
    if (p.gradient) {
      vars['--u-namegrad'] =
        'linear-gradient(90deg, var(--p-primary), var(--p-accent))';
    }
    return vars;
  }, [p]);

  // ── Fondo ────────────────────────────────────────────────
  const esMedia = p.bgType === 'image' || p.bgType === 'video';
  // Vimeo no sirve un archivo de vídeo: hay que incrustar su reproductor.
  const fondoVimeo = p.bgType === 'video' && esVimeo(p.bgValue) ? urlFondoVimeo(p.bgValue) : '';
  const fondoInline: React.CSSProperties = {};
  if (p.bgType === 'gradient' && p.bgValue) fondoInline.backgroundImage = p.bgValue;
  if (p.bgType === 'color' && p.bgValue) fondoInline.backgroundColor = p.bgValue;

  const activeTheme = p.theme || 'dark';

  // Sin puerta la entrada ocurre igual, solo que al cargar: la animacion es
  // del PERFIL, y la puerta es una forma de dispararla, no su unica forma.
  useEffect(() => {
    if (preview || p.gate) return;
    setRevelando(true);
    const t = window.setTimeout(() => setRevelando(false), 1400);
    return () => window.clearTimeout(t);
  }, [preview, p.gate]);

  const abrirPuerta = () => {
    setGateUnlocked(true);
    setRevelando(true);

    // Las animaciones de entrada ya se ejecutaron al montar, detrás de la
    // pantalla negra, y una animación de CSS no vuelve a empezar por añadir
    // un atributo: hay que quitarla, forzar un reflujo y devolverla.
    //
    // Y no basta con la tarjeta: reiniciar la del padre NO reinicia las de
    // sus hijos, asi que cada pieza con animacion propia se habia gastado
    // sin que nadie la viera. Se reinician todas de una vez, con un solo
    // reflujo para las N piezas en vez de uno por pieza.
    const pila = cardRef.current;
    if (pila) {
      const piezas = [
        pila,
        ...pila.querySelectorAll<HTMLElement>('[data-bloque]'),
      ];
      for (const el of piezas) el.style.animation = 'none';
      void pila.offsetHeight;
      for (const el of piezas) el.style.animation = '';
    }

    window.setTimeout(() => setRevelando(false), 1400);
    if (pistas.length > 0) music.play();
  };

  /* La nota la calcula el servidor a partir de `valoraciones`.
     Antes esto promediaba `p.ratings.design/originality/aesthetic`, tres
     campos que no escribia nadie: el panel ensenaba 0.0 y «0 VOTOS» aunque
     el perfil tuviera votos de verdad. */
  const notaMedia = p.nota ?? 0;
  const votos = p.numNotas ?? 0;


  /* Las insignias se calculan, no se leen del perfil.
     Antes salian de `p.badges`, que es parte de lo que escribe su dueno: por
     eso cualquiera podia ponerse «Staff». Ahora salen de cifras del servidor
     —antiguedad, visitas, notas— y de lo que el equipo haya concedido. */
  const insignias = useMemo(
    () =>
      insigniasDadas ??
      insigniasGanadas({
        creado: p.joined,
        vistas: p.views,
        nota: p.nota,
        numNotas: p.numNotas,
      }),
    [insigniasDadas, p.joined, p.views, p.nota, p.numNotas],
  );

  // ── Estilo y visibilidad por bloque ──────────────────────
  // `blocksOff` guarda lo oculto, no lo visible: así un bloque nuevo
  // aparece en los perfiles que ya existían en vez de faltar.
  const ocultos = useMemo(() => new Set(p.blocksOff ?? []), [p.blocksOff]);
  const ver = (id: string) => !ocultos.has(id);

  const modoLibre = (p.layoutMode || 'stack') === 'free';

  /* Presencia en vivo. Se conecta si hay id Y sirve para algo: el widget
     encendido, o el marco en el avatar. Sin ninguna de las dos no se abre un
     socket por nada. */
  const verWidget = !(p.blocksOff ?? []).includes('discord');
  const quiereMarco = p.discordDeco !== false;
  const { presencia: discord } = useDiscord(
    p.discordId,
    !!p.discordId && (verWidget || quiereMarco),
  );
  /** El marco de Nitro para el avatar del perfil, si lo hay y se quiere. */
  const marcoDiscord = quiereMarco ? discord?.decoracion || '' : '';

  /**
   * Encaja el lienzo libre en pantallas estrechas SIN deshacerlo.
   *
   * El diseno se compone a un ancho concreto (`--u-width`). Si la pantalla
   * es mas estrecha, en vez de apilar las piezas en columna —que convierte
   * el perfil en otro perfil— se reduce el conjunto entero. Se mide el hueco
   * real en vez de fiarse de `100vw`, que no descuenta la barra de scroll ni
   * el relleno del heroe.
   *
   * `offsetWidth` no se ve afectado por el `transform`, asi que se puede leer
   * el ancho compuesto aunque ya este escalado: no hay realimentacion.
   */
  useEffect(() => {
    const pila = cardRef.current;
    const envoltura = pila?.parentElement;      // .pf-escala
    const hueco = envoltura?.parentElement;     // .pf-hero
    if (!pila || !envoltura || !hueco) return;

    /* Lo ultimo que se aplico. Es lo que corta el bucle: fijar el ancho y la
       escala cambia el tamaño de la pila, el observador lo ve y vuelve a
       llamar aqui; en esa segunda vuelta sale lo mismo y se para. Sin esto
       haria falta un `requestAnimationFrame` para romperlo, y ese no
       dispara en una pestaña oculta: un perfil abierto en segundo plano se
       quedaba con la escala de la primera medida para siempre. */
    let ultima = '';

    const medir = () => {
      const raiz = rootRef.current;
      if (!raiz) return;

      /* ---- 1 · cuanto sitio hay de verdad --------------------
         `clientWidth/Height` incluyen el relleno del heroe, y el relleno no
         es sitio para la tarjeta: es el aire que la separa del borde. */
      const eh = getComputedStyle(hueco);
      const anchoLibre =
        hueco.clientWidth -
        (parseFloat(eh.paddingLeft) || 0) -
        (parseFloat(eh.paddingRight) || 0);
      /* El alto util NO es el del heroe: el heroe tiene `min-height` y crece
         con su contenido, asi que preguntarle cuanto mide es preguntarle a
         la tarjeta por si misma. Manda el menor entre lo que mide el hueco
         y lo que de verdad se ve —la ventana—: dentro de un contenedor
         pequeño, como la vista previa del editor, gana el hueco; en una
         pagina entera, gana la ventana. Sin esto, un telefono en horizontal
         encajaba de ancho y se salia por abajo. */
      /* El menor de los dos. `innerHeight` es la ventana; `visualViewport`
         es lo que de verdad se ve, y encoge cuando sube el teclado del
         movil. Fiarse solo del segundo no vale: hay entornos donde no
         acompaña al tamaño de la ventana. */
      const alturaVisible = Math.min(
        window.innerHeight || Infinity,
        window.visualViewport?.height || Infinity,
      );
      /* Y lo que quede por encima del heroe tampoco es sitio suyo: si
         empieza a 60px del borde, esos 60 ya no se pueden usar. */
      const desdeArriba = Math.max(0, hueco.getBoundingClientRect().top);
      const altoCaja = Math.min(
        hueco.clientHeight || Infinity,
        Number.isFinite(alturaVisible) ? alturaVisible - desdeArriba : Infinity,
      );
      const altoLibre =
        (Number.isFinite(altoCaja) ? altoCaja : 0) -
        (parseFloat(eh.paddingTop) || 0) -
        (parseFloat(eh.paddingBottom) || 0);
      if (anchoLibre <= 0) return;

      /* ---- 2 · el ancho de DISEÑO ---------------------------
         Sale de `--u-width`, la variable que lo declara. Ni `offsetWidth`
         ni el `max-width` calculado sirven: los dos vienen ya acotados al
         hueco, asi que la division daria siempre uno. `full` no declara
         uno propio —pide ocupar lo que haya— pero tiene un tope de 1100 en
         su regla, y ese es su diseño. */
      const modo = raiz.getAttribute('data-width') || 'fixed';
      const anchoDisenio =
        modo === 'full'
          ? ANCHO_FULL
          : parseFloat(getComputedStyle(raiz).getPropertyValue('--u-width')) ||
            ANCHO_POR_DEFECTO;
      if (!anchoDisenio) return;

      /* ---- 3 · fijar el ancho ANTES de medir el alto ---------
         El alto depende del ancho: con la tarjeta encogida el texto ocupa
         mas lineas y sale un alto que no es el del diseño. Se fija primero
         y se mide despues. `offsetHeight` es medida de maquetacion, asi que
         no le afecta el `transform` que ya pueda haber puesto. */
      raiz.style.setProperty('--u-ancho', `${Math.round(anchoDisenio)}px`);
      const altoDisenio = pila.offsetHeight;

      /* ---- 4 · la escala -------------------------------------
         Manda el eje mas apretado: encajar de ancho y salirse por abajo no
         es encajar. El alto solo entra en la cuenta si el hueco tiene una
         altura propia; en un contenedor que crece con su contenido, medirlo
         seria compararlo consigo mismo.

         Los topes existen por los dos extremos: por abajo, para que el
         perfil no acabe siendo ilegible en un telefono diminuto —si aun asi
         no cabe de alto, la pagina se desplaza, que es lo normal—; por
         arriba, para que en un monitor grande crezca pero no se vuelva un
         cartel de feria. */
      const porAncho = anchoLibre / anchoDisenio;
      const porAlto =
        altoLibre > 0 && altoDisenio > 0 ? altoLibre / altoDisenio : Infinity;
      const escala = Math.min(
        ESCALA_MAX,
        Math.max(ESCALA_MIN, Math.min(porAncho, porAlto)),
      );

      /* ---- 5 · aplicar, si ha cambiado algo ------------------ */
      /* El ALTO entra en la firma. Sin el, cuando solo cambiaba el alto
         —al llegar las fuentes propias, que cambian las metricas del
         texto— la escala salia igual, la firma tambien, y la compensacion
         de abajo se quedaba con el alto viejo: la tarjeta bajaba y se
         salia por el pie. */
      const firma = `${Math.round(anchoDisenio)}|${Math.round(altoDisenio)}|${escala.toFixed(4)}`;
      if (firma === ultima) return;
      ultima = firma;

      raiz.style.setProperty('--u-escala', escala.toFixed(4));

      /* Un elemento escalado conserva su caja SIN escalar, asi que hay que
         decirle cuanto ocupa de verdad. Antes esto se hacia con un margen
         negativo y era una fuente constante de restos: cualquier medida que
         llegara tarde dejaba el margen viejo y la tarjeta bajaba unos
         pixeles. Ahora la caja MIDE lo que se ve, y no hay nada que
         compensar: el centrado sale exacto solo. */
      raiz.style.setProperty(
        '--u-escala-alto',
        `${Math.round(altoDisenio * escala)}px`,
      );
    };

    /* La primera medida va DIRECTA, sin esperar al fotograma.
       `requestAnimationFrame` no dispara en una pestaña oculta, asi que un
       perfil abierto en segundo plano se quedaba sin escalar hasta que algo
       cambiara de tamaño. En un efecto la maquetacion ya esta calculada, o
       sea que medir aqui es correcto. El rAF se reserva para juntar las
       medidas seguidas del observador. */
    medir();

    /* Y dos remedidas tardias. La maquetacion del primer fotograma no es la
       definitiva: las fuentes propias llegan despues y cambian las metricas
       del texto —o sea el alto de diseño—, y algunos entornos aun no han
       aplicado el tamaño real de la ventana. Repetir sale gratis: la firma
       descarta la que no cambia nada. */
    const tarde = window.setTimeout(medir, 300);
    document.fonts?.ready.then(medir).catch(() => {});

    /* Se vigilan los tres: el hueco cambia con la ventana, la pila cambia
       cuando su dueño edita el perfil, y el envoltorio cierra el circulo si
       algun dia se le pone tamaño propio. */
    /* `resize` de ventana ademas del observador. Deberia sobrar —el
       observador ve el hueco— pero no en todos los entornos dispara, y
       quedarse con la escala de la primera medida es peor que medir de mas:
       la firma de arriba corta las repeticiones que no cambian nada. */
    window.addEventListener('resize', medir);

    const ro = new ResizeObserver(medir);
    ro.observe(hueco);
    ro.observe(pila);
    /* La barra del navegador movil aparece y desaparece al desplazarse, y
       eso cambia el alto util sin disparar un `resize` en algunos
       navegadores. `visualViewport` si lo cuenta. */
    const vv = window.visualViewport;
    vv?.addEventListener('resize', medir);
    window.addEventListener('orientationchange', medir);

    return () => {
      ro.disconnect();
      window.clearTimeout(tarde);
      window.removeEventListener('resize', medir);
      vv?.removeEventListener('resize', medir);
      window.removeEventListener('orientationchange', medir);
      const r = rootRef.current;
      r?.style.removeProperty('--u-escala');
      r?.style.removeProperty('--u-escala-alto');
      r?.style.removeProperty('--u-ancho');
    };
  }, [rootRef, cardRef]);

  const orden = p.blockOrder ?? [];

  /**
   * Traduce el estilo guardado de un bloque a lo que lee profile.css:
   * el atributo `data-bs` y las variables --b-*. Un bloque sin estilo
   * propio no recibe nada y hereda del perfil.
   */
  const bloque = (id: string): React.HTMLAttributes<HTMLElement> & Record<string, unknown> => {
    const b = p.bstyle?.[id];
    // En modo libre la pila es una rejilla de 12 columnas y cada pieza dice
    // dónde empieza y cuánto ocupa. El modelo `pos` estaba escrito y validado
    // desde la migración, pero no llegaba nunca al DOM.
    // Sin posición guardada la pieza ocupa las 12 columnas: al pasar a modo
    // libre el perfil se ve igual que en columna y desde ahí se estrecha lo
    // que se quiera. Sin este valor por defecto la rejilla la colocaba en
    // UNA columna de doce y el texto salía en vertical, letra por línea.
    const pos = modoLibre
      ? (p.pos?.[id] ?? { col: 1, span: 12, align: 'stretch' as const })
      : undefined;
    if (!b && !pos && orden.indexOf(id) === -1) return { 'data-bloque': id };

    const vars: Record<string, string> = {};
    if (pos) {
      // Lienzo libre: coordenadas exactas. La pieza se queda donde se la
      // dejó, aunque se solape con otra.
      vars.left = `${pos.x ?? 0}%`;
      vars.top = `${pos.y ?? 0}px`;
      vars.width = `${pos.w ?? 100}%`;
    }
    // El orden se aplica con `order` de CSS: así se puede reordenar sin
    // tocar el marcado, y funciona igual en columna (flex) que en rejilla.
    const iOrden = orden.indexOf(id);
    if (iOrden !== -1) vars.order = String(iOrden);
    if (b) {
    if (b.w != null) vars['--b-w'] = `${b.w}%`;
    if (b.pad != null) vars['--b-pad'] = `${b.pad}px`;
    if (b.rad != null) vars['--b-rad'] = `${b.rad}px`;
    if (b.op != null) vars['--b-op'] = String(b.op);
    if (b.bd != null) vars['--b-bd'] = String(b.bd);
    if (b.blur != null) vars['--b-blur'] = `${b.blur}px`;
    if (b.glow != null) vars['--b-glow'] = String(b.glow);
    if (b.mt != null) vars['--b-mt'] = `${b.mt}px`;
    if (b.font) vars['--b-font'] = fontStack(b.font);
    // El color de la pieza se aplica redefiniendo el token, para que
    // alcance también a lo que solo lo hereda.
    if (b.color) vars['--p-text'] = b.color;
    if (b.halo) vars['--halo'] = b.halo;
    // Colores propios de la caja del bloque. Sin esto, «heredar el estilo de
    // la superficie» copiaba los numeros pero el color seguia saliendo del
    // tema, asi que la pieza nunca acababa de parecerse a la tarjeta.
    if (b.scolor) vars['--b-scolor'] = b.scolor;
    if (b.bdcolor) vars['--b-bdcolor'] = b.bdcolor;
    if (b.bdw != null) vars['--b-bdw'] = `${b.bdw}px`;
    if (b.hi != null) vars['--b-hi'] = String(b.hi / 100);
    if (b.case && b.case !== 'none') vars['--b-case'] = b.case;
    if (b.lsp != null) vars['--b-lsp'] = `${b.lsp / 100}em`;
    if (b.size != null) vars['--b-size'] = String(b.size / 100);
    if (b.align) {
      vars['--b-align'] = b.align;
      // Las piezas que son una fila (redes, insignias) se colocan con
      // --u-just, no con text-align: hay que traducir las dos.
      vars['--u-just'] =
        b.align === 'left' ? 'flex-start' : b.align === 'right' ? 'flex-end' : 'center';
    }

    // Ajustes de la animacion de entrada. La direccion se resuelve AQUI a un
    // vector, para que un mismo fotograma sirva para las cuatro y el CSS no
    // tenga que multiplicar reglas por direccion.
    if (b.anim && b.anim !== 'none') {
      Object.assign(vars, varsAnimacion(b));
    }
    }

    // Etiqueta para que el editor pueda localizar la pieza en la vista
    // previa y dibujarle encima sus tiradores.
    const attrs: Record<string, unknown> = { 'data-bloque': id };
    if (b?.s && b.s !== 'inherit') attrs['data-bs'] = b.s;
    if (b?.halo) attrs['data-halo'] = 'on';
    if (b?.anim) attrs['data-anim'] = b.anim;
    if (Object.keys(vars).length) attrs.style = vars as React.CSSProperties;
    return attrs;
  };

  // Nunca en la vista previa: `bgfixed` vuelve las capas de fondo
  // position:fixed y taparían el editor entero, no sólo su columna.
  const fondoFijo = sw(p.bgFixed && !preview);

  return (
    <div
      ref={rootRef}
      // glow-social y glow-badge estaban definidas en el CSS y nadie las
      // ponia nunca: los dos ajustes de resplandor se guardaban en el perfil
      // y no se veian nunca.
      className={[
        'pf',
        `theme-${activeTheme}`,
        preview ? 'is-preview' : '',
        p.glowSocials ? 'glow-social' : '',
        p.glowBadges ? 'glow-badge' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-theme={activeTheme}
      data-surface={p.surface || 'none'}
      data-layout={p.layoutMode || 'stack'}
      data-align={p.align || 'center'}
      data-pos={p.stackPos || 'center'}
      data-width={p.widthMode || 'fixed'}
      data-avshape={p.avShape || 'circle'}
      data-avpos={p.avPos || 'center'}
      data-avborder={sw(p.avBorder)}
      data-avglow={sw(p.avGlow)}
      data-tilt={sw(p.tilt && !preview)}
      data-bgfixed={fondoFijo}
      data-hover={p.hoverFx || 'lift'}
      data-enter={p.enterFx || 'rise'}
      data-revelar={revelando ? 'on' : undefined}
      data-blockstyle={p.blockStyle || 'inherit'}
      data-cursor={p.cursor || 'default'}
      data-curimg={p.cursorImg && !preview ? 'on' : undefined}
      data-nameanim={p.animatedName ? 'sweep' : 'none'}
      data-namegrad={sw(p.gradient)}
      data-borde={p.sBorderOn === false ? 'off' : 'on'}
      style={styleVars as React.CSSProperties}
    >
      {/* Capas de fondo. El CSS las espera como HERMANAS dentro de .pf, cada
          una con su z-index negativo, no anidadas dentro de .pf-bg. */}
      <div
        className={`pf-bg${esMedia ? ' pf-bg--media' : ''}`}
        style={fondoInline}
        aria-hidden="true"
      >
        {p.bgType === 'video' && fondoVimeo && (
          <iframe
            className="pf-bgvideo"
            src={fondoVimeo}
            title="Fondo en vídeo"
            allow="autoplay; fullscreen"
            tabIndex={-1}
          />
        )}
        {p.bgType === 'video' && !fondoVimeo && p.bgValue && (
          <video src={safeMedia(p.bgValue)} autoPlay loop muted playsInline />
        )}
        {p.bgType === 'image' && p.bgValue && (
          <img className="pf-bgimg" src={safeMedia(p.bgValue)} alt="" />
        )}
      </div>
      <div className="pf-veil" aria-hidden="true" />
      <div className="pf-noise" aria-hidden="true" />
      <div className="pf-vig" aria-hidden="true" />

      {p.particles && p.particles !== 'none' && (
        <canvas ref={particlesCanvasRef} className="pf-particles" />
      )}

      {/* Puerta de entrada */}
      {!gateUnlocked && p.gate && (
        <div
          className="pf-gate"
          role="button"
          tabIndex={0}
          onClick={abrirPuerta}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              abrirPuerta();
            }
          }}
        >
          <div>
            <span>{p.gateText || 'Toca para entrar'}</span>
            <small>Pulsa para activar el sonido</small>
          </div>
        </div>
      )}

      {/* ── HÉROE ─────────────────────────────────────────── */}
      <section className="pf-hero">
        {/* La escala vive aqui y no en `.pf-stack` a proposito. La pila ya
            tiene dueño para su `transform`: la inclinacion 3D lo escribe, y
            las animaciones de entrada tambien —y una animacion gana sobre
            una declaracion, asi que la escala se perdia en cuanto una pieza
            entraba—. Separandolas, cada una manda en su elemento. */}
        <div className="pf-escala">
        <div ref={cardRef} className="pf-stack">
          <span className="pf-card__sheen" aria-hidden="true" />

          {/* Avatar */}
          {ver('avatar') && (p.avatarUrl || p.emoji || p.name) && (
            <div
              className="pf-avatar"
              data-fx={p.avatarFx || 'none'}
              data-deco={marcoDiscord ? 'on' : undefined}
              {...bloque('avatar')}
            >
              {p.avatarUrl ? (
                <img
                  src={safeMedia(p.avatarUrl)}
                  alt={`Avatar de ${p.name || p.username}`}
                  loading="lazy"
                />
              ) : (
                p.emoji || (p.name || '?').trim().charAt(0).toUpperCase()
              )}
              {marcoDiscord && (
                <img className="pf-avatar__deco" src={marcoDiscord} alt="" aria-hidden="true" />
              )}
            </div>
          )}

          {/* Nombre */}
          {ver('name') && (
          <div className="pf-idblock" {...bloque('name')}>
            <h1 className="pf-name">
              {p.name || p.username}
              {p.verified && (
                <svg
                  className="pf-verified"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  role="img"
                  aria-label="Verificado"
                >
                  <path d="M12 1.6 14.6 4l3.5-.3.6 3.4 3 1.8-1.5 3.1 1.5 3.1-3 1.8-.6 3.4-3.5-.3L12 22.4 9.4 20l-3.5.3-.6-3.4-3-1.8L3.8 12 2.3 8.9l3-1.8.6-3.4L9.4 4z" />
                  <path
                    d="m8.6 12.2 2.2 2.2 4.6-4.6"
                    fill="none"
                    stroke="#050505"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </h1>
          </div>
          )}

          {/* @usuario */}
          {ver('handle') && (
            <div className="pf-idblock" {...bloque('handle')}>
              <div className="pf-handle">@{p.username || 'usuario'}</div>
            </div>
          )}

          {/* Oficio, ubicación, pronombres, edad */}
          {ver('meta') && (p.title || p.location || p.pronouns || p.age) && (
            <div className="pf-idblock" {...bloque('meta')}>
              <div className="pf-title">
                {[
                  p.title ? <b key="t">{p.title}</b> : null,
                  p.location || null,
                  p.pronouns || null,
                  p.age ? `${p.age} años` : null,
                ]
                  .filter(Boolean)
                  .reduce<React.ReactNode[]>(
                    (acc, item, i) => (i === 0 ? [item] : [...acc, ' · ', item]),
                    [],
                  )}
              </div>
            </div>
          )}

          {/* Fecha de registro */}
          {ver('joined') && p.joined && (
            <div className="pf-idblock" {...bloque('joined')}>
              <div className="pf-joined">
                Se unió el{' '}
                {new Date(p.joined).toLocaleDateString('es-CO', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
          )}

          {/* Widget de Discord */}
          {ver('discord') && discord && (
            <div
              className="pf-dc"
              {...bloque('discord')}
              style={
                {
                  ...(bloque('discord').style as React.CSSProperties),
                  '--st': COLOR_ESTADO[discord.estado] ?? COLOR_ESTADO.offline,
                } as React.CSSProperties
              }
            >
              <span className="pf-dc__av">
                {discord.avatar ? (
                  <img src={discord.avatar} alt="" loading="lazy" />
                ) : (
                  <span aria-hidden="true">👤</span>
                )}
                {/* El marco de Nitro va ENCIMA del avatar y desbordandolo:
                    esa es su gracia, y por eso no puede ir dentro del
                    recorte circular. */}
                {discord.decoracion && (
                  <img className="pf-dc__deco" src={discord.decoracion} alt="" aria-hidden="true" />
                )}
                <i className="pf-dc__dot" />
              </span>
              <span>
                <span className="pf-dc__u">{discord.mostrar || discord.usuario}</span>
                <span className="pf-dc__s">{discord.actividad}</span>
                {discord.detalle && <span className="pf-dc__s">{discord.detalle}</span>}
              </span>
            </div>
          )}

          {/* Biografía */}
          {ver('bio') && p.bio && <p className="pf-bio" {...bloque('bio')}>{p.bio}</p>}

          {/* Badges */}
          {ver('badges') && insignias.length > 0 && (
            <div className="pf-badges" data-style={p.badgeStyle || 'icons'} {...bloque('badges')}>
              {insignias.slice(0, 8).map((bId) => {
                const b = getBadge(bId);
                if (!b) return null;
                return (
                  <span
                    key={bId}
                    className="pf-badge"
                    data-rare={b.rare}
                    title={`${b.label} — ${b.how}`}
                  >
                    <i
                      aria-hidden="true"
                      dangerouslySetInnerHTML={{ __html: b.icon }}
                    />
                    <b>{b.label}</b>
                  </span>
                );
              })}
            </div>
          )}

          {/* Redes */}
          {ver('socials') && p.socials && p.socials.length > 0 && (
            <div
              className="pf-socials"
              data-style={p.socialStyle || 'icons'}
              data-mono={p.monoIcons === false ? 'off' : 'on'}
              {...bloque('socials')}
            >
              {p.socials.map((s, idx) => {
                const net = NETS[s.net];
                if (!net) return null;
                const label = s.label || net.label;

                // Un enlace propio puede tomar prestado el glifo y el color de
                // cualquier red del catalogo, o llevar un emoji. Sin esto, todo
                // lo que no fuera una red conocida salia con el mismo eslabon
                // gris y no habia forma de distinguir uno de otro.
                const prestado = s.icon ? NETS[s.icon] : undefined;
                // Tres formas de icono propio: prestado del catalogo, una
                // imagen subida, o un emoji suelto.
                const propia =
                  s.icon && !prestado && (s.icon.startsWith('data:') || s.icon.startsWith('http'))
                    ? safeMedia(s.icon)
                    : '';
                const esEmoji = !!s.icon && !prestado && !propia;
                const pinta = prestado ?? net;

                return (
                  <a
                    key={`${s.net}-${idx}`}
                    className="pf-social"
                    href={safeUrl(s.url)}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    data-net={s.net}
                    data-label={label}
                    style={{ '--brand': pinta.color } as React.CSSProperties}
                    title={label}
                    aria-label={label}
                    {...(esEmoji || propia
                      ? {
                          /* Con icono propio los hijos son elementos de
                             verdad. Van SIN dangerouslySetInnerHTML: React
                             rechaza tener las dos cosas en el mismo nodo, y
                             no vale con que los hijos sean undefined —mira
                             si la prop existe, no lo que valga. */
                          children: propia ? (
                            <img className="pf-social__img" src={propia} alt="" loading="lazy" />
                          ) : (
                            <span className="pf-social__emoji">{s.icon}</span>
                          ),
                        }
                      : { dangerouslySetInnerHTML: { __html: pinta.icon } })}
                  />
                );
              })}
            </div>
          )}

          {/* Música */}
          {ver('music') && pistas.length > 0 && (
            <div className="pf-music-wrap" {...bloque('music')}>
              <div ref={ytHostRef} className="pf-music__yt" aria-hidden="true" />
              {pistas[0]?.embed ? (
                <div
                  className={`pf-insta${instaOpen ? ' is-open' : ''}`}
                  data-tipo={
                    (incrustable(pistas[0].embed).match(/embed\/(\w+)\//) || [])[1] ||
                    'track'
                  }
                  data-style={p.musicStyle || 'compact'}
                >
                  <button
                    className="pf-insta__pill"
                    type="button"
                    aria-label={`Reproducir ${pistas[0].title || 'la canción'}`}
                    onClick={() => setInstaOpen(!instaOpen)}
                  >
                    <span className="pf-insta__cover">
                      {pistas[0].cover ? (
                        <img src={safeMedia(pistas[0].cover)} alt="" loading="lazy" />
                      ) : (
                        '♪'
                      )}
                    </span>
                    <span className="pf-insta__meta">
                      <span className="pf-insta__t">{pistas[0].title || 'Música'}</span>
                      {pistas[0].artist && (
                        <span className="pf-insta__a">{pistas[0].artist}</span>
                      )}
                    </span>
                    <span className="pf-insta__viz" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                  </button>
                  {instaOpen && (
                    <div className="pf-insta__player">
                      <iframe
                        src={incrustable(pistas[0].embed)}
                        width="100%"
                        height="80"
                        frameBorder="0"
                        allow="encrypted-media"
                        title="Reproductor incrustado"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={`pf-music ${music.playing ? 'is-playing' : 'is-paused'}`}
                  data-style={p.musicStyle || 'compact'}
                  data-src={pistas[0]?.src || 'manual'}
                >
                  <span className="pf-music__cover" aria-hidden="true">
                    {pistas[0]?.cover ? (
                      <img src={safeMedia(pistas[0].cover)} alt="" />
                    ) : (
                      '♪'
                    )}
                  </span>
                  <div className="pf-music__meta">
                    <span className="pf-music__t">
                      {pistas[0]?.title || 'Pista de audio'}
                    </span>
                    <span className="pf-music__a">{pistas[0]?.artist || ''}</span>
                  </div>
                  <span className="pf-music__viz" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <div className="pf-music__ctl">
                    <button
                      className="pf-music__btn"
                      type="button"
                      aria-label={music.playing ? 'Pausar' : 'Reproducir'}
                      onClick={() => (music.playing ? music.pause() : music.play())}
                    >
                      {music.playing ? '❚❚' : '▶'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Visitas */}
          {ver('views') && p.showStats !== false && p.views != null && (
            <div className="pf-views" {...bloque('views')}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>{p.views.toLocaleString('es-CO')} visitas</span>
            </div>
          )}
        </div>
        </div>
      </section>

      {/* ── SECCIONES BAJO EL HÉROE ───────────────────────── */}
      {p.about && (
        <section className="pf-sec" id="secAbout">
          <div className="pf-sec__in">
            <h2 className="pf-sec__h">Sobre mí</h2>
            <p className="pf-sec__about">{p.about}</p>
          </div>
        </section>
      )}

      {p.links && p.links.length > 0 && (
        <section className="pf-sec" id="secLinks">
          <div className="pf-sec__in">
            <h2 className="pf-sec__h">Enlaces</h2>
            <div className="pf-links">
              {p.links.map((link, i) => (
                <a
                  key={i}
                  className="pf-link"
                  href={safeUrl(link.url)}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  <span className="pf-link__ico">{link.icon || '🔗'}</span>
                  <div>
                    <div className="pf-link__t">{link.title}</div>
                    {link.desc && <div className="pf-link__d">{link.desc}</div>}
                  </div>
                  <span className="pf-link__arrow">→</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {p.projects && p.projects.length > 0 && (
        <section className="pf-sec" id="secProjects">
          <div className="pf-sec__in">
            <h2 className="pf-sec__h">Proyectos</h2>
            <div className="pf-proj">
              {p.projects.map((proj, i) => (
                <a
                  key={i}
                  href={safeUrl(proj.url)}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  <div>
                    <div className="pf-proj__t">{proj.title}</div>
                    {proj.desc && <div className="pf-proj__d">{proj.desc}</div>}
                  </div>
                  {proj.tag && <span className="pf-proj__tag">{proj.tag}</span>}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {p.gallery && p.gallery.length > 0 && (
        <section className="pf-sec" id="secGallery">
          <div className="pf-sec__in">
            <h2 className="pf-sec__h">Galería</h2>
            <div className="pf-gallery">
              {p.gallery.map((item, i) => (
                <figure key={i}>
                  <img src={safeMedia(item.url)} alt={item.alt || ''} loading="lazy" />
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {p.showRate && (
        <section className="pf-sec" id="secRate">
          <div className="pf-sec__in">
            <h2 className="pf-sec__h">Califica este perfil</h2>

            <div className="pf-rate__score">
              {votos > 0 ? notaMedia.toFixed(1) : '—'}
              <small>
                {votos} {votos === 1 ? 'VOTO' : 'VOTOS'}
              </small>
            </div>

            <div className="pf-vote">
              {/* Cinco, no diez: la tabla `valoraciones` tiene
                  `check (nota between 1 and 5)`, asi que del 6 en
                  adelante el voto se rechazaba en el servidor. */}
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={myVote === n ? 'is-mine' : undefined}
                  onClick={() => onVote?.(n)}
                  aria-label={`Calificar con ${n}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
