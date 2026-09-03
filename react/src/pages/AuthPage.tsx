import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { CONFIG } from '@/config';

type Modo = 'login' | 'registro' | 'olvide';

/** Lo que dice cada modo. Tenerlo en una tabla evita el triple ternario
 *  repetido en el título, el subtítulo y el botón. */
const TEXTOS: Record<Modo, { t: string; d: string; enviar: string }> = {
  login: {
    t: 'Entrar a IDENTITY',
    d: 'Tu perfil te espera.',
    enviar: 'Entrar',
  },
  registro: {
    t: 'Crear una cuenta',
    d: 'Crea tu identidad en línea en segundos.',
    enviar: 'Crear cuenta',
  },
  olvide: {
    t: 'Recuperar contraseña',
    d: 'Te enviaremos un enlace a tu correo.',
    enviar: 'Enviar enlace',
  },
};

/** El modo viaja en la URL: así se puede enlazar directo al registro. */
const MODOS: Record<string, Modo> = {
  registro: 'registro',
  olvide: 'olvide',
  login: 'login',
};

/**
 * Supabase responde en inglés y con frases de API. Enseñárselas tal cual a
 * alguien que no puede entrar es dejarle sin saber qué hacer.
 */
function traducirError(e: unknown): string {
  const bruto = e instanceof Error ? e.message : String(e ?? '');
  const m = bruto.toLowerCase();
  if (m.includes('invalid login credentials')) return 'El correo o la contraseña no son correctos.';
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar. Te enviamos un enlace al registrarte.';
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Ya existe una cuenta con ese correo. Prueba a entrar.';
  if (m.includes('password should be at least')) return 'La contraseña es demasiado corta.';
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return 'Ese correo no parece válido.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';
  if (m.includes('supabase no está configurado'))
    return 'Esta copia no tiene servidor configurado: puedes editar tu perfil, pero no crear cuenta.';
  return bruto || 'No se pudo completar la operación.';
}

const ICO_DISCORD = (
  <svg viewBox="1.96 4.26 20.03 15.53" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M14.82 4.26a10.14 10.14 0 0 0-.53 1.1a14.66 14.66 0 0 0-4.58 0a10.14 10.14 0 0 0-.53-1.1a16 16 0 0 0-4.13 1.3a17.33 17.33 0 0 0-3 11.59a16.6 16.6 0 0 0 5.07 2.59A12.89 12.89 0 0 0 8.23 18a9.65 9.65 0 0 1-1.71-.83a3.39 3.39 0 0 0 .42-.33a11.66 11.66 0 0 0 10.12 0q.21.18.42.33a10.84 10.84 0 0 1-1.71.84a12.41 12.41 0 0 0 1.08 1.78a16.44 16.44 0 0 0 5.06-2.59a17.22 17.22 0 0 0-3-11.59a16.09 16.09 0 0 0-4.09-1.35zM8.68 14.81a1.94 1.94 0 0 1-1.8-2a1.93 1.93 0 0 1 1.8-2a1.93 1.93 0 0 1 1.8 2a1.93 1.93 0 0 1-1.8 2zm6.64 0a1.94 1.94 0 0 1-1.8-2a1.93 1.93 0 0 1 1.8-2a1.92 1.92 0 0 1 1.8 2a1.92 1.92 0 0 1-1.8 2z" />
  </svg>
);

/** La G de Google va en sus cuatro colores a propósito: su guía de marca
 *  no permite recolorearla, y en monocromo no se reconoce. */
const ICO_GOOGLE = (
  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

export default function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const volverA = searchParams.get('volver') || '/dashboard';
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, user, signIn, signUp, signInWithProvider, resetPassword, signOut } = useAuth();

  const [modo, setModo] = useState<Modo>(MODOS[searchParams.get('modo') ?? ''] ?? 'login');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [acepta, setAcepta] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [proveedor, setProveedor] = useState<'discord' | 'google' | null>(null);
  /** El error se queda en la página. Un toast se va solo y quien falla la
   *  contraseña se queda mirando un formulario sin explicación. */
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  // La URL manda: atrás y adelante del navegador cambian de modo.
  useEffect(() => {
    setModo(MODOS[searchParams.get('modo') ?? ''] ?? 'login');
  }, [searchParams]);

  const cambiarModo = (m: Modo) => {
    setError('');
    setAviso('');
    setClave('');
    const p = new URLSearchParams(searchParams);
    if (m === 'login') p.delete('modo');
    else p.set('modo', m);
    setSearchParams(p, { replace: true });
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAviso('');

    if (!correo.trim()) {
      setError('Escribe tu correo electrónico.');
      return;
    }
    if (modo === 'registro') {
      if (clave.length < 8) {
        setError('La contraseña necesita al menos 8 caracteres.');
        return;
      }
      if (!acepta) {
        setError('Tienes que aceptar los Términos y la Política de privacidad.');
        return;
      }
    }
    if (modo === 'login' && !clave) {
      setError('Escribe tu contraseña.');
      return;
    }

    setCargando(true);
    try {
      if (modo === 'login') {
        await signIn(correo, clave);
        toast('¡Bienvenido de nuevo!');
        navigate(volverA);
      } else if (modo === 'registro') {
        await signUp(correo, clave);
        toast('Cuenta creada. Revisa tu correo para confirmarla.');
        navigate(volverA);
      } else {
        await resetPassword(correo);
        // Se queda en la página en vez de saltar a login: si no llega el
        // correo, el aviso sigue ahí diciendo a dónde se envió.
        setAviso(`Te hemos enviado un enlace a ${correo}. Revisa también el spam.`);
      }
    } catch (err) {
      setError(traducirError(err));
    } finally {
      setCargando(false);
    }
  };

  const entrarCon = async (prov: 'discord' | 'google') => {
    setError('');
    setProveedor(prov);
    try {
      await signInWithProvider(prov, volverA);
    } catch (err) {
      setError(traducirError(err));
      setProveedor(null);
    }
  };

  // ── ya hay sesión: panel de cuenta ──────────────────────────
  if (session && user) {
    return (
      <div className="wrap page--corta">
        <div className="auth">
          <div className="auth__caja">
            <h1 className="auth__t">Tu cuenta</h1>
            <p className="auth__d">
              Sesión iniciada como <strong>{user.email}</strong>
            </p>
            <div className="auth__acts">
              <Link to="/dashboard" className="btn btn--primary btn--block">
                Ir a mi panel de edición
              </Link>
              <button
                type="button"
                className="btn btn--ghost btn--block"
                onClick={async () => {
                  await signOut();
                  toast('Sesión cerrada');
                }}
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const t = TEXTOS[modo];
  const ocupado = cargando || proveedor !== null;

  return (
    <div className="wrap page--corta">
      <div className="auth">
        <div className="auth__caja">
          <h1 className="auth__t">{t.t}</h1>
          <p className="auth__d">{t.d}</p>

          {modo !== 'olvide' && (
            <>
              <div className="auth__prov">
                <button
                  type="button"
                  className="btn btn--prov"
                  disabled={ocupado}
                  onClick={() => entrarCon('discord')}
                >
                  <span className="auth__pico">{ICO_DISCORD}</span>
                  {proveedor === 'discord' ? 'Abriendo Discord…' : 'Continuar con Discord'}
                </button>
                <button
                  type="button"
                  className="btn btn--prov"
                  disabled={ocupado}
                  onClick={() => entrarCon('google')}
                >
                  <span className="auth__pico">{ICO_GOOGLE}</span>
                  {proveedor === 'google' ? 'Abriendo Google…' : 'Continuar con Google'}
                </button>
              </div>
              <div className="auth__o">o con correo</div>
            </>
          )}

          <form className="auth__f" onSubmit={enviar} noValidate>
            <div className="auth__campo">
              <label className="auth__et" htmlFor="correo">
                Correo electrónico
              </label>
              <input
                id="correo"
                name="email"
                type="email"
                className="inp"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="tu@correo.com"
                autoComplete="email"
                autoFocus
                required
              />
            </div>

            {modo !== 'olvide' && (
              <div className="auth__campo">
                <div className="auth__et auth__et--fila">
                  <label htmlFor="clave">Contraseña</label>
                  {modo === 'login' && (
                    <button type="button" className="lnk" onClick={() => cambiarModo('olvide')}>
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <div className="auth__clave">
                  <input
                    id="clave"
                    name="password"
                    type={verClave ? 'text' : 'password'}
                    className="inp"
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    placeholder={modo === 'registro' ? 'Mínimo 8 caracteres' : 'Tu contraseña'}
                    autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
                    // El mínimo es del registro. Ponerlo también en el login
                    // dejaba fuera a quien ya tuviera una contraseña corta:
                    // el navegador bloqueaba el envío y no había forma de entrar.
                    minLength={modo === 'registro' ? 8 : undefined}
                    required
                  />
                  <button
                    type="button"
                    className="auth__ojo"
                    onClick={() => setVerClave((v) => !v)}
                    aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={verClave}
                  >
                    {verClave ? '🙈' : '👁'}
                  </button>
                </div>
                {modo === 'registro' && (
                  <p className={`auth__pista${clave.length >= 8 ? ' is-ok' : ''}`}>
                    {clave.length >= 8 ? 'Longitud correcta.' : 'Al menos 8 caracteres.'}
                  </p>
                )}
              </div>
            )}

            {modo === 'registro' && (
              <label className="auth__legal">
                <input
                  type="checkbox"
                  checked={acepta}
                  onChange={(e) => setAcepta(e.target.checked)}
                />
                <span>
                  Acepto los <Link to="/terminos" target="_blank">Términos de servicio</Link> y la{' '}
                  <Link to="/privacidad" target="_blank">Política de privacidad</Link> (v
                  {CONFIG.VERSION_LEGAL}).
                </span>
              </label>
            )}

            {error && (
              <p className="auth__aviso is-mal" role="alert">
                {error}
              </p>
            )}
            {aviso && (
              <p className="auth__aviso" role="status">
                {aviso}
              </p>
            )}

            <button
              type="submit"
              className="btn btn--primary btn--block auth__enviar"
              disabled={ocupado}
            >
              {cargando ? 'Procesando…' : t.enviar}
            </button>
          </form>

          <p className="auth__cambio">
            {modo === 'login' ? (
              <>
                ¿No tienes cuenta?{' '}
                <button type="button" className="lnk" onClick={() => cambiarModo('registro')}>
                  Crear una gratis
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{' '}
                <button type="button" className="lnk" onClick={() => cambiarModo('login')}>
                  Entrar
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
