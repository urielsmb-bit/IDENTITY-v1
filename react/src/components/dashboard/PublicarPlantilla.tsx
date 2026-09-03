import { useState } from 'react';
import type { Profile } from '@/types';
import { hasBackend } from '@/lib/supabase';
import * as backend from '@/lib/backend';
import { useToast } from '@/hooks/useToast';

/**
 * Publicar el diseño de este perfil como plantilla.
 *
 * Vive al final de «Diseño» porque es donde se acaba de decidir como se ve
 * el perfil. Estaba solo en la pagina de plantillas, y a esa pagina no
 * llega nadie con el diseño recien terminado en la cabeza.
 *
 * El aviso de que NO viaja el contenido no es letra pequeña: es la duda
 * que tiene cualquiera antes de pulsar, y si no se responde aqui, no se
 * pulsa. Lo que dice es verdad y lo garantiza la lista blanca de
 * `lib/plantilla.ts`, no la buena intencion de este boton.
 */
export function PublicarPlantilla({ profile }: { profile: Profile }) {
  const { toast } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!hasBackend()) return null;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await backend.publicarPlantilla(nombre, profile);
      setNombre('');
      setAbierto(false);
      toast('Publicada. Ya puede usarla cualquiera.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo publicar', true);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="grupo pubp">
      <h3 className="grupo__t">Compartir el diseño</h3>

      {!abierto ? (
        <>
          <p className="pubp__d">
            Publícalo como plantilla y cualquiera podrá aplicarlo a su
            perfil. Se copia cómo se ve —colores, tipografía, colocación—,
            nunca tu nombre, tu foto, tu biografía ni tus enlaces.
          </p>
          <button type="button" className="btn btn--ghost" onClick={() => setAbierto(true)}>
            Publicar como plantilla
          </button>
        </>
      ) : (
        <form className="pubp__f" onSubmit={enviar}>
          <input
            className="inp"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ponle un nombre"
            maxLength={40}
            autoFocus
            aria-label="Nombre de la plantilla"
          />
          <div className="pubp__acc">
            <button className="btn btn--primary" disabled={enviando || nombre.trim().length < 2}>
              {enviando ? 'Publicando…' : 'Publicar'}
            </button>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => { setAbierto(false); setNombre(''); }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
