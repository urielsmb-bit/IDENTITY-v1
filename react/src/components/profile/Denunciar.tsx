import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import { hasBackend } from '@/lib/supabase';
import * as backend from '@/lib/backend';

/**
 * Denunciar un perfil.
 *
 * La maquinaria llevaba puesta desde la migración fundacional: la tabla
 * `denuncias` con sus nueve motivos, políticas que dejan escribir a
 * cualquiera y leer a nadie, un limitador de 50 por hora y perfil y 10 al
 * día por cuenta, y hasta la tabla de retiradas para el día que haya que
 * bajar algo. Faltaba esto: un botón.
 *
 * Y esa era la parte que importaba. Una política de retirada que nadie
 * puede activar no protege a quien sale en una foto que no autorizó, y
 * tampoco te protege a ti: el puerto seguro exige que exista una vía real
 * de aviso, no que exista una tabla.
 *
 * Va aquí y no dentro de `ProfileView` a propósito. `ProfileView` también
 * pinta el carrusel de la portada, las miniaturas de plantillas y la vista
 * previa del editor, y en ninguno de esos tres sitios tiene sentido un
 * botón de denuncia —en el editor sería denunciarte a ti mismo—.
 */

/** Los nueve de `check (motivo in ...)`. El orden es el del que denuncia:
 *  primero lo que más veces trae a alguien aquí, no lo más grave. */
const MOTIVOS: Array<{ id: string; texto: string }> = [
  { id: 'suplantacion', texto: 'Se hace pasar por otra persona' },
  { id: 'acoso', texto: 'Acosa o amenaza a alguien' },
  { id: 'sexual', texto: 'Contenido sexual' },
  { id: 'menores', texto: 'Involucra a un menor' },
  { id: 'violencia', texto: 'Violencia o daño' },
  { id: 'ilegal', texto: 'Algo ilegal' },
  { id: 'copyright', texto: 'Usa material que no es suyo' },
  { id: 'spam', texto: 'Spam o engaño' },
  { id: 'otro', texto: 'Otra cosa' },
];

const TOPE_DETALLE = 2000;

export function Denunciar({ perfilId, username }: { perfilId?: string; username: string }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { toast } = useToast();

  // Sin id de perfil no hay a qué apuntar la denuncia, y sin servidor no
  // hay dónde guardarla: en los dos casos el botón mentiría.
  if (!perfilId || !hasBackend()) return null;

  /* «Otra cosa» sin explicación es una denuncia que nadie puede atender:
     llega un aviso sobre un perfil y ni una palabra de qué pasa. */
  const faltaDetalle = motivo === 'otro' && detalle.trim().length < 10;
  const puedeEnviar = !!motivo && !faltaDetalle && !enviando;

  const cerrar = () => {
    if (enviando) return;
    setAbierto(false);
  };

  const enviar = async () => {
    if (!puedeEnviar) return;
    setEnviando(true);
    try {
      await backend.denunciar(perfilId, motivo, detalle.trim() || undefined);
      setAbierto(false);
      setMotivo('');
      setDetalle('');
      toast('Denuncia enviada. Gracias por avisar.');
    } catch (e) {
      /* Los mensajes del limitador ya vienen escritos para leerse
         («este perfil ya ha recibido muchas denuncias; ya lo estamos
         mirando»), así que se enseñan tal cual. */
      toast(e instanceof Error ? e.message : 'No se pudo enviar la denuncia', true);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      {/* Discreto por diseño: esta página es de otra persona. Se ve al pasar
          por encima y al llegar con el tabulador, y no antes. */}
      <button
        type="button"
        className="denun__btn"
        onClick={() => setAbierto(true)}
        title={`Denunciar el perfil de @${username}`}
        aria-label={`Denunciar el perfil de @${username}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 21V4.5C7 2.5 10 6.5 13 4.5s6-1 7 0v9c-1-1-4-2.5-7-.5s-6-2-9 0" />
        </svg>
        <span>Denunciar</span>
      </button>

      <Modal
        abierto={abierto}
        alCerrar={cerrar}
        titulo={`Denunciar a @${username}`}
        desc="Nos llega a nosotros y lo revisamos. No se le avisa de quién ha sido."
        acciones={
          <button
            type="button"
            className="btn btn--primary"
            disabled={!puedeEnviar}
            onClick={() => void enviar()}
          >
            {enviando ? 'Enviando…' : 'Enviar denuncia'}
          </button>
        }
      >
        <fieldset className="denun__lista">
          <legend className="denun__leg">¿Qué pasa con este perfil?</legend>
          {MOTIVOS.map((m) => (
            <label key={m.id} className="denun__op">
              <input
                type="radio"
                name="motivo-denuncia"
                value={m.id}
                checked={motivo === m.id}
                onChange={() => setMotivo(m.id)}
              />
              <span>{m.texto}</span>
            </label>
          ))}
        </fieldset>

        <label className="denun__det">
          <span>
            Cuéntanos qué viste{motivo === 'otro' ? '' : ' (opcional)'}
          </span>
          <textarea
            value={detalle}
            maxLength={TOPE_DETALLE}
            rows={3}
            placeholder="Qué has visto y dónde."
            onChange={(e) => setDetalle(e.target.value.slice(0, TOPE_DETALLE))}
          />
          {faltaDetalle && (
            <small className="denun__aviso">
              Con «otra cosa» hace falta que nos digas qué pasa: si no, no
              podemos mirar nada.
            </small>
          )}
        </label>
      </Modal>
    </>
  );
}
