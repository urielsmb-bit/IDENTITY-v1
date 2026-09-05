import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Profile } from '@/types/profile';
import { NETS } from '@/data/nets';
import { Campo, Interruptor } from './Controles';
import { SubirMedio } from './SubirMedio';
import { Modal } from '@/components/ui/Modal';
import { useAuth, type ProveedorEnlazable } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import * as backend from '@/lib/backend';
import { hasBackend } from '@/lib/supabase';

/* ------------------------------------------------------------------ */
/*  Piezas pequeñas                                                    */
/* ------------------------------------------------------------------ */

const ICO = {
  persona:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  llave:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.2"/></svg>',
  enchufe:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13.5a4 4 0 0 0 5.7.3l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10.5a4 4 0 0 0-5.7-.3l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.5-1.5"/></svg>',
  ojo:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  aviso:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
};

/** Una tarjeta de la página. Todas iguales, para que se lean como una lista. */
function Bloque({
  icono,
  titulo,
  desc,
  peligro,
  guia,
  children,
}: {
  icono: string;
  titulo: string;
  desc: string;
  peligro?: boolean;
  /** Id de la pista de la guia que apunta aqui. */
  guia?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`acc__sec${peligro ? ' acc__sec--peligro' : ''}`}
      data-guia={guia}
    >
      <header className="acc__cab">
        <span
          className="acc__ico"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: icono }}
        />
        <div>
          <h3 className="acc__t">{titulo}</h3>
          <p className="acc__d">{desc}</p>
        </div>
      </header>
      <div className="acc__cuerpo">{children}</div>
    </section>
  );
}

type Estado = 'quieto' | 'yendo' | 'bien' | 'mal';

/**
 * El renglón de resultado de un formulario.
 *
 * Va con `role="status"`: así un lector de pantalla anuncia «guardado» sin
 * que haya que mover el foco, que es justo lo que corta el escribir seguido.
 * El error va con `role="alert"`, que sí interrumpe, porque hay que actuar.
 */
function Resultado({
  estado,
  error,
  exito,
}: {
  estado: Estado;
  error: string;
  exito: string;
}) {
  if (estado === 'quieto') return null;
  if (estado === 'mal') {
    return (
      <p className="acc__msg acc__msg--mal" role="alert">
        {error}
      </p>
    );
  }
  return (
    <p className={`acc__msg${estado === 'bien' ? ' acc__msg--bien' : ''}`} role="status">
      {estado === 'yendo' ? 'Guardando…' : exito}
    </p>
  );
}

/** Campo de contraseña con el ojo para verla. */
function Clave({
  id,
  label,
  valor,
  alCambiar,
  auto,
}: {
  id: string;
  label: string;
  valor: string;
  alCambiar: (v: string) => void;
  auto: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Campo label={label}>
      <div className="acc__clave">
        <input
          id={id}
          className="inp"
          type={visible ? 'text' : 'password'}
          value={valor}
          autoComplete={auto}
          onChange={(e) => alCambiar(e.target.value)}
        />
        <button
          type="button"
          className="acc__ojo"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
          title={visible ? 'Ocultar' : 'Mostrar'}
          dangerouslySetInnerHTML={{ __html: ICO.ojo }}
        />
      </div>
    </Campo>
  );
}

/* ------------------------------------------------------------------ */
/*  Cuentas conectadas                                                 */
/* ------------------------------------------------------------------ */

const PROVS: { id: ProveedorEnlazable; nombre: string; para: string }[] = [
  {
    id: 'discord',
    nombre: 'Discord',
    para: 'Widget en vivo, decoración de avatar y entrar sin contraseña',
  },
  { id: 'google', nombre: 'Google', para: 'Entrar de un toque, sin contraseña' },
  { id: 'spotify', nombre: 'Spotify', para: 'Entrar sin contraseña' },
  { id: 'github', nombre: 'GitHub', para: 'Entrar sin contraseña' },
];

/** Cómo se llama la cuenta del otro lado. Cada proveedor lo pone en su sitio. */
function nombreDeIdentidad(d: Record<string, unknown> | undefined): string {
  if (!d) return '';
  for (const k of ['user_name', 'preferred_username', 'name', 'full_name', 'email']) {
    const v = d[k];
    if (typeof v === 'string' && v) return v;
  }
  return '';
}

/* ------------------------------------------------------------------ */
/*  El panel                                                           */
/* ------------------------------------------------------------------ */

interface Props {
  profile: Profile;
  /** Cambio suelto, con el autoguardado del resto del editor. */
  update: (p: Partial<Profile>) => void;
  /** Guarda YA, con los cambios dados. Lanza si falla. */
  guardarAhora: (cambios: Partial<Profile>) => Promise<void>;
  /** Estado de la guia de pistas, para poder reiniciarla desde aqui. */
  guiaApagada: boolean;
  aprendidas: number;
  totalPistas: number;
  reiniciarGuia: () => void;
}

export function AjustesCuenta({
  profile,
  update,
  guardarAhora,
  guiaApagada,
  aprendidas,
  totalPistas,
  reiniciarGuia,
}: Props) {
  const navegar = useNavigate();
  const { toast } = useToast();
  const {
    user,
    signOut,
    enlazarProveedor,
    desenlazarProveedor,
    cerrarEnTodos,
    cambiarCorreo,
    resetPassword,
  } = useAuth();

  const conCuenta = hasBackend() && !!user;
  const identidades = user?.identities ?? [];
  const tieneClave = identidades.some((i) => i.provider === 'email');

  /* ---------- 1 · Información personal ---------- */

  const desdePerfil = useCallback(
    (p: Profile) => ({
      name: p.name || '',
      username: p.username || '',
      bio: p.bio || '',
      location: p.location || '',
    }),
    [],
  );

  const [b, setB] = useState(() => desdePerfil(profile));
  const [correo, setCorreo] = useState(user?.email || '');
  const [estPers, setEstPers] = useState<Estado>('quieto');
  const [errPers, setErrPers] = useState('');

  /* El borrador se vuelve a sembrar sólo cuando cambia el perfil de debajo
     —otra cuenta, o el que llega del servidor—, nunca en cada tecla: si se
     sembrara siempre, escribir aquí se pisaría a sí mismo. */
  const clave = `${profile._id ?? ''}|${profile.username}`;
  const sembrado = useRef(clave);
  useEffect(() => {
    if (sembrado.current === clave) return;
    sembrado.current = clave;
    setB(desdePerfil(profile));
  }, [clave, profile, desdePerfil]);

  useEffect(() => {
    setCorreo(user?.email || '');
  }, [user?.email]);

  /* ¿Está libre el nombre de usuario? Se pregunta al parar de escribir, no en
     cada tecla: son viajes al servidor y molestan más de lo que ayudan. */
  const [libre, setLibre] = useState<'nada' | 'mirando' | 'si' | 'no'>('nada');
  useEffect(() => {
    const u = b.username.trim();
    if (!u || u === profile.username || u.length < 3 || !hasBackend()) {
      setLibre('nada');
      return;
    }
    setLibre('mirando');
    const t = setTimeout(() => {
      backend
        .nombreDisponible(u)
        .then((ok) => setLibre(ok ? 'si' : 'no'))
        .catch(() => setLibre('nada'));
    }, 450);
    return () => clearTimeout(t);
  }, [b.username, profile.username]);

  const cambiaNombre = b.username !== profile.username;
  const cambiaCorreo = conCuenta && correo.trim() !== (user?.email || '');
  const sucio =
    b.name !== (profile.name || '') ||
    b.bio !== (profile.bio || '') ||
    b.location !== (profile.location || '') ||
    cambiaNombre ||
    cambiaCorreo;

  const guardarPersonal = async () => {
    const u = b.username.trim();
    if (u.length < 3) {
      setEstPers('mal');
      setErrPers('El nombre de usuario necesita al menos 3 letras.');
      return;
    }
    if (libre === 'no') {
      setEstPers('mal');
      setErrPers(`«${u}» ya está cogido. Prueba con otro.`);
      return;
    }
    if (cambiaCorreo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.trim())) {
      setEstPers('mal');
      setErrPers('Ese correo no tiene buena pinta.');
      return;
    }

    setEstPers('yendo');
    setErrPers('');
    try {
      if (cambiaCorreo) {
        await cambiarCorreo(correo.trim());
        toast(
          'Te mandamos un enlace al correo nuevo. Hasta que lo pulses, sigue valiendo el viejo.',
        );
      }
      await guardarAhora({
        name: b.name,
        username: u,
        bio: b.bio,
        location: b.location,
      });
      setEstPers('bien');
      setTimeout(() => setEstPers((e) => (e === 'bien' ? 'quieto' : e)), 3000);
    } catch (e) {
      setEstPers('mal');
      setErrPers(e instanceof Error ? e.message : 'No se pudo guardar.');
    }
  };

  /* ---------- 2 · Seguridad ---------- */

  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repe, setRepe] = useState('');
  const [estClave, setEstClave] = useState<Estado>('quieto');
  const [errClave, setErrClave] = useState('');
  const [pidiendoSalir, setPidiendoSalir] = useState(false);

  const guardarClave = async () => {
    if (nueva.length < 8) {
      setEstClave('mal');
      setErrClave('La contraseña nueva necesita al menos 8 caracteres.');
      return;
    }
    if (nueva !== repe) {
      setEstClave('mal');
      setErrClave('Las dos contraseñas nuevas no coinciden.');
      return;
    }
    if (nueva === actual) {
      setEstClave('mal');
      setErrClave('La nueva es la misma que la de ahora.');
      return;
    }
    setEstClave('yendo');
    setErrClave('');
    try {
      // Comprueba la actual antes de cambiar nada: sin eso, un descuido de
      // dejar la sesión abierta bastaría para quedarse con la cuenta.
      await backend.cambiarClave(nueva, actual);
      setActual('');
      setNueva('');
      setRepe('');
      setEstClave('bien');
      setTimeout(() => setEstClave((e) => (e === 'bien' ? 'quieto' : e)), 3000);
    } catch (e) {
      setEstClave('mal');
      setErrClave(e instanceof Error ? e.message : 'No se pudo cambiar.');
    }
  };

  const salirDeTodo = async () => {
    setPidiendoSalir(false);
    try {
      await cerrarEnTodos();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo cerrar la sesión', true);
      return;
    }
    // Y la limpieza de este navegador: soltar el puntero al perfil propio.
    await signOut();
    navegar('/');
  };

  /* ---------- 3 · Cuentas conectadas ---------- */

  /* Qué proveedores tiene encendidos el proyecto. Preguntarlo evita ofrecer
     un botón de Spotify que sólo llevaría a una pantalla de error. */
  const [activos, setActivos] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!hasBackend()) return;
    backend
      .proveedores()
      .then((p) => setActivos((p ?? {}) as Record<string, boolean>))
      .catch(() => setActivos({}));
  }, []);

  const [soltando, setSoltando] = useState<ProveedorEnlazable | null>(null);
  const [ocupadoProv, setOcupadoProv] = useState('');

  const conectar = async (id: ProveedorEnlazable) => {
    setOcupadoProv(id);
    try {
      await enlazarProveedor(id, '/dashboard');
    } catch (e) {
      setOcupadoProv('');
      toast(e instanceof Error ? e.message : 'No se pudo conectar', true);
    }
  };

  const soltar = async (id: ProveedorEnlazable) => {
    setSoltando(null);
    setOcupadoProv(id);
    try {
      await desenlazarProveedor(id);
      toast('Cuenta desconectada');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo desconectar', true);
    } finally {
      setOcupadoProv('');
    }
  };

  /* ---------- 5 · Zona de peligro ---------- */

  const [pidiendoBorrar, setPidiendoBorrar] = useState(false);
  const [pasoBorrar, setPasoBorrar] = useState<1 | 2>(1);
  const [escrito, setEscrito] = useState('');
  const [borrando, setBorrando] = useState(false);

  /* Lo mismo que espera la función del servidor: el nombre de usuario, o la
     palabra BORRAR si todavía no hay perfil. */
  const esperado = profile.username || 'BORRAR';
  const coincide = escrito.trim().toLowerCase() === esperado.toLowerCase();

  const abrirBorrar = () => {
    setEscrito('');
    setPasoBorrar(1);
    setPidiendoBorrar(true);
  };

  const borrarCuenta = async () => {
    setBorrando(true);
    try {
      await backend.borrarCuenta(escrito.trim());
      await signOut();
      navegar('/');
      toast('Tu cuenta se borró. Gracias por haber estado.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo borrar la cuenta', true);
      setBorrando(false);
    }
  };

  const exportar = () => {
    /* Blob y no `data:`: una URI de datos con un perfil grande se pasa del
       límite de longitud del href en algunos navegadores, y además queda
       escrita entera en el historial de descargas. */
    const blob = new Blob([JSON.stringify(profile, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `identity-${profile.username || 'perfil'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Perfil descargado en JSON');
  };

  /* ---------- pintar ---------- */

  return (
    <div className="acc">
      <div className="acc__enc">
        <h2 className="dash__h2">Configuración de la cuenta</h2>
        <p className="acc__sub">Quién eres, cómo entras y qué se ve de ti.</p>
      </div>

      {!conCuenta && (
        <p className="acc__nube" role="status">
          Sin sesión abierta, el perfil sólo vive en este navegador. Entra con
          una cuenta y podrás cambiar la contraseña, conectar servicios y
          llevarte el perfil a cualquier aparato.
        </p>
      )}

      {/* ------------------ 1 ------------------ */}
      <Bloque
        icono={ICO.persona}
        titulo="Información personal"
        desc="Lo que se ve en tu perfil y la dirección con la que entras."
      >
        <div className="acc__par">
          <Campo label="Nombre visible">
            <input
              className="inp"
              value={b.name}
              placeholder="Como quieres que te llamen"
              onChange={(e) => setB((v) => ({ ...v, name: e.target.value }))}
            />
          </Campo>

          <Campo
            label="Nombre de usuario"
            valor={
              libre === 'mirando'
                ? 'mirando…'
                : libre === 'si'
                  ? 'libre'
                  : libre === 'no'
                    ? 'cogido'
                    : undefined
            }
          >
            <div className="f-pre">
              <span>@</span>
              <input
                className="inp"
                value={b.username}
                placeholder="usuario"
                onChange={(e) =>
                  setB((v) => ({
                    ...v,
                    username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                  }))
                }
              />
            </div>
            {cambiaNombre && (
              <p className="f__d">
                Cambia la dirección de tu perfil: pasaría a ser{' '}
                <b>/u/{b.username || '…'}</b>. Los enlaces viejos dejan de
                funcionar.
              </p>
            )}
          </Campo>
        </div>

        <Campo label="Biografía">
          <textarea
            className="ta"
            rows={3}
            maxLength={300}
            value={b.bio}
            placeholder="Dos líneas sobre ti"
            onChange={(e) => setB((v) => ({ ...v, bio: e.target.value }))}
          />
        </Campo>

        <div className="acc__par">
          <Campo label="Ubicación">
            <input
              className="inp"
              value={b.location}
              placeholder="Ciudad, país"
              onChange={(e) => setB((v) => ({ ...v, location: e.target.value }))}
            />
          </Campo>

          <Campo label="Correo electrónico">
            <input
              className="inp"
              type="email"
              value={correo}
              disabled={!conCuenta}
              autoComplete="email"
              placeholder={conCuenta ? 'tu@correo.com' : 'necesitas una cuenta'}
              onChange={(e) => setCorreo(e.target.value)}
            />
            {cambiaCorreo && (
              <p className="f__d">
                Te mandaremos un enlace a la dirección nueva. Hasta que lo
                pulses, sigue valiendo la de ahora.
              </p>
            )}
          </Campo>
        </div>

        <SubirMedio
          titulo="Avatar"
          value={profile.avatarUrl || ''}
          destino="avatar"
          lado={512}
          onChange={(r) => update({ avatarUrl: r.url })}
        />

        <div className="acc__acciones">
          <button
            type="button"
            className="btn btn--primary"
            disabled={!sucio || estPers === 'yendo' || libre === 'mirando'}
            onClick={guardarPersonal}
          >
            {estPers === 'yendo' ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <Resultado estado={estPers} error={errPers} exito="Cambios guardados ✓" />
        </div>
      </Bloque>

      {/* ------------------ 2 ------------------ */}
      <Bloque
        icono={ICO.llave}
        titulo="Seguridad"
        desc="Tu contraseña y las sesiones abiertas."
      >
        {!conCuenta ? (
          <p className="f__d" style={{ marginTop: 0 }}>
            Entra con una cuenta para poder cambiar la contraseña.
          </p>
        ) : !tieneClave ? (
          <>
            <p className="f__d" style={{ marginTop: 0 }}>
              Tu cuenta no tiene contraseña: entras con{' '}
              {identidades.map((i) => i.provider).join(' o ')}. Si quieres una
              —para poder entrar aunque ese servicio falle— te mandamos un
              enlace para ponerla.
            </p>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={async () => {
                try {
                  await resetPassword(user?.email || '');
                  toast('Enlace enviado. Míralo en tu correo.');
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'No se pudo enviar', true);
                }
              }}
            >
              Enviarme un enlace para crear contraseña
            </button>
          </>
        ) : (
          <>
            <Clave
              id="acc-actual"
              label="Contraseña actual"
              valor={actual}
              alCambiar={setActual}
              auto="current-password"
            />
            <div className="acc__par">
              <Clave
                id="acc-nueva"
                label="Contraseña nueva"
                valor={nueva}
                alCambiar={setNueva}
                auto="new-password"
              />
              <Clave
                id="acc-repe"
                label="Repítela"
                valor={repe}
                alCambiar={setRepe}
                auto="new-password"
              />
            </div>
            <div className="acc__acciones">
              <button
                type="button"
                className="btn btn--primary"
                disabled={!actual || !nueva || !repe || estClave === 'yendo'}
                onClick={guardarClave}
              >
                {estClave === 'yendo' ? 'Cambiando…' : 'Cambiar contraseña'}
              </button>
              <Resultado
                estado={estClave}
                error={errClave}
                exito="Contraseña cambiada ✓"
              />
            </div>
          </>
        )}

        {conCuenta && (
          <div className="acc__fila">
            <div>
              <div className="acc__filaT">Cerrar sesión en todos los dispositivos</div>
              <p className="acc__filaD">
                Invalida todas las sesiones abiertas, aquí y en cualquier otro
                sitio. Úsalo si crees que alguien más entró.
              </p>
            </div>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => setPidiendoSalir(true)}
            >
              Cerrar todas
            </button>
          </div>
        )}
      </Bloque>

      {/* ------------------ 3 ------------------ */}
      <Bloque
        icono={ICO.enchufe}
        titulo="Cuentas conectadas"
        desc="Servicios enlazados a tu cuenta de IDENTITY."
      >
        {!conCuenta ? (
          <p className="f__d" style={{ marginTop: 0 }}>
            Entra con una cuenta para conectar servicios.
          </p>
        ) : (
          <ul className="acc__provs">
            {PROVS.filter(
              (p) => activos[p.id] || identidades.some((i) => i.provider === p.id),
            ).map((p) => {
              const ident = identidades.find((i) => i.provider === p.id);
              const puesta = !!ident;
              const quien = nombreDeIdentidad(
                ident?.identity_data as Record<string, unknown> | undefined,
              );
              // Quitar la última dejaría a la persona fuera de su propia
              // cuenta. Supabase también lo impide; aquí se explica antes.
              const ultima = puesta && identidades.length < 2;
              return (
                <li key={p.id} className={`acc__prov${puesta ? ' is-on' : ''}`}>
                  <span
                    className="acc__provI"
                    style={{ color: NETS[p.id]?.color }}
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: NETS[p.id]?.icon ?? '' }}
                  />
                  <div className="acc__provT">
                    <b>{p.nombre}</b>
                    <small>{puesta ? quien || 'Conectada' : p.para}</small>
                  </div>
                  <span className={`acc__pill${puesta ? ' is-on' : ''}`}>
                    {puesta ? 'Conectada' : 'Sin conectar'}
                  </span>
                  {puesta ? (
                    <button
                      type="button"
                      className="btn btn--sm btn--quiet"
                      disabled={ultima || ocupadoProv === p.id}
                      title={
                        ultima
                          ? 'Es tu única forma de entrar. Conecta otra o crea una contraseña antes de quitarla.'
                          : undefined
                      }
                      onClick={() => setSoltando(p.id)}
                    >
                      Desconectar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--sm btn--quiet"
                      disabled={ocupadoProv === p.id}
                      onClick={() => conectar(p.id)}
                    >
                      {ocupadoProv === p.id ? 'Abriendo…' : 'Conectar'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Bloque>

      {/* ------------------ 4 ------------------ */}
      <Bloque
        icono={ICO.ojo}
        guia="privacidad"
        titulo="Privacidad y perfil"
        desc="Dónde apareces y qué pueden hacer quienes te visitan."
      >
        <Interruptor
          label="Perfil público"
          desc="Apareces en el buscador, en el ranking y en la portada. Apagado, tu enlace sigue funcionando para quien lo tenga, pero no te encuentra nadie por su cuenta."
          on={profile.discoverable !== false}
          onChange={(v) => update({ discoverable: v })}
        />
        <Interruptor
          label="Mostrar el contador de visitas"
          desc="El número de veces que han abierto tu perfil, al final de la página."
          on={profile.showStats !== false}
          onChange={(v) => update({ showStats: v })}
        />
        <Interruptor
          label="Permitir calificaciones"
          desc="Deja que quien te visite puntúe tu diseño. Apagado, no se ve la nota."
          on={!!profile.showRate}
          onChange={(v) => update({ showRate: v })}
        />
        <Interruptor
          label="Contar los clics en tus enlaces"
          desc="Cuántas veces han pulsado cada enlace, en Analíticas. No se guarda quién pulsó: sólo un número por enlace y por día."
          on={profile.trackClick !== false}
          onChange={(v) => update({ trackClick: v })}
        />
      </Bloque>

      {/* La guia no es un ajuste de cuenta, asi que no se le da una tarjeta
          entera: es una tira fina, para que este a mano sin pesar. */}
      <div className="acc__tira">
        <div>
          <div className="acc__filaT">Guía del editor</div>
          <p className="acc__filaD">
            {guiaApagada
              ? 'Está apagada. Puedes volver a encenderla cuando quieras.'
              : `Te quedan ${Math.max(0, totalPistas - aprendidas)} pistas por ver. Salen solas, de una en una.`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--sm btn--quiet"
          onClick={() => {
            reiniciarGuia();
            toast('Guía reiniciada. Las pistas volverán a aparecer.');
          }}
        >
          {guiaApagada ? 'Encender de nuevo' : 'Empezar de cero'}
        </button>
      </div>

      {/* ------------------ 5 ------------------ */}
      <Bloque
        icono={ICO.aviso}
        titulo="Zona de peligro"
        desc="Llevarte tus datos, o irte del todo."
        peligro
      >
        <div className="acc__fila">
          <div>
            <div className="acc__filaT">Exportar el perfil en JSON</div>
            <p className="acc__filaD">
              Todo tu diseño y tu contenido en un archivo. Sirve de copia de
              seguridad y es tuyo para llevártelo.
            </p>
          </div>
          <button type="button" className="btn btn--quiet" onClick={exportar}>
            Descargar
          </button>
        </div>

        <div className="acc__fila">
          <div>
            <div className="acc__filaT">Eliminar la cuenta</div>
            <p className="acc__filaD">
              Se borra la cuenta, el perfil, las imágenes que hayas subido y las
              valoraciones que hayas recibido. No se puede deshacer.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--peligro"
            disabled={!conCuenta}
            title={
              conCuenta ? undefined : 'Sólo se pueden borrar cuentas con sesión abierta'
            }
            onClick={abrirBorrar}
          >
            Eliminar cuenta
          </button>
        </div>
      </Bloque>

      {/* ------------------ ventanas ------------------ */}

      <Modal
        abierto={pidiendoSalir}
        alCerrar={() => setPidiendoSalir(false)}
        titulo="¿Cerrar la sesión en todos los dispositivos?"
        desc="Tendrás que volver a entrar aquí y en cualquier otro sitio donde la tuvieras abierta."
        acciones={
          <button type="button" className="btn btn--primary" onClick={salirDeTodo}>
            Sí, cerrar todas
          </button>
        }
      />

      <Modal
        abierto={soltando !== null}
        alCerrar={() => setSoltando(null)}
        peligro
        titulo={`¿Desconectar ${PROVS.find((p) => p.id === soltando)?.nombre ?? ''}?`}
        desc={
          soltando === 'discord'
            ? 'Dejarás de poder entrar con Discord, y el widget en vivo y la decoración del avatar se apagarán.'
            : 'Dejarás de poder entrar con esa cuenta. Puedes volver a conectarla cuando quieras.'
        }
        acciones={
          <button
            type="button"
            className="btn btn--peligro"
            onClick={() => soltando && soltar(soltando)}
          >
            Desconectar
          </button>
        }
      />

      <Modal
        abierto={pidiendoBorrar}
        alCerrar={() => !borrando && setPidiendoBorrar(false)}
        peligro
        titulo={pasoBorrar === 1 ? 'Eliminar la cuenta' : 'Última confirmación'}
        desc={
          pasoBorrar === 1
            ? 'Esto no se deshace. Antes de seguir, escribe tu nombre de usuario.'
            : 'No hay vuelta atrás ni copia guardada. Si quieres tus datos, cancela y expórtalos primero.'
        }
        acciones={
          pasoBorrar === 1 ? (
            <button
              type="button"
              className="btn btn--peligro"
              disabled={!coincide}
              onClick={() => setPasoBorrar(2)}
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--peligro"
              disabled={borrando}
              onClick={borrarCuenta}
            >
              {borrando ? 'Borrando…' : 'Borrar mi cuenta para siempre'}
            </button>
          )
        }
      >
        {pasoBorrar === 1 ? (
          <>
            <ul className="acc__lista">
              <li>
                Tu perfil y su dirección <b>/u/{profile.username}</b>
              </li>
              <li>El avatar y las imágenes que hayas subido</li>
              <li>Las visitas y las valoraciones recibidas</li>
              <li>Tu forma de entrar: correo y cuentas conectadas</li>
            </ul>
            <label className="acc__eti" htmlFor="acc-borrar">
              Escribe <b>{esperado}</b> para confirmar
            </label>
            <input
              id="acc-borrar"
              className="inp"
              value={escrito}
              autoComplete="off"
              placeholder={esperado}
              onChange={(e) => setEscrito(e.target.value)}
            />
          </>
        ) : (
          <p className="acc__ultimo">
            Vas a borrar <b>{esperado}</b>.
          </p>
        )}
      </Modal>
    </div>
  );
}
