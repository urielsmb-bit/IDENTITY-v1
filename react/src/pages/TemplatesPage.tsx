import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PreviaPlantilla } from '@/components/plantillas/PreviaPlantilla';
import { useProfileStore } from '@/stores/profileStore';
import { useToast } from '@/hooks/useToast';
import { hasBackend } from '@/lib/supabase';
import * as backend from '@/lib/backend';
import { aplicarPlantilla } from '@/lib/plantilla';
import { num, safeMedia } from '@/lib/utils';

/**
 * Plantillas.
 *
 * Antes esta pagina tenia catorce plantillas escritas a mano en el codigo,
 * con un emoji de paleta haciendo de previa. Ahora las publica la gente,
 * mandan las mas usadas, y si no hay ninguna se dice —que es mejor que
 * rellenar con inventos, y ademas es una invitacion: el hueco pide que
 * alguien lo llene—.
 *
 * La miniatura no es un dibujo: lleva la clase `pf` y el `data-theme` de
 * verdad, asi que los colores salen de la misma hoja que el perfil.
 */
export default function TemplatesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [lista, setLista] = useState<backend.PlantillaPublica[] | null>(null);
  const [error, setError] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [nombre, setNombre] = useState('');

  const cargar = useCallback(async () => {
    if (!hasBackend()) { setLista([]); return; }
    try {
      setLista(await backend.listarPlantillas());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar');
      setLista([]);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const usar = async (p: backend.PlantillaPublica) => {
    const mio = useProfileStore.getState().mine();
    if (!mio) {
      toast('Crea tu perfil primero');
      navigate('/dashboard');
      return;
    }
    useProfileStore.getState().save(aplicarPlantilla(mio, p.ajustes));
    /* El contador se suma sin esperar: que falle no puede impedirte usarla.
       Y se sube en el momento a la lista para que el numero no se quede
       viejo delante de quien acaba de pulsar. */
    void backend.usarPlantilla(p.id);
    setLista((l) => l?.map((x) => (x.id === p.id ? { ...x, usos: x.usos + 1 } : x)) ?? l);
    toast(`Plantilla «${p.nombre}» aplicada`);
    navigate('/dashboard');
  };

  const publicar = async (e: React.FormEvent) => {
    e.preventDefault();
    const mio = useProfileStore.getState().mine();
    if (!mio) { toast('Crea tu perfil primero'); navigate('/dashboard'); return; }
    setPublicando(true);
    try {
      await backend.publicarPlantilla(nombre, mio);
      setNombre('');
      toast('Publicada. Ya puede usarla cualquiera.');
      await cargar();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo publicar');
    } finally {
      setPublicando(false);
    }
  };

  const borrar = async (p: backend.PlantillaPublica) => {
    try {
      await backend.borrarPlantilla(p.id);
      setLista((l) => l?.filter((x) => x.id !== p.id) ?? l);
      toast('Plantilla retirada');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo borrar');
    }
  };

  return (
    <div className="wrap tpl">
      <header className="tpl__enc">
        <h1 className="t-h1">Plantillas</h1>
        <p className="tpl__sub">
          El aspecto de perfiles reales, publicado por quien lo hizo. Se copia
          el diseño —colores, tipografía, colocación—, nunca su contenido.
        </p>
      </header>

      {/* Publicar la mía. Va arriba: si no hay ninguna, es lo unico que
          se puede hacer aqui, y esconderlo abajo seria raro. */}
      {hasBackend() && (
        <form className="tpl__pub" onSubmit={publicar}>
          <input
            className="inp"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre de tu plantilla"
            maxLength={40}
            aria-label="Nombre de tu plantilla"
          />
          <button className="btn btn--primary" disabled={publicando || nombre.trim().length < 2}>
            {publicando ? 'Publicando…' : 'Publicar la mía'}
          </button>
        </form>
      )}

      {error && <p className="tpl__err" role="alert">{error}</p>}

      {lista === null && <p className="tpl__vacio">Cargando…</p>}

      {/* El hueco solo se enseña cuando de verdad no hay ninguna. Si la
          carga fallo, decirlo Y decir «aun no hay» a la vez seria mentir
          sobre lo que sabemos: no lo sabemos. */}
      {lista !== null && lista.length === 0 && !error && (
        <div className="tpl__vacio">
          <p className="tpl__vacio-t">Aún no hay plantillas publicadas</p>
          <p>Crea la tuya: diseña tu perfil y publícalo aquí para que otros lo usen.</p>
          <button className="btn btn--primary" onClick={() => navigate('/dashboard')}>
            Diseñar mi perfil
          </button>
        </div>
      )}

      {lista !== null && lista.length > 0 && (
        <div className="tpl__rej">
          {lista.map((p) => (
            <article className="tpl__card" key={p.id}>
              <div className="tpl__card-h">
                <h2 className="tpl__nom">{p.nombre}</h2>
                <span className="tpl__usos">
                  {p.usos === 0 ? 'sin usar' : `${num(p.usos)} ${p.usos === 1 ? 'uso' : 'usos'}`}
                </span>
              </div>

              <PreviaPlantilla t={p.ajustes} />

              {/* Quien la hizo. En una galeria de trabajo ajeno la firma no
                  es un adorno: es de quien es. Si su perfil ya no esta
                  activo la plantilla se queda —es de quien la use— pero
                  sin firmar, en vez de enlazar a un sitio que no existe. */}
              {p.autor && (
                <Link className="tpl__autor" to={`/u/${p.autor}`}>
                  {p.autorAvatar
                    ? <img src={safeMedia(p.autorAvatar)} alt="" loading="lazy" />
                    : <span className="tpl__autor-ini" aria-hidden="true">{p.autor.charAt(0).toUpperCase()}</span>}
                  <span>@{p.autor}</span>
                </Link>
              )}

              <div className="tpl__pie">
                <button className="btn btn--primary btn--sm" onClick={() => void usar(p)}>
                  Usar plantilla
                </button>
                {p.mia && (
                  <button className="btn btn--quiet btn--sm" onClick={() => void borrar(p)}>
                    Retirar
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
