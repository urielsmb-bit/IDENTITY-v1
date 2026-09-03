import { useCallback, useRef, useState } from 'react';
import { subirFondoVimeo, type AvanceSubida } from '@/lib/vimeoSubida';
import { prepararImagen } from '@/lib/imagen';
import { safeMedia } from '@/lib/utils';
import * as backend from '@/lib/backend';
import { hasBackend } from '@/lib/supabase';

export interface FondoSubido {
  tipo: 'image' | 'video';
  url: string;
  /** ancho/alto, solo para el vídeo: lo dice Vimeo al terminar */
  ratio?: number;
}

interface SubirFondoProps {
  titulo: string;
  /** URL del fondo actual, para enseñarlo dentro de la caja */
  previa?: string;
  onSubido: (r: FondoSubido) => void;
  onQuitar?: () => void;
  /** Id de la pista de la guia que apunta aqui. */
  guia?: string;
}

type Fase = 'quieto' | 'imagen' | 'subiendo' | 'procesando';

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
  return m || 'No se pudo subir el video.';
}

const MAX_VIDEO_MB = 60;

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
export function SubirFondo({ titulo, previa, onSubido, onQuitar, guia }: SubirFondoProps) {
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
            const url = await backend.subirMedio(img.blob, 'fondo', img.extension);
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
      if (archivo.size > MAX_VIDEO_MB * 1024 * 1024) {
        const mb = Math.round(archivo.size / 1048576);
        setError(`El vídeo pesa ${mb} MB y el tope son ${MAX_VIDEO_MB}. Recorta el bucle o bájale la calidad.`);
        return;
      }
      if (!hasBackend() || !backend.haySesion()) {
        setError('Hay que entrar en la cuenta para subir un vídeo.');
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
              {fase === 'subiendo' && `Subiendo el vídeo… ${avance?.pct ?? 0}%`}
              {fase === 'procesando' && 'Vimeo lo está procesando…'}
            </span>
            <div
              className="subvid__barra"
              role="progressbar"
              aria-valuenow={fase === 'subiendo' ? (avance?.pct ?? 0) : undefined}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <i
                className={fase === 'subiendo' ? '' : 'is-indef'}
                style={{ width: fase === 'subiendo' ? `${avance?.pct ?? 0}%` : '100%' }}
              />
            </div>
            <span className="subvid__nota">
              {fase === 'procesando'
                ? 'Tarda un par de minutos. El vídeo ya está a salvo en Vimeo.'
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
            {nota || `Foto o vídeo · vídeo hasta ${MAX_VIDEO_MB} MB`}
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
