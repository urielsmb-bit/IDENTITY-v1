/**
 * MODO LLANO · que la pagina siga yendo fina sin tarjeta grafica.
 *
 * ────────────────────────────────────────────────────────────────────────
 * EL PROBLEMA
 * ────────────────────────────────────────────────────────────────────────
 *
 * `backdrop-filter` es la propiedad mas cara del CSS. En cada fotograma el
 * navegador tiene que dibujar lo que hay detras, LEERLO DE VUELTA,
 * desenfocarlo y recomponerlo. Con aceleracion por hardware eso lo hace la
 * tarjeta grafica y sale gratis. Sin ella lo hace la CPU, pixel a pixel.
 *
 * Y quien no tiene aceleracion no es un caso raro: la desactivan los
 * portatiles viejos, las maquinas virtuales, el escritorio remoto, algunos
 * antivirus, y el propio Chrome cuando decide que el controlador de video no
 * es de fiar. Esa gente veia la pagina a tirones sin saber por que.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUE SE MIDE Y NO SE PREGUNTA
 * ────────────────────────────────────────────────────────────────────────
 *
 * No hay forma de preguntarle al navegador si tiene aceleracion. Se puede
 * intentar adivinar por el nombre del controlador de WebGL, pero eso miente
 * en las dos direcciones: hay maquinas con WebGL y sin composicion por GPU,
 * y al reves.
 *
 * Asi que no se adivina: se MIDE lo unico que importa de verdad, que es si
 * los fotogramas llegan a tiempo. Si llegan, no se toca nada. Si no llegan,
 * se apagan los efectos caros.
 *
 * ────────────────────────────────────────────────────────────────────────
 * COMO SE MIDE SIN EQUIVOCARSE
 * ────────────────────────────────────────────────────────────────────────
 *
 *   · Se espera a que la pagina termine de cargar y un poco mas. Medir
 *     mientras llegan imagenes y se ejecuta el arranque seria medir la
 *     carga, no la maquina.
 *   · Se usa la MEDIANA del tiempo entre fotogramas, no la media. Un solo
 *     tiron -el recolector de basura, otra pestana- dispara la media y no
 *     dice nada; la mediana lo ignora.
 *   · Se compara contra el ritmo REAL de la pantalla, no contra 60. Hay
 *     pantallas de 120 Hz y portatiles que bajan a 30 con la bateria baja.
 *     Lo que importa es perder fotogramas, no un numero absoluto.
 *   · Y se exige que sea MALO DE VERDAD, no regular. Marcar de menos deja a
 *     alguien con tirones; marcar de mas le quita los efectos a quien podia
 *     verlos. Ante la duda, no se toca.
 *
 * El veredicto se guarda: quien ya vino no paga otra vez el segundo de
 * medida. Pero caduca, porque una maquina cambia —se enchufa a la corriente,
 * se actualiza el controlador, se conecta una pantalla— y seria injusto
 * condenarla para siempre por un mal dia.
 */

/** Cuantos fotogramas se miran. A 60 Hz es algo menos de un segundo. */
const MUESTRAS = 50;

/**
 * Se marca cuando la mediana tarda vez y media lo que deberia. A 60 Hz eso
 * es bajar de 40.
 *
 * Empezo en el doble —bajar de 30— por miedo a quitarle los efectos a quien
 * podia verlos. Fue un error de calculo: a 40 fps ya se ve a tirones, y con
 * ese liston quien iba entre 30 y 40 se quedaba con la pagina entera
 * encima y sin que nada le ayudara. A un tercio de fotogramas perdidos ya
 * no se disimula.
 */
const FACTOR = 1.5;

/** Cuanto vale el veredicto guardado. Una semana. */
const CADUCA = 7 * 24 * 60 * 60 * 1000;

const CLAVE = 'sharee:llano';

type Guardado = { llano: boolean; cuando: number };

/** El navegador no siempre deja leer el almacen: incognito, permisos. */
function leer(): Guardado | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const v = JSON.parse(crudo) as Guardado;
    if (typeof v?.llano !== 'boolean' || typeof v?.cuando !== 'number') return null;
    if (Date.now() - v.cuando > CADUCA) return null;
    return v;
  } catch {
    return null;
  }
}

function guardar(llano: boolean) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ llano, cuando: Date.now() }));
  } catch {
    /* Sin almacen se vuelve a medir en la siguiente visita. No es grave. */
  }
}

/**
 * Para el video de fondo.
 *
 * Es, con diferencia, lo mas caro que puede tener un perfil. Medido en uno
 * real: 1.402.814 px2 —tres veces la pantalla— con un `transform` encima.
 * Sin GPU eso es descodificar video Y recomponer millon y medio de pixeles
 * en cada fotograma del video, por CPU. No hay forma de que eso vaya fino:
 * no es un efecto que se pueda abaratar, es incompatible con ir fluido.
 *
 * Se PARA, no se esconde. Un video parado deja su ultimo fotograma pintado,
 * asi que el fondo se sigue viendo igual —como una foto— y deja de costar.
 * Esconderlo dejaria el perfil sin el fondo que su dueño eligio.
 *
 * Los de Vimeo van dentro de un `iframe` de otro dominio, donde no se puede
 * tocar nada... salvo pedirselo por `postMessage`, que es justo para lo que
 * su reproductor lo tiene. Si no contesta, se queda como estaba: peor no lo
 * pone.
 */
function pararVideos() {
  for (const v of document.querySelectorAll('video')) {
    try {
      v.pause();
    } catch {
      /* Un video que aun no puede pararse no es motivo para nada. */
    }
  }
  for (const m of document.querySelectorAll<HTMLIFrameElement>('iframe.pf-bgvideo')) {
    pedirPausaAlMarco(m);
  }
}

/**
 * Le pide al reproductor de Vimeo que pare.
 *
 * Dos veces a proposito. Hay una carrera que no se puede ganar de otra
 * forma: cuando esto se decide, el reproductor de dentro del marco casi
 * nunca ha terminado de cargar, y un mensaje que llega antes de tiempo se
 * pierde sin avisar. Asi que se pide ahora —por si ya estaba listo— y otra
 * vez cuando el marco termina de cargar.
 */
function pedirPausaAlMarco(m: HTMLIFrameElement) {
  const pedir = () => {
    try {
      m.contentWindow?.postMessage('{"method":"pause"}', '*');
    } catch {
      /* Otro dominio puede negarse. Entonces sigue sonando y ya esta. */
    }
  };
  pedir();
  m.addEventListener('load', pedir, { once: true });
}

function aplicar(llano: boolean) {
  const raiz = document.documentElement;
  if (llano) raiz.setAttribute('data-llano', '');
  else raiz.removeAttribute('data-llano');
  if (llano) pararVideos();
}

/**
 * Y los que lleguen despues.
 *
 * El fondo lo pinta React cuando el perfil termina de cargar, o sea despues
 * de que esto se decida. En vez de vigilar el documento —que cuesta en cada
 * cambio— se escucha el momento exacto en que un video EMPIEZA, que es la
 * unica vez que importa.
 *
 * En captura porque `play` no burbujea; asi llega igual desde el documento.
 */
function vigilarVideosNuevos() {
  document.addEventListener(
    'play',
    (e) => {
      if (!document.documentElement.hasAttribute('data-llano')) return;
      const v = e.target;
      if (v instanceof HTMLVideoElement) v.pause();
    },
    true,
  );

  /* El de Vimeo va en un marco de otro dominio y no lanza `play` aqui: no
     hay ningun evento que escuchar. Y llega TARDE —lo pinta React cuando el
     perfil termina de cargar, despues de que esto se decida— asi que mirar
     una sola vez no sirve.
     Se vigila el documento, pero solo mientras el modo esta encendido: en
     una maquina que va bien esto no llega a mirar ni un nodo. */
  if (!('MutationObserver' in window) || !document.body) return;
  new MutationObserver((cambios) => {
    if (!document.documentElement.hasAttribute('data-llano')) return;
    for (const c of cambios) {
      for (const nodo of c.addedNodes) {
        if (!(nodo instanceof Element)) continue;
        if (nodo.matches?.('iframe.pf-bgvideo')) {
          pedirPausaAlMarco(nodo as HTMLIFrameElement);
        }
        nodo.querySelectorAll?.<HTMLIFrameElement>('iframe.pf-bgvideo')
          .forEach(pedirPausaAlMarco);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}

/**
 * Mide el tiempo entre fotogramas y devuelve dos numeros: la mediana -como
 * va- y el hueco mas corto -a cuanto aspira esta pantalla-. En milisegundos.
 * `null` si la pestana se escondio a media medida: ahi el navegador deja de
 * pintar y saldria un numero malisimo que no dice nada de la maquina.
 */
function medir(): Promise<{ mediana: number; corto: number } | null> {
  return new Promise((listo) => {
    const huecos: number[] = [];
    let anterior = performance.now();
    let n = 0;

    const cuadro = (ahora: number) => {
      if (document.hidden) return listo(null);
      huecos.push(ahora - anterior);
      anterior = ahora;
      if (++n < MUESTRAS) requestAnimationFrame(cuadro);
      else {
        /* El minimo se guarda ANTES de ordenar por claridad, aunque ordenar
           no lo pierda: hacen falta las dos cosas y son dos preguntas
           distintas. La mediana dice como va; el minimo, a cuanto aspira
           esta pantalla. */
        const corto = Math.min(...huecos);
        huecos.sort((a, b) => a - b);
        const mediana = huecos[Math.floor(huecos.length / 2)];
        listo(mediana === undefined ? null : { mediana, corto });
      }
    };
    requestAnimationFrame(cuadro);
  });
}

/**
 * El ritmo al que DEBERIA ir esta pantalla, en milisegundos por fotograma.
 *
 * Se toma el hueco mas corto de la propia medida: si alguna vez llego un
 * fotograma a tiempo, ese es el ritmo de la pantalla. Es mas fiable que
 * suponer 60, que se equivoca en las de 120 Hz y en las que bajan a 30.
 */
export function ritmoDePantalla(corto: number): number {
  /* Entre 6 ms (165 Hz) y 34 ms (30 Hz). Fuera de ahi la medida esta rota y
     se vuelve al supuesto de siempre. */
  return corto >= 6 && corto <= 34 ? corto : 16.7;
}

/**
 * La decision, aparte y sin tocar nada: se marca llano cuando la mediana
 * tarda mas del doble de lo que esta pantalla es capaz de dar.
 *
 * Esta suelta para poder probarla con numeros a mano. La medida depende de
 * fotogramas de verdad y no se puede reproducir en una prueba; el criterio
 * si, y es donde estan los errores que importan.
 */
export function decidirLlano(mediana: number, corto: number): boolean {
  if (!Number.isFinite(mediana) || !Number.isFinite(corto)) return false;
  return mediana > ritmoDePantalla(corto) * FACTOR;
}

/** Deja forzarlo para poder probarlo: `?llano=1` lo enciende, `?llano=0` lo apaga. */
function forzado(): boolean | null {
  try {
    const v = new URLSearchParams(location.search).get('llano');
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    /* Una URL rara no debe tumbar el arranque. */
  }
  return null;
}

/**
 * Arranca la vigilancia. Se llama una vez, al principio de todo.
 *
 * No devuelve nada y no hay que esperarla: si la maquina va bien, esto no
 * hace absolutamente nada visible.
 */
export function vigilarFluidez() {
  if (typeof window === 'undefined' || !('requestAnimationFrame' in window)) return;

  vigilarVideosNuevos();

  const aMano = forzado();
  if (aMano !== null) {
    aplicar(aMano);
    return;
  }

  /* Quien pide menos movimiento ya tiene su propio trato en el CSS, y ahi
     las animaciones estan apagadas: medir no aportaria nada. */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const antes = leer();
  if (antes) {
    aplicar(antes.llano);
    /* Y se vuelve a medir de todos modos, en segundo plano: si la maquina
       mejoro, recupera sus efectos sin tener que borrar nada a mano. */
  }

  const arrancar = () => {
    /* Un respiro despues de cargar. Sin el se mide el arranque -imagenes,
       fuentes, el primer pintado- y cualquier maquina sale mal parada. */
    setTimeout(async () => {
      const m = await medir();
      if (!m) return;

      const llano = decidirLlano(m.mediana, m.corto);

      aplicar(llano);
      guardar(llano);
    }, 1200);
  };

  if (document.readyState === 'complete') arrancar();
  else window.addEventListener('load', arrancar, { once: true });
}
