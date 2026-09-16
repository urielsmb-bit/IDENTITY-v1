import { useCallback, useRef, useState } from 'react';
import { subirFondoVimeo, type AvanceSubida } from '@/lib/vimeoSubida';
import { hayR2, subirAR2 } from '@/lib/r2';
import { sePuedeEncoger, conviene, encogerVideo } from '@/lib/comprimirVideo';
import { prepararImagen, posterDeVideo } from '@/lib/imagen';
import { safeMedia } from '@/lib/utils';
import * as backend from '@/lib/backend';
import { hasBackend } from '@/lib/supabase';
import { CONFIG } from '@/config';

export interface FondoSubido {
  tipo: 'image' | 'video';
  url: string;
  /** ancho/alto, solo para el vídeo: lo dice Vimeo al terminar */
  ratio?: number;
  /** El primer fotograma, ya subido. Vacío si no se pudo sacar: sin él
   *  el fondo se ve igual, solo que un segundo más tarde. */
  poster?: string;
}

interface SubirFondoProps {
  titulo: string;
  /** URL del fondo actual, para enseñarlo dentro de la caja */
  previa?: string;
  /** Lo que hay guardado AHORA en el perfil, para poder borrarlo del cubo
      al sustituirlo. No sirve `previa`: cuando el fondo es un video de
      Vimeo, `previa` trae la miniatura de Vimeo y no el archivo nuestro. */
  anterior?: string;
  /** Y su poster, que es otro archivo y hay que barrerlo igual. */
  anteriorPoster?: string;
  onSubido: (r: FondoSubido) => void;
  onQuitar?: () => void;
  /** Id de la pista de la guia que apunta aqui. */
  guia?: string;
}

/* `encogiendo` y `procesando` son cosas distintas y por eso son dos fases
   y no una: encoger pasa AQUI, en este navegador, y se sabe por donde va;
   procesar pasa en Vimeo, tarda minutos y no se sabe nada. Reusar la misma
   habria puesto «Vimeo lo esta procesando» delante de alguien cuyo video no
   ha salido de su ordenador. */
type Fase = 'quieto' | 'imagen' | 'encogiendo' | 'subiendo' | 'procesando';

/** Lo que aguanta el cubo por archivo. Lo fija la migracion 0006. */
const MAX_CUBO_MB = 8;

/**
 * Lo que se admite en R2.
 *
 * Mucho mas que el cubo de Supabase porque en R2 la SALIDA no se cobra:
 * lo que limita es el almacen (10 GB de regalo), no el trafico. Y mucho
 * menos que Vimeo porque este archivo se descarga ENTERO en cada visita,
 * sin transcodificar: lo que suba es literalmente lo que se baja quien
 * abra el perfil desde el movil.
 *
 * 64 MB es el mismo numero que firma la funcion de borde. Para hacerse
 * una idea, medido: guns.lol sirve 8 MB a 1080p y bandi.lol 16 MB a 1440p.
 */
const MAX_R2_MB = 64;

/** Cuanto se admite AHORA, segun a donde vayan a parar los videos nuevos.
 *  Una sola respuesta para el aviso de error y para el texto de la caja:
 *  con dos cuentas separadas acaban diciendo numeros distintos. */
function topeDelVideoMB(): number {
  if (hayR2()) return MAX_R2_MB;
  return CONFIG.VIMEO ? MAX_VIDEO_MB : MAX_CUBO_MB;
}

/**
 * El ancho partido por el alto, leidos del propio archivo.
 *
 * Hace falta para que el fondo encuadre bien. Por Vimeo lo dice Vimeo al
 * terminar de transcodificar; aqui lo dice el navegador en cuanto lee la
 * cabecera, sin descargar el video entero.
 */
function medirVideo(archivo: File): Promise<number> {
  return new Promise((listo) => {
    const url = URL.createObjectURL(archivo);
    const v = document.createElement('video');
    const acabar = (r: number) => {
      URL.revokeObjectURL(url);
      listo(r);
    };
    v.preload = 'metadata';
    v.onloadedmetadata = () =>
      acabar(v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9);
    // Si el navegador no sabe leerlo, 16:9 es la apuesta menos mala.
    v.onerror = () => acabar(16 / 9);
    v.src = url;
  });
}

/**
 * Traduce el fallo a algo accionable.
 *
 * «Failed to fetch» es lo que dice el navegador cuando una peticion no llega
 * a salir, y no distingue entre las dos causas que tiene esto en la
 * practica: que la funcion de borde rechace el origen, o que el CSP no deje
 * hablar con el host al que Vimeo manda subir. Las dos se arreglan en la
 * configuracion, no reintentando, asi que decirlo ahorra media hora.
 */
function explicar(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/failed to fetch|networkerror|load failed/i.test(m)) {
    return 'No se pudo hablar con el servidor de subida. Suele ser la configuracion: '
      + 'que el dominio no este en ORIGENES_PERMITIDOS, o que falte el permiso del '
      + 'CSP. Mira la consola: el motivo exacto sale ahi.';
  }
  if (/VIMEO_TOKEN/i.test(m)) {
    return 'Falta el token de Vimeo en el servidor. Sin el no se pueden subir videos.';
  }
  /* Los tres fallos de R2, traducidos. El de arriba ya cubre el mas
     probable —la peticion que el navegador no llega ni a mandar—, pero
     estos tres llegan con respuesta del servidor y en crudo no dicen nada
     a quien los lee. */
  if (/R2 sin configurar: falta/i.test(m)) {
    /* Este ya trae dentro el nombre del secreto que falta: se deja pasar
       entero a proposito, porque es LA pista. */
    return m + '. Mira supabase/R2_COMO_SE_MONTA.md, paso 5.';
  }
  if (/R2 devolvio 403/i.test(m)) {
    return 'R2 rechazo la subida. El permiso se firma para un tamaño y un tipo '
      + 'concretos, asi que esto suele ser un token sin «Object Read & Write» o '
      + 'acotado a otro cubo.';
  }
  if (/Se corto la conexion al subir|se cortó la conexión al subir/i.test(m)) {
    return 'Se corto la subida. Si acabas de montar R2, lo primero que hay que '
      + 'mirar es la politica CORS del cubo: sin ella el navegador ni lo intenta, '
      + 'y el error que da no la menciona.';
  }
  return m || 'No se pudo subir el video.';
}

const MAX_VIDEO_MB = 500;

/**
 * Una sola caja para el fondo, sea foto o vídeo.
 *
 * Antes había que decir de antemano de qué tipo era el fondo con una fila de
 * pastillas, y luego subirlo por la caja que tocara. Es un paso que el
 * navegador puede dar solo: el archivo ya dice lo que es en su `type`.
 *
 * Los dos caminos son distintos de verdad, no una cortesía:
 *   · una imagen se reduce y recomprime aquí y va a Supabase Storage;
 *   · un vídeo va entero a Vimeo, que lo transcodifica mucho mejor de lo que
 *     puede hacerlo un canvas, y tarda minutos en estar listo.
 */
export function SubirFondo({
  titulo,
  previa,
  anterior,
  anteriorPoster,
  onSubido,
  onQuitar,
  guia,
}: SubirFondoProps) {
  const entradaRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [fase, setFase] = useState<Fase>('quieto');
  const [avance, setAvance] = useState<AvanceSubida | null>(null);
  const [error, setError] = useState('');
  const [nota, setNota] = useState('');
  const [encima, setEncima] = useState(false);

  const procesar = useCallback(
    async (archivo: File | undefined) => {
      if (!archivo) return;
      setError('');
      setNota('');

      const esVideo = archivo.type.startsWith('video/');
      const esImagen = archivo.type.startsWith('image/');
      if (!esVideo && !esImagen) {
        setError('Eso no es ni una imagen ni un vídeo.');
        return;
      }

      // ── imagen ──────────────────────────────────────────────
      if (esImagen) {
        setFase('imagen');
        try {
          const img = await prepararImagen(archivo, { lado: 1920, maxAnimadoMB: 6 });
          if (hasBackend() && backend.haySesion()) {
            const url = await backend.subirMedio(img.blob, 'fondo', img.extension, anterior);
            onSubido({ tipo: 'image', url });
            setNota(`Subida · ${img.ancho}×${img.alto}, ${img.pesoKB} KB`);
          } else {
            onSubido({ tipo: 'image', url: img.dataUri });
            setNota(`En este navegador · ${img.ancho}×${img.alto}, ${img.pesoKB} KB`);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : 'No se pudo usar esa imagen.');
        } finally {
          setFase('quieto');
          if (entradaRef.current) entradaRef.current.value = '';
        }
        return;
      }

      // ── vídeo ───────────────────────────────────────────────
      /* El tope de mas arriba del todo, el que depende de a donde vaya a
         parar. Se mira aqui y con el mensaje que toca: decirle a alguien
         que «Vimeo lo optimiza» cuando el video va a R2 —donde se guarda
         tal cual— es mandarle a subir cuarenta megas que luego se baja
         entero cada visitante. */
      const topeMB = topeDelVideoMB();
      if (archivo.size > topeMB * 1024 * 1024) {
        const mb = Math.round(archivo.size / 1048576);
        setError(
          `El vídeo pesa ${mb} MB y el tope son ${topeMB}. ` +
            (hayR2()
              ? 'Recorta el bucle a unos segundos: un fondo se repite, y cuanto ' +
                'menos pese antes lo ve quien abra tu perfil.'
              : CONFIG.VIMEO
                ? 'No hace falta que lo comprimas tú: Vimeo lo optimiza al recibirlo. ' +
                  'Recorta el bucle y sube el original.'
                : 'Recorta el bucle: ahora mismo el vídeo se guarda sin optimizar.'),
        );
        if (entradaRef.current) entradaRef.current.value = '';
        return;
      }
      if (!hasBackend() || !backend.haySesion()) {
        setError('Hay que entrar en la cuenta para subir un vídeo.');
        return;
      }

      /**
       * ── R2 ──────────────────────────────────────────────────
       *
       * El camino nuevo, y el que gana cuando esta configurado. Deja un
       * archivo de verdad en un dominio propio, asi que el perfil lo pinta
       * con un `<video src>` en vez de con el reproductor de Vimeo metido
       * en un `iframe`. Medido: el iframe tarda 1.324 ms en moverse con la
       * conexion caliente; un archivo propio empieza con los primeros
       * bytes.
       *
       * Lo de antes NO se toca. Vimeo sigue ahi debajo para quien no tenga
       * R2 configurado, y sobre todo los fondos que YA estan subidos
       * siguen donde estan y se siguen viendo igual: esto solo decide a
       * donde van los nuevos.
       */
      if (hayR2()) {
        const mb = archivo.size / (1024 * 1024);
        if (mb > MAX_R2_MB) {
          setError(
            `Ese vídeo pesa ${mb.toFixed(1)} MB y el tope es ${MAX_R2_MB} MB. ` +
              'Recorta el bucle a unos segundos: un fondo se repite, y cuanto ' +
              'menos pese antes lo ve quien abra tu perfil.',
          );
          if (entradaRef.current) entradaRef.current.value = '';
          return;
        }

        const ctrlR2 = new AbortController();
        abortRef.current = ctrlR2;
        try {
          const ratio = await medirVideo(archivo);

          /**
           * Encogerlo ANTES de subirlo.
           *
           * Vimeo recomprimia lo que le echaras; R2 guarda y sirve el
           * archivo tal cual. La primera subida real fueron 41,5 MB a
           * 3840x1632 —cinco veces el fondo de guns.lol— y eso se paga dos
           * veces: en datos de quien mira y en descodificar 4K por
           * fotograma, que es justo lo que atasca a las maquinas sin
           * aceleracion.
           *
           * Devuelve `null` cuando no hace falta, cuando el navegador no
           * sabe, o cuando el resultado no mejora al original. En los tres
           * casos se sube lo que habia: encoger es una mejora, y perder el
           * fondo por ella seria cambiar lo importante por lo accesorio.
           */
          let subir: File | Blob = archivo;
          let dicho = '';
          if (sePuedeEncoger() && conviene(archivo, Math.round(ratio * 1080))) {
            setFase('encogiendo');
            setAvance({ enviados: 0, total: 100, pct: 0 });
            const chico = await encogerVideo(archivo, {
              alAvanzar: (pct) =>
                setAvance({ enviados: pct, total: 100, pct }),
              signal: ctrlR2.signal,
            });
            if (chico.encogido) {
              subir = new File([chico.blob], `fondo.${chico.extension}`, {
                type: chico.blob.type,
              });
              dicho =
                ` · de ${chico.antesMB.toFixed(1)} a ${chico.despuesMB.toFixed(1)} MB` +
                ` (${chico.ancho}×${chico.alto})`;
            } else {
              /* Se sube el original igual, pero SE DICE. La primera version
                 se lo callaba, y una subida que sale con el archivo intacto
                 era indistinguible de una que no hacia falta aligerar: media
                 hora mirando el peso en produccion para averiguarlo. */
              dicho = ` · sin aligerar (${chico.motivo})`;
            }
          }

          setFase('subiendo');
          setAvance({ enviados: 0, total: subir.size, pct: 0 });
          const url = await subirAR2(subir, 'fondo', {
            alAvanzar: setAvance,
            signal: ctrlR2.signal,
          });

          /* Y su primer fotograma, DESPUÉS del vídeo y sin poder tumbarlo.
             Aquí importa más que en ningún otro sitio: el archivo se baja
             entero antes de verse, y treinta kilobytes de portada tapan
             ese hueco desde el primer pintado. Si falla, se queda sin
             portada y ya: perder el fondo por su miniatura sería cambiar
             lo importante por lo accesorio. */
          let poster = '';
          try {
            const img = await posterDeVideo(archivo);
            if (img) poster = await subirAR2(img.blob, 'poster');
          } catch {
            /* ídem */
          }

          onSubido({ tipo: 'video', url, ratio, poster });
          setNota(
            `Subido · ${(subir.size / 1048576).toFixed(1)} MB` +
              dicho +
              (poster ? ' · con portada' : ''),
          );
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') setError('Subida cancelada.');
          else setError(explicar(e));
        } finally {
          setFase('quieto');
          setAvance(null);
          abortRef.current = null;
          if (entradaRef.current) entradaRef.current.value = '';
        }
        return;
      }

      /* Sin Vimeo configurado, el video va al mismo sitio que las imagenes.
         El cubo ya acepta mp4 y webm; lo unico que cambia es el tope, que
         es mucho mas bajo. Se dice el tope EN MB de verdad y lo que pesa el
         archivo, para que se sepa cuanto hay que recortar. */
      if (!CONFIG.VIMEO) {
        const mb = archivo.size / (1024 * 1024);
        if (mb > MAX_CUBO_MB) {
          setError(
            `Ese vídeo pesa ${mb.toFixed(1)} MB y el tope es ${MAX_CUBO_MB} MB, ` +
              'porque ahora mismo los vídeos se guardan sin optimizar y se ' +
              'descargan enteros en cada visita. Con Vimeo conectado el tope ' +
              `sube a ${MAX_VIDEO_MB} MB y él se encarga de comprimirlo.`,
          );
          if (entradaRef.current) entradaRef.current.value = '';
          return;
        }
        if (!hasBackend() || !backend.haySesion()) {
          setError('Hay que entrar en la cuenta para subir un vídeo.');
          if (entradaRef.current) entradaRef.current.value = '';
          return;
        }
        setFase('subiendo');
        try {
          const ratio = await medirVideo(archivo);
          const ext = (archivo.name.split('.').pop() || 'mp4').toLowerCase();
          const url = await backend.subirMedio(archivo, 'fondo', ext, anterior);

          /* Y su primer fotograma, DESPUÉS del vídeo y sin poder tumbarlo.
             Un vídeo de fondo tarda en llegar aunque pese poco, y mientras
             tanto detrás de la tarjeta no hay nada: treinta kilobytes de
             poster tapan ese hueco. Si el navegador no sabe decodificar
             ese formato, se sube sin poster — es un adorno, y perder el
             fondo entero por su miniatura sería cambiar lo importante por
             lo accesorio. */
          let poster = '';
          try {
            const img = await posterDeVideo(archivo);
            if (img) {
              poster = await backend.subirMedio(
                img.blob,
                'poster',
                img.extension,
                anteriorPoster,
              );
            }
          } catch {
            /* ídem: el fondo ya está arriba y es lo que se pidió. */
          }

          onSubido({ tipo: 'video', url, ratio, poster });
          setNota(
            `Subido · ${mb.toFixed(1)} MB` + (poster ? ' · con portada' : ''),
          );
        } catch (e) {
          setError(explicar(e));
        } finally {
          setFase('quieto');
          if (entradaRef.current) entradaRef.current.value = '';
        }
        return;
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setFase('subiendo');
      setAvance({ enviados: 0, total: archivo.size, pct: 0 });
      try {
        const r = await subirFondoVimeo(archivo, {
          alAvanzar: setAvance,
          alProcesar: () => setFase('procesando'),
          signal: ctrl.signal,
        });
        onSubido({ tipo: 'video', url: `https://vimeo.com/${r.id}`, ratio: r.ratio });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') setError('Subida cancelada.');
        else setError(explicar(e));
      } finally {
        setFase('quieto');
        setAvance(null);
        abortRef.current = null;
        if (entradaRef.current) entradaRef.current.value = '';
      }
    },
    [onSubido],
  );

  const ocupado = fase !== 'quieto';
  const imagenPrevia = safeMedia(previa || '');

  return (
    <div className="f subvid" data-guia={guia}>
      <div className="f__l">
        <span>{titulo}</span>
      </div>

      <div
        className={`drop${encima ? ' is-over' : ''}${ocupado ? ' is-busy' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={titulo}
        aria-busy={ocupado}
        onClick={() => !ocupado && entradaRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !ocupado) {
            e.preventDefault();
            entradaRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          if (!ocupado) procesar(e.dataTransfer.files?.[0]);
        }}
      >
        {fase === 'quieto' && imagenPrevia ? (
          <img className="drop__previa" src={imagenPrevia} alt="Fondo actual" />
        ) : fase === 'quieto' ? (
          <span className="drop__ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4" />
              <path d="m7 9 5-5 5 5" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
          </span>
        ) : (
          <div className="subvid__estado">
            <span className="subvid__t">
              {fase === 'imagen' && 'Preparando la imagen…'}
              {fase === 'encogiendo' && `Aligerando el vídeo… ${avance?.pct ?? 0}%`}
              {fase === 'subiendo' && `Subiendo el vídeo… ${avance?.pct ?? 0}%`}
              {fase === 'procesando' && 'Vimeo lo está procesando…'}
            </span>
            <div
              className="subvid__barra"
              role="progressbar"
              aria-valuenow={
                fase === 'subiendo' || fase === 'encogiendo' ? (avance?.pct ?? 0) : undefined
              }
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <i
                className={fase === 'subiendo' || fase === 'encogiendo' ? '' : 'is-indef'}
                style={{
                  width:
                    fase === 'subiendo' || fase === 'encogiendo'
                      ? `${avance?.pct ?? 0}%`
                      : '100%',
                }}
              />
            </div>
            <span className="subvid__nota">
              {fase === 'procesando'
                ? 'Tarda un par de minutos. El vídeo ya está a salvo en Vimeo.'
                : fase === 'encogiendo'
                  ? 'Se hace aquí, en tu navegador, y tarda lo que dure el vídeo. Así pesa mucho menos para quien abra tu perfil.'
                  : 'Puedes seguir editando; no cierres esta pestaña.'}
            </span>
          </div>
        )}
      </div>

      <input
        ref={entradaRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/quicktime,video/webm"
        hidden
        onChange={(e) => procesar(e.target.files?.[0])}
      />

      <div className="drop__pie">
        {error ? (
          <span className="drop__err" role="alert">{error}</span>
        ) : (
          <span className="drop__nota">
            {/* El tope que se anuncia tiene que ser el que se va a aplicar:
                cambia segun a donde vaya el video. */}
            {nota ||
              `Foto o vídeo · vídeo hasta ${topeDelVideoMB()} MB`}
          </span>
        )}
        {fase === 'subiendo' && (
          <button
            type="button"
            className="drop__quitar"
            onClick={() => abortRef.current?.abort()}
          >
            Cancelar
          </button>
        )}
        {fase === 'quieto' && previa && onQuitar && (
          <button type="button" className="drop__quitar" onClick={onQuitar}>
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}
