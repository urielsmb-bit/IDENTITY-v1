import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ProfileView } from '@/components/profile/ProfileView';
import { useProfileStore } from '@/stores/profileStore';
import { useToast } from '@/hooks/useToast';
import { hasBackend } from '@/lib/supabase';
import * as backend from '@/lib/backend';
import * as local from '@/lib/plantillasLocales';
import { aplicarPlantilla } from '@/lib/plantilla';
import { safeMedia } from '@/lib/utils';

/**
 * Probar una plantilla a pantalla completa.
 *
 * Antes esto era una ventanita con el perfil encogido dentro. Servia para
 * hacerse una idea y para poco mas: un perfil metido en una caja de 400px
 * no se parece a un perfil, se parece a una foto de un perfil.
 *
 * Aqui se pinta la pagina ENTERA, con el mismo componente y sin modo
 * previa, o sea que el fondo cubre, las particulas se mueven y la tarjeta
 * mide lo que va a medir. La unica diferencia con tenerla puesta de
 * verdad es la barra de arriba —y que no se ha guardado nada—.
 *
 * Se prueba sobre el perfil de QUIEN MIRA. La miniatura de la lista ya
 * enseña el de su autor, que responde «que hizo esta persona»; esta
 * pantalla responde la otra, que es la que decide: «¿como me queda a mi?».
 * Con tu nombre, que es mas largo, tu foto y tus bloques.
 *
 * No se escribe nada: `aplicarPlantilla` devuelve un objeto nuevo y el
 * almacen no se toca hasta que se pulsa el boton.
 */
export default function ProbarPlantillaPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [plantilla, setPlantilla] = useState<backend.PlantillaPublica | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'lista' | 'nada'>('cargando');
  const mio = useProfileStore((s) => s.mine());

  const cargar = useCallback(async () => {
    if (!hasBackend() || !id) {
      setEstado('nada');
      return;
    }
    const p = await backend.obtenerPlantilla(id).catch(() => null);
    setPlantilla(p);
    setEstado(p ? 'lista' : 'nada');
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /* Mientras se prueba, la pagina es el perfil: la barra de IDENTITY
     arriba rompe la ilusion de tenerlo puesto, que es justo lo que hay
     que ver. Se quita al entrar y se repone al salir. */
  useEffect(() => {
    document.body.classList.add('probando');
    return () => document.body.classList.remove('probando');
  }, []);

  if (estado === 'cargando') {
    return <div className="wrap probar__esperando">Cargando…</div>;
  }

  /* Sobre lo tuyo si lo tienes; si no, sobre lo de su autor, y la barra
     lo dice. Enseñar algo es mejor que un hueco, pero hacerlo pasar por
     tuyo cuando no lo es, no. */
  const base = mio ?? plantilla?.autorPerfil ?? null;
  if (!plantilla || !base) {
    return (
      <div className="wrap probar__esperando">
        <p>Esta plantilla ya no está disponible.</p>
        <Link className="btn btn--primary" to="/templates">
          Ver las demás
        </Link>
      </div>
    );
  }

  const usar = () => {
    if (!mio) {
      toast('Crea tu perfil primero');
      navigate('/dashboard');
      return;
    }
    useProfileStore.getState().save(aplicarPlantilla(mio, plantilla.ajustes));
    void backend.usarPlantilla(plantilla.id);
    local.apuntarUsada(plantilla.id);
    toast(`Plantilla «${plantilla.nombre}» aplicada`);
    navigate('/dashboard');
  };

  return (
    <>
      <ProfileView profile={aplicarPlantilla(base, plantilla.ajustes)} />

      {/* Flota por encima de todo y no dentro del perfil: si viviera
          dentro heredaria su tema, y una barra que cambia de color segun
          la plantilla que estas probando deja de leerse como algo tuyo. */}
      <div className="probar" role="region" aria-label="Vista previa de plantilla">
        {plantilla.autorAvatar && (
          <img className="probar__av" src={safeMedia(plantilla.autorAvatar)} alt="" />
        )}
        <div className="probar__txt">
          <span className="probar__eti">Probando una plantilla</span>
          <strong className="probar__nom">{plantilla.nombre}</strong>
          <span className="probar__por">
            {plantilla.autor ? `de @${plantilla.autor}` : 'sin autor'}
            {!mio && ' · sobre el perfil de su autor'}
          </span>
        </div>
        <div className="probar__acc">
          <button className="btn btn--quiet btn--sm" onClick={() => navigate('/templates')}>
            Salir
          </button>
          <button className="btn btn--primary btn--sm" onClick={usar}>
            Usar plantilla
          </button>
        </div>
      </div>
    </>
  );
}
