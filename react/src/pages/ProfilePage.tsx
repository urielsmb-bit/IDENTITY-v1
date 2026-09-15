import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { useProfileStore } from '@/stores/profileStore';
import { useAuthStore } from '@/stores/authStore';
import { ProfileView } from '@/components/profile/ProfileView';
import { Denunciar } from '@/components/profile/Denunciar';
import * as publico from '@/lib/publico';
import { useInsignias } from '@/hooks/useInsignias';

import { useTitulo } from '@/hooks/useTitulo';
import { tituloTarjeta } from '@/lib/tarjeta';

/**
 * Abrir la conexión con Vimeo ANTES de saber si hace falta.
 *
 * ────────────────────────────────────────────────────────────────────────
 * EL PROBLEMA, MEDIDO
 * ────────────────────────────────────────────────────────────────────────
 *
 * El fondo en vídeo no puede pedirse hasta que llega el perfil —la
 * dirección está dentro de sus datos— así que el marco no existe hasta los
 * 786 ms. Y justo ahí empieza lo lento: DNS, TLS y la primera petición,
 * desde cero, con la página ya montada y compitiendo con todo lo demás.
 *
 * Pero PARA ABRIR LA CONEXIÓN no hace falta saber la dirección del vídeo:
 * basta con saber el servidor, y eso se sabe desde el primer instante,
 * porque lo dice la ruta. Un perfil es el único sitio donde hay fondos en
 * vídeo.
 *
 * Así que el saludo —DNS y TLS— se adelanta unos setecientos milisegundos
 * y se solapa con la carga del perfil, en vez de ir detrás.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUÉ AQUÍ Y NO EN EL `index.html`
 * ────────────────────────────────────────────────────────────────────────
 *
 * Ahí lo pagarían TODAS las páginas: la portada, el ranking, la ayuda,
 * plantillas. Una preconexión no es gratis —abre un socket y negocia TLS
 * con un servidor al que quizá nadie va a llamar— y en las demás rutas no
 * hay ni un vídeo posible.
 *
 * Y no se comprueba si ESTE perfil tiene vídeo, porque para saberlo habría
 * que esperar al perfil, que es exactamente lo que se está intentando
 * adelantar. De nueve perfiles mirados, seis tenían fondo en vídeo: la
 * apuesta sale a cuenta.
 */
function useConexionConVimeo() {
  useEffect(() => {
    const ya = document.querySelector('link[data-vimeo-pre]');
    if (ya) return;
    const l = document.createElement('link');
    l.rel = 'preconnect';
    l.href = 'https://player.vimeo.com';
    l.crossOrigin = '';
    l.setAttribute('data-vimeo-pre', '');
    document.head.appendChild(l);
    /* No se quita al salir del perfil: una conexión abierta no estorba, y
       quitar el `<link>` no la cierra de todos modos. Lo que sí evita el
       guardia de arriba es acumular etiquetas al ir de perfil en perfil. */
  }, []);
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const cleanUsername = username?.toLowerCase().trim();
  useConexionConVimeo();
  const { profile, esperando, sinRed, error, refetch } = useProfile(cleanUsername);
  /* «Este perfil es mío» pide las dos cosas.
     `mineName` vive en el navegador y sólo lo escribe quien ha entrado de
     verdad — pero al SALIR se borra y al CADUCAR la sesión no. Sin mirar
     también la sesión, un navegador donde alguien entró hace meses seguiría
     escondiendo el botón de denunciar en ese perfil para siempre, sin que
     haya nadie dentro. */
  const mineName = useProfileStore((s) => s.mineName);
  const haySesion = useAuthStore((s) => !!s.user);
  const esMio = haySesion && !!cleanUsername && mineName === cleanUsername;
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
      : esperando
        ? null
        : `@${cleanUsername ?? ''} · sharee`,
  );

  useEffect(() => {
    if (!cleanUsername) return;
    if (publico.hayBackend()) {
      publico.contarVista(cleanUsername).catch(() => {});
    }
  }, [cleanUsername]);

  /* Se espera solo mientras se esta preguntando de verdad. Si la consulta
     quedo EN PAUSA por falta de red, esperar seria esperar a nada: eso va
     por el aviso de abajo, que al menos dice que pasa. */
  if (esperando && !sinRed) {
    return <div className="cargando" aria-busy="true" />;
  }

  /* Un fallo de red NO es un perfil que no existe.
     Antes los dos caminos acababan en el mismo 404: si Supabase se caia,
     o si a alguien se le iba la conexion, su propia pagina le decia «este
     perfil no existe» — y a quien vive de repartir ese enlace, eso le
     dice que se ha quedado sin pagina. Se distinguen porque son cosas
     distintas y porque una de las dos se arregla volviendo a probar.

     El 404 de abajo se reserva para el unico caso en que se puede afirmar:
     el servidor contesto y no hay nadie con ese nombre. */
  if (!profile && (error || sinRed)) {
    return (
      <section className="pf-404" style={{ textAlign: 'center', padding: '120px 20px' }}>
        <h1 style={{ fontSize: 'var(--t6)', marginBottom: '16px' }}>No se pudo cargar</h1>
        <p style={{ fontSize: 'var(--t4)', color: 'var(--text-muted, #888)', marginBottom: '32px' }}>
          {sinRed
            ? 'Este aparato no tiene conexión ahora mismo. En cuanto vuelva, se carga solo.'
            : 'No hemos podido preguntar por este perfil. Suele ser la conexión.'}
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
      />
      {/* No en el tuyo: denunciarte a ti mismo no lleva a ninguna parte y
          el botón sólo estorbaría en la página que más vas a mirar. */}
      {esMio ? null : <Denunciar perfilId={profile._id} username={profile.username} />}
    </>
  );
}
