import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PreviaPlantilla } from '@/components/plantillas/PreviaPlantilla';
import { useProfileStore } from '@/stores/profileStore';
import { useToast } from '@/hooks/useToast';
import { hasBackend } from '@/lib/supabase';
import * as backend from '@/lib/backend';
import { aplicarPlantilla } from '@/lib/plantilla';
import * as local from '@/lib/plantillasLocales';
import { num, safeMedia } from '@/lib/utils';

/**
 * Biblioteca de plantillas.
 *
 * La pagina va de arriba abajo en el orden en que se decide algo: que es
 * esto (cabecera) · que estoy mirando (pestañas) · como lo acoto (buscar
 * y ordenar) · lo que hay (rejilla). Antes eran tres bloques apilados sin
 * relacion, con el formulario de publicar ocupando una fila entera aunque
 * solo vinieras a mirar.
 *
 * En la tarjeta manda la PREVIA, y por eso va arriba. Antes iba segunda,
 * debajo del nombre y de las cifras: se leia primero el dato y despues el
 * diseño, cuando aqui se viene a ver diseños. Debajo, en este orden:
 * quien la hizo, cuanto se usa, y que se puede hacer con ella.
 */

const PESTANAS = [
  { id: 'todas', label: 'Biblioteca' },
  { id: 'favs', label: 'Favoritas' },
  { id: 'usadas', label: 'Recientes' },
  { id: 'mias', label: 'Mías' },
] as const;
type Pestana = (typeof PESTANAS)[number]['id'];

const ORDENES = [
  { id: 'usos', label: 'Más usadas' },
  { id: 'nuevas', label: 'Más recientes' },
  { id: 'az', label: 'A–Z' },
] as const;
type Orden = (typeof ORDENES)[number]['id'];

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [lista, setLista] = useState<backend.PlantillaPublica[] | null>(null);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState<Pestana>('todas');
  const [orden, setOrden] = useState<Orden>('usos');
  const [busca, setBusca] = useState('');
  const [favs, setFavs] = useState<string[]>(() => local.favoritas());
  const [usadas, setUsadas] = useState<string[]>(() => local.usadas());

  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [publicando, setPublicando] = useState(false);

  const cargar = useCallback(async () => {
    if (!hasBackend()) {
      setLista([]);
      return;
    }
    try {
      setLista(await backend.listarPlantillas());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar');
      setLista([]);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /* Se filtra y se ordena aqui, no en el servidor: son como mucho sesenta
     filas que ya estan en memoria, y volver a pedirlas por cada letra que
     se escribe seria una peticion por pulsacion para no ganar nada. */
  const visibles = useMemo(() => {
    if (!lista) return [];
    const q = busca.trim().toLowerCase();
    let v = lista.filter((p) => {
      if (pestana === 'favs' && !favs.includes(p.id)) return false;
      if (pestana === 'usadas' && !usadas.includes(p.id)) return false;
      if (pestana === 'mias' && !p.mia) return false;
      if (!q) return true;
      return `${p.nombre} ${p.autor}`.toLowerCase().includes(q);
    });

    if (pestana === 'usadas') {
      /* Aqui manda el orden en que se usaron y no el desplegable: eso es
         lo que significa «recientes». */
      v = [...v].sort((a, b) => usadas.indexOf(a.id) - usadas.indexOf(b.id));
    } else if (orden === 'nuevas') {
      v = [...v].sort((a, b) => b.creado.localeCompare(a.creado));
    } else if (orden === 'az') {
      v = [...v].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }
    return v;
  }, [lista, pestana, orden, busca, favs, usadas]);

  const cuenta = (id: Pestana) => {
    if (!lista) return 0;
    if (id === 'favs') return lista.filter((p) => favs.includes(p.id)).length;
    if (id === 'usadas') return lista.filter((p) => usadas.includes(p.id)).length;
    if (id === 'mias') return lista.filter((p) => p.mia).length;
    return lista.length;
  };

  const usar = async (p: backend.PlantillaPublica) => {
    const mio = useProfileStore.getState().mine();
    if (!mio) {
      toast('Crea tu perfil primero');
      navigate('/dashboard');
      return;
    }
    useProfileStore.getState().save(aplicarPlantilla(mio, p.ajustes));
    void backend.usarPlantilla(p.id);
    setUsadas(local.apuntarUsada(p.id));
    setLista((l) => l?.map((x) => (x.id === p.id ? { ...x, usos: x.usos + 1 } : x)) ?? l);
    toast(`Plantilla «${p.nombre}» aplicada`);
    navigate('/dashboard');
  };

  const publicar = async (e: React.FormEvent) => {
    e.preventDefault();
    const mio = useProfileStore.getState().mine();
    if (!mio) {
      toast('Crea tu perfil primero');
      navigate('/dashboard');
      return;
    }
    setPublicando(true);
    try {
      await backend.publicarPlantilla(nombre, mio);
      setNombre('');
      setAbierto(false);
      toast('Publicada. Ya puede usarla cualquiera.');
      await cargar();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo publicar', true);
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
      toast(err instanceof Error ? err.message : 'No se pudo borrar', true);
    }
  };

  /* Cada pestaña vacia dice POR QUE lo esta. El mismo «no hay nada» en
     las cuatro no le sirve a nadie: no es lo mismo que la biblioteca
     este vacia que que tu no hayas guardado ninguna. */
  const hueco = useMemo(() => {
    if (busca.trim()) {
      return { t: 'Nada con ese nombre', d: 'Prueba con otra palabra, o mira la biblioteca entera.' };
    }
    if (pestana === 'favs') {
      return { t: 'No has guardado ninguna', d: 'Pulsa la estrella de una plantilla para tenerla a mano.' };
    }
    if (pestana === 'usadas') {
      return { t: 'Todavía no has usado ninguna', d: 'Las que apliques aparecerán aquí, la última primero.' };
    }
    if (pestana === 'mias') {
      return {
        t: 'No has publicado ninguna',
        d: 'Diseña tu perfil y publícalo para que otros puedan usarlo.',
        cta: 'Diseñar mi perfil',
      };
    }
    return {
      t: 'Aún no hay plantillas publicadas',
      d: 'Crea la tuya: diseña tu perfil y publícalo aquí para que otros lo usen.',
      cta: 'Diseñar mi perfil',
    };
  }, [busca, pestana]);

  return (
    <div className="wrap tplpage">
      <header className="tpl__top">
        <div>
          <h1 className="t-h1">Plantillas</h1>
          <p className="tpl__sub">
            El aspecto de perfiles reales, publicado por quien lo hizo. Se copia
            el diseño —colores, tipografía, colocación—, nunca su contenido.
          </p>
        </div>
        {hasBackend() && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setAbierto((v) => !v)}
          >
            {abierto ? 'Cancelar' : 'Publicar la mía'}
          </button>
        )}
      </header>

      {/* Las pestañas van solas en su fila. Publicar vive arriba, junto al
          titulo: es lo que se APORTA a esta pagina, no una forma mas de
          mirarla, y mezclarlo con los filtros lo convertia en un filtro
          mas a ojos de cualquiera. */}
      <div className="tpl__nav">
        <div className="tpl__tabs" role="tablist" aria-label="Filtrar plantillas">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              className={`tpl__tab${pestana === p.id ? ' on' : ''}`}
              onClick={() => setPestana(p.id)}
            >
              {p.label}
              <span className="tpl__tab-n">{cuenta(p.id)}</span>
            </button>
          ))}
        </div>

      </div>

      {abierto && (
        <form className="tpl__pub" onSubmit={publicar}>
          <input
            className="inp"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ponle un nombre a tu plantilla"
            maxLength={40}
            autoFocus
            aria-label="Nombre de tu plantilla"
          />
          <button className="btn btn--primary" disabled={publicando || nombre.trim().length < 2}>
            {publicando ? 'Publicando…' : 'Publicar'}
          </button>
        </form>
      )}

      <div className="tpl__bar">
        <label className="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nombre o por quien la hizo"
            aria-label="Buscar plantillas"
          />
        </label>

        <label className="tpl__orden">
          <span className="tpl__orden-l">Ordenar</span>
          <select
            className="sel"
            value={orden}
            onChange={(e) => setOrden(e.target.value as Orden)}
            disabled={pestana === 'usadas'}
            aria-label="Ordenar plantillas"
          >
            {ORDENES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="tpl__err" role="alert">
          {error}
        </p>
      )}
      {lista === null && <p className="tpl__cargando">Cargando…</p>}

      {lista !== null && !error && visibles.length === 0 && (
        <div className="tpl__vacio">
          <p className="tpl__vacio-t">{hueco.t}</p>
          <p>{hueco.d}</p>
          {'cta' in hueco && hueco.cta && (
            <button className="btn btn--primary" onClick={() => navigate('/dashboard')}>
              {hueco.cta}
            </button>
          )}
        </div>
      )}

      {visibles.length > 0 && (
        <div className="tplgrid">
          {visibles.map((p) => {
            const esFav = favs.includes(p.id);
            return (
              <article className="tpl" key={p.id}>
                <div className="tpl__pre">
                  <PreviaPlantilla
                    t={p.ajustes}
                    nombre={p.autorNombre}
                    usuario={p.autor}
                    avatar={p.autorAvatar}
                    perfil={p.autorPerfil}
                  />
                  <button
                    type="button"
                    className={`tpl__fav${esFav ? ' on' : ''}`}
                    onClick={() => setFavs(local.alternarFavorita(p.id))}
                    aria-pressed={esFav}
                    title={esFav ? 'Quitar de favoritas' : 'Guardar en favoritas'}
                    aria-label={
                      esFav
                        ? `Quitar «${p.nombre}» de favoritas`
                        : `Guardar «${p.nombre}» en favoritas`
                    }
                  >
                    <svg viewBox="0 0 24 24" strokeWidth="1.7" aria-hidden="true">
                      <path d="m12 3.7 2.55 5.16 5.7.83-4.13 4.02.98 5.67L12 16.7l-5.1 2.68.98-5.67L3.75 9.7l5.7-.83Z" />
                    </svg>
                  </button>
                </div>

                <div className="tpl__b">
                  <h2 className="tpl__n" title={p.nombre}>
                    {p.nombre}
                  </h2>

                  {p.autor ? (
                    <Link className="tpl__a tpl__a--link" to={`/u/${p.autor}`}>
                      {p.autorAvatar ? (
                        <img src={safeMedia(p.autorAvatar)} alt="" loading="lazy" />
                      ) : (
                        <span className="tpl__ini" aria-hidden="true">
                          {p.autor.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span>@{p.autor}</span>
                    </Link>
                  ) : (
                    <span className="tpl__a">sin autor</span>
                  )}

                  <p className="tpl__meta">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                      <path d="M2 12s3.6-6.4 10-6.4S22 12 22 12s-3.6 6.4-10 6.4S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                    {p.usos === 0 ? 'sin usar' : `${num(p.usos)} ${p.usos === 1 ? 'uso' : 'usos'}`}
                  </p>

                  {/* Dentro del cuerpo, no debajo: `.tpl__b` es quien pone
                      el relleno de la tarjeta, y fuera de el los botones
                      salian pegados al borde. */}
                  <div className="tpl__acts">
                  <button className="btn btn--primary btn--sm" onClick={() => void usar(p)}>
                    Usar plantilla
                  </button>
                  {/* Ver antes de aplicar. La miniatura enseña que hizo su
                      autor; esto responde la otra pregunta, que es la que
                      importa antes de pulsar: como queda A MI. */}
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm tpl__ver"
                    onClick={() => navigate(`/probar/${p.id}`)}
                    title={`Ver «${p.nombre}» con tu información`}
                    aria-label={`Ver «${p.nombre}» con tu información`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                      <path d="M2 12s3.6-6.4 10-6.4S22 12 22 12s-3.6 6.4-10 6.4S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  </button>
                  {p.mia && (
                    <button
                      type="button"
                      className="btn btn--quiet btn--sm"
                      onClick={() => void borrar(p)}
                    >
                      Retirar
                    </button>
                  )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

    </div>
  );
}
