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
 * Se marca cuando la mediana tarda mas del DOBLE de lo que deberia, o sea
 * la mitad del ritmo de la pantalla. A 60 Hz eso es bajar de 30.
 *
 * Es un liston deliberadamente bajo. Entre 30 y 60 se nota pero se usa; por
 * debajo de 30 ya no es «va un poco lento», es que arrastra.
 */
const FACTOR = 2;

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

function aplicar(llano: boolean) {
  const raiz = document.documentElement;
  if (llano) raiz.setAttribute('data-llano', '');
  else raiz.removeAttribute('data-llano');
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
