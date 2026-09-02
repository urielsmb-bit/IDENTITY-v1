import { useCallback, useRef, useState } from 'react';
import { prepararImagen } from '@/lib/imagen';
import { safeMedia } from '@/lib/utils';
import * as backend from '@/lib/backend';
import { hasBackend } from '@/lib/supabase';

export interface ResultadoMedio {
  url: string;
  /** true si es un GIF que se guardó entero para conservar la animación */
  animado: boolean;
}

interface SubirMedioProps {
  /** Título encima de la caja */
  titulo: string;
  /** URL o data URI actual */
  value: string;
  onChange: (r: ResultadoMedio) => void;
  /** Nombre del archivo en Storage: distingue avatar de fondo */
  destino: string;
  /** Lado máximo al reducir. El fondo necesita más que el avatar. */
  lado?: number;
  /** Tope para GIF, que no se puede recomprimir */
  maxAnimadoMB?: number;
  /** Id de la pista de la guia que apunta aqui. */
  guia?: string;
}

/**
 * Zona para soltar o elegir una imagen.
 *
 * Las fotos se reducen y recomprimen; los GIF pasan enteros porque pasarlos
 * por un canvas los dejaría en un solo fotograma. Los vídeos NO se suben
 * aquí: van alojados en Vimeo y se pegan como enlace.
 */
export function SubirMedio({
  titulo,
  value,
  onChange,
  destino,
  lado = 512,
  maxAnimadoMB = 3,
  guia,
}: SubirMedioProps) {
  const entradaRef = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [encima, setEncima] = useState(false);
  const [error, setError] = useState('');
  const [nota, setNota] = useState('');

  const procesar = useCallback(
    async (archivo: File | undefined) => {
      if (!archivo) return;
      setError('');
      setNota('');
      setOcupado(true);
      try {
        const img = await prepararImagen(archivo, { lado, maxAnimadoMB });

        // Con cuenta abierta, Storage: el perfil viaja ligero y la imagen se
        // sirve desde una CDN en vez de ir incrustada en cada carga.
        if (hasBackend() && backend.haySesion()) {
          const url = await backend.subirMedio(img.blob, destino, img.extension);
          onChange({ url, animado: img.animado });
          setNota(`Subido · ${img.ancho}×${img.alto}, ${img.pesoKB} KB`);
        } else {
          onChange({ url: img.dataUri, animado: img.animado });
          setNota(`En este navegador · ${img.ancho}×${img.alto}, ${img.pesoKB} KB`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo usar ese archivo.');
      } finally {
        setOcupado(false);
        if (entradaRef.current) entradaRef.current.value = '';
      }
    },
    [onChange, destino, lado, maxAnimadoMB],
  );

  const previa = safeMedia(value);

  return (
    <div className="f" data-guia={guia}>
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
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!ocupado) entradaRef.current?.click();
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
          procesar(e.dataTransfer.files?.[0]);
        }}
      >
        {previa ? (
          <img className="drop__previa" src={previa} alt={`${titulo}: elegido`} />
        ) : (
          <span className="drop__ico" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 16V4" />
              <path d="m7 9 5-5 5 5" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
          </span>
        )}
      </div>

      <input
        ref={entradaRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        hidden
        onChange={(e) => procesar(e.target.files?.[0])}
      />

      <div className="drop__pie">
        {error ? (
          <span className="drop__err" role="alert">
            {error}
          </span>
        ) : (
          <span className="drop__nota">{nota || `JPG, PNG, WebP o GIF · ${lado}px`}</span>
        )}
        {previa && !ocupado && (
          <button
            type="button"
            className="drop__quitar"
            onClick={() => {
              onChange({ url: '', animado: false });
              setNota('');
              setError('');
            }}
          >
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}
