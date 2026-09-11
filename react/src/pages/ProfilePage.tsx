import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { useProfileStore, getMyVote, setMyVote } from '@/stores/profileStore';
import { useAuthStore } from '@/stores/authStore';
import { ProfileView } from '@/components/profile/ProfileView';
import { Denunciar } from '@/components/profile/Denunciar';
import * as backend from '@/lib/backend';
import { useInsignias } from '@/hooks/useInsignias';
import { hasBackend } from '@/lib/supabase';
import { useTitulo } from '@/hooks/useTitulo';
import { tituloTarjeta } from '@/lib/tarjeta';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const cleanUsername = username?.toLowerCase().trim();
  const { profile, isLoading, error, refetch } = useProfile(cleanUsername);
  /* «Este perfil es mío» pide las dos cosas.
     `mineName` vive en el navegador y sólo lo escribe quien ha entrado de
     verdad — pero al SALIR se borra y al CADUCAR la sesión no. Sin mirar
     también la sesión, un navegador donde alguien entró hace meses seguiría
     escondiendo el botón de denunciar en ese perfil para siempre, sin que
     haya nadie dentro. */
  const mineName = useProfileStore((s) => s.mineName);
  const haySesion = useAuthStore((s) => !!s.user);
  const esMio = haySesion && !!cleanUsername && mineName === cleanUsername;
  const [vote, setVote] = useState<number | null>(null);
  /* Las insignias no vienen con el perfil: viven en otra vista y en otra
     tabla. Se piden aparte para que un fallo suyo no impida que el perfil se
     pinte — y por el MISMO gancho que usa el editor, que es lo que evita que
     un perfil diga una cosa mirandolo y otra editandolo. Aqui habia una
     copia del gancho escrita a mano que ademas no sabia el id del perfil, y
     por eso volvia a preguntarle al servidor unas cifras que ya tenia. */
  const { ganadas: insignias } = useInsignias(profile);

  /* El mismo titulo que escribe `api/perfil.ts` en el servidor para la
     tarjeta de Discord, de la misma funcion. Llegando directo ya venia
     puesto; llegando desde el top o desde Descubrir, la pestana se
     quedaba con el titulo de la pagina anterior. */
  useTitulo(
    profile
      ? tituloTarjeta({
          username: profile.username,
          name: profile.name,
          title: profile.title,
          bio: profile.bio,
        })
      : isLoading
        ? null
        : `@${cleanUsername ?? ''} · sharee`,
  );

  useEffect(() => {
    if (!cleanUsername) return;
    if (hasBackend()) {
      backend.contarVista(cleanUsername).catch(() => {});
    }
    setVote(getMyVote(cleanUsername));
  }, [cleanUsername]);

  const handleVote = async (score: number) => {
    if (!cleanUsername || !profile) return;
    setVote(score);
    setMyVote(cleanUsername, score);

    if (hasBackend() && profile._id) {
      try {
        await backend.valorar(profile._id, score);
      } catch (err) {
        /* Se deshace el voto local. Antes solo se anotaba en la consola: la
           persona veia su nota marcada y creia que habia contado. */
        setVote(null);
        setMyVote(cleanUsername, 0);
        console.error('Error al enviar valoración:', err);
      }
    }
  };

  if (isLoading) {
    return <div className="cargando" aria-busy="true" />;
  }

  /* Un fallo de red NO es un perfil que no existe.
     Antes los dos caminos acababan en el mismo 404: si Supabase se caia,
     o si a alguien se le iba la conexion, su propia pagina le decia «este
     perfil no existe» — y a quien vive de repartir ese enlace, eso le
     dice que se ha quedado sin pagina. Se distinguen porque son cosas
     distintas y porque una de las dos se arregla volviendo a probar. */
  if (!profile && error) {
    return (
      <section className="pf-404" style={{ textAlign: 'center', padding: '120px 20px' }}>
        <h1 style={{ fontSize: 'var(--t6)', marginBottom: '16px' }}>No se pudo cargar</h1>
        <p style={{ fontSize: 'var(--t4)', color: 'var(--text-muted, #888)', marginBottom: '32px' }}>
          El perfil <strong>@{cleanUsername}</strong> existe o no —eso no lo sabemos ahora
          mismo—, pero no hemos podido preguntarlo. Suele ser la conexión.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--primary" onClick={() => void refetch()}>
            Volver a probar
          </button>
          <Link to="/" className="btn btn--quiet">
            Ir al inicio
          </Link>
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="pf-404" style={{ textAlign: 'center', padding: '120px 20px' }}>
        <h1 style={{ fontSize: 'var(--tf-page)', marginBottom: '16px' }}>404</h1>
        <p style={{ fontSize: 'var(--t4)', color: 'var(--text-muted, #888)', marginBottom: '32px' }}>
          El perfil <strong>@{cleanUsername}</strong> no existe o no es público todavía.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link to="/" className="btn btn--quiet">
            Ir al inicio
          </Link>
          <Link to="/dashboard" className="btn btn--primary">
            Reclamar @{cleanUsername}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <ProfileView
        profile={profile}
        insignias={insignias}
        onVote={handleVote}
        myVote={vote}
      />
      {/* No en el tuyo: denunciarte a ti mismo no lleva a ninguna parte y
          el botón sólo estorbaría en la página que más vas a mirar. */}
      {esMio ? null : <Denunciar perfilId={profile._id} username={profile.username} />}
    </>
  );
}
