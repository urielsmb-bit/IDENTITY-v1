import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

/** Lo que nos interesa de lo que devuelve Lanyard. */
export interface PresenciaDiscord {
  id: string;
  usuario: string;
  /** Nombre para mostrar, si lo tiene puesto */
  mostrar: string;
  avatar: string;
  /** Marco de avatar de Nitro, si lo lleva */
  decoracion: string;
  /** online | idle | dnd | offline */
  estado: string;
  /** «En línea», «Ausente»… El estado, escrito. Siempre tiene algo. */
  estadoNombre: string;
  /**
   * «Jugando a…», «Escuchando…», o el estado personalizado. Vacío si no hay
   * NADA que contar.
   *
   * Antes, sin actividad, aquí caía el nombre del estado. Eso hacía que el
   * estado y la actividad fueran la misma línea y se taparan: jugando
   * perdías el «En línea», y sin jugar el widget decía «No molestar» donde
   * debería decir a qué estás jugando. Ahora son dos cosas distintas y se
   * pintan las dos.
   */
  actividad: string;
  detalle: string;
  /**
   * La etiqueta de servidor de Discord: ese «LPR» de dos a cuatro letras que
   * la gente lleva al lado del nombre. Lanyard ya la mandaba en
   * `primary_guild` y no la miraba nadie.
   */
  guild: { tag: string; icono: string } | null;
  /**
   * Lo que suena en Spotify, con caratula.
   *
   * Viene aparte de `activities` y con mas cosas: Lanyard da el titulo, el
   * artista y la imagen del disco. Por la lista de actividades solo se sacaba
   * «Escuchando Spotify», que es la mitad de la frase.
   */
  cancion: { titulo: string; artista: string; portada: string } | null;
}

/** Los colores son los de Discord: reconocerlos es el punto. */
export const COLOR_ESTADO: Record<string, string> = {
  online: '#3BA55D',
  idle: '#FAA81A',
  dnd: '#ED4245',
  offline: '#747F8D',
};

const NOMBRE_ESTADO: Record<string, string> = {
  online: 'En línea',
  idle: 'Ausente',
  dnd: 'No molestar',
  offline: 'Desconectado',
};

/** Los tipos de actividad de Discord, con el verbo que usa cada uno. */
const VERBO: Record<number, string> = {
  0: 'Jugando a',
  1: 'Emitiendo',
  2: 'Escuchando',
  3: 'Viendo',
  5: 'Compitiendo en',
};

function leer(d: Record<string, any>): PresenciaDiscord | null {
  const u = d?.discord_user;
  if (!u?.id) return null;

  // La actividad 4 es el estado personalizado, que no lleva verbo.
  const acts: any[] = Array.isArray(d.activities) ? d.activities : [];
  const principal = acts.find((a) => a && a.type !== 4);
  const personalizado = acts.find((a) => a && a.type === 4);

  const estado = String(d.discord_status || 'offline');
  let actividad = '';
  let detalle = '';
  if (principal) {
    actividad = `${VERBO[principal.type] ?? 'En'} ${principal.name}`;
    detalle = [principal.details, principal.state].filter(Boolean).join(' · ');
  } else if (personalizado?.state) {
    actividad = String(personalizado.state);
  }

  const dec = u.avatar_decoration_data?.asset;

  const pg = u.primary_guild;
  const guild =
    pg?.tag && pg?.identity_enabled !== false
      ? {
          tag: String(pg.tag).slice(0, 8),
          icono: pg.badge
            ? `https://cdn.discordapp.com/clan-badges/${pg.identity_guild_id}/${pg.badge}.png?size=32`
            : '',
        }
      : null;

  const sp = d.listening_to_spotify ? d.spotify : null;
  const cancion = sp?.song
    ? {
        titulo: String(sp.song).slice(0, 80),
        artista: String(sp.artist || '').slice(0, 80),
        portada: /^https:\/\/i\.scdn\.co\//.test(String(sp.album_art_url || ''))
          ? String(sp.album_art_url)
          : '',
      }
    : null;

  return {
    id: String(u.id),
    usuario: String(u.username || ''),
    mostrar: String(u.display_name || u.global_name || u.username || ''),
    avatar: u.avatar
      ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
      : '',
    // `passthrough=true` conserva la animación de los marcos animados.
    decoracion: dec
      ? `https://cdn.discordapp.com/avatar-decoration-presets/${dec}.png?size=160&passthrough=true`
      : '',
    estado,
    estadoNombre: NOMBRE_ESTADO[estado] ?? '',
    actividad,
    detalle: detalle.slice(0, 80),
    guild,
    cancion,
  };
}

/**
 * Presencia de Discord en vivo, por Lanyard.
 *
 * Lanyard es un servicio público que expone la presencia de quien esté en su
 * servidor de Discord, sin clave y sin bot propio. Se usa su WebSocket y no
 * su API REST porque «sincronizado» quiere decir que cambie EN EL MOMENTO en
 * que la persona empieza a jugar o se desconecta; sondeando cada equis
 * segundos siempre se enseña algo viejo.
 *
 * Si el id no está en Lanyard, la respuesta lo dice y aquí se traduce a un
 * aviso concreto, no a un widget vacío.
 */
export function useDiscord(id: string | undefined, activo = true) {
  const [presencia, setPresencia] = useState<PresenciaDiscord | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    setPresencia(null);
    setError('');
    if (!activo || !id || !/^\d{17,20}$/.test(id)) return;

    let vivo = true;
    let latido: number | undefined;
    let reintento: number | undefined;
    let resuscribir: number | undefined;
    let intentos = 0;

    const conectar = () => {
      if (!vivo) return;
      setCargando(true);
      let ws: WebSocket;
      try {
        ws = new WebSocket('wss://api.lanyard.rest/socket');
      } catch {
        setError('sin-conexion');
        setCargando(false);
        return;
      }
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        let m: any;
        try {
          m = JSON.parse(ev.data as string);
        } catch {
          return;
        }

        // op 1 = hola: dice cada cuánto hay que latir y es cuando se pide
        // el id que nos interesa.
        if (m.op === 1) {
          const cada = Number(m.d?.heartbeat_interval) || 30000;
          latido = window.setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: 3 }));
          }, cada);
          ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: id } }));
          return;
        }

        // op 0 = un evento: el estado inicial y cada cambio posterior.
        if (m.op === 0 && (m.t === 'INIT_STATE' || m.t === 'PRESENCE_UPDATE')) {
          const datos = m.t === 'INIT_STATE' ? m.d?.[id] ?? m.d : m.d;
          const p = leer(datos ?? {});
          setCargando(false);
          if (p) {
            setPresencia(p);
            setError('');
            intentos = 0;
          } else {
            // Codigo, no frase: asi el editor puede ofrecer el enlace y el
            // perfil publico puede callarse, que son dos necesidades
            // distintas para el mismo hecho.
            setError('sin-lanyard');

            /* Y se vuelve a preguntar cada pocos segundos.
               Lanyard no avisa de que alguien acaba de entrar en su
               servidor: la suscripcion que fallo se queda fallada para
               siempre. Sin esto, quien va a Discord, entra y vuelve seguia
               viendo el mismo aviso hasta recargar a mano — que es
               exactamente el paso manual que sobra. Preguntando en bucle, el
               widget se enciende solo en cuanto entra. */
            if (!resuscribir) {
              resuscribir = window.setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: id } }));
                }
              }, 6000);
            }
          }
          // En cuanto responde con datos, se deja de insistir.
          if (p && resuscribir) {
            window.clearInterval(resuscribir);
            resuscribir = undefined;
          }
        }
      };

      ws.onclose = () => {
        if (latido) window.clearInterval(latido);
        if (resuscribir) { window.clearInterval(resuscribir); resuscribir = undefined; }
        if (!vivo) return;
        // Espera creciente, con tope: si Lanyard está caído no tiene sentido
        // martillearlo desde el navegador de cada visitante.
        intentos += 1;
        if (intentos > 5) {
          setCargando(false);
          setError('sin-conexion');
          return;
        }
        reintento = window.setTimeout(conectar, Math.min(30000, 1000 * 2 ** intentos));
      };

      ws.onerror = () => ws.close();
    };

    conectar();

    return () => {
      vivo = false;
      if (latido) window.clearInterval(latido);
      if (resuscribir) window.clearInterval(resuscribir);
      if (reintento) window.clearTimeout(reintento);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [id, activo]);

  return { presencia, error, cargando };
}

/** Lo que la propia cuenta enlazada dice de sí misma. Sin Lanyard de por medio. */
export interface CuentaDiscord {
  id: string;
  /** La etiqueta: el @usuario de Discord. */
  usuario: string;
  /** El nombre que se ha puesto para que se le vea, si tiene uno. */
  mostrar: string;
  avatar: string;
}

const CUENTA_VACIA: CuentaDiscord = { id: '', usuario: '', mostrar: '', avatar: '' };

const cad = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * La cuenta de Discord de quien tiene la sesión abierta, sacada de su login.
 *
 * Esto es lo que hace que Lanyard deje de ser obligatorio. Al entrar con
 * Discord, Supabase ya guarda quién eres —etiqueta, nombre y avatar— en la
 * identidad de la sesión. Con eso el widget se puede pintar entero; Lanyard
 * solo hace falta para lo que cambia en vivo, que es el estado y lo que
 * estés haciendo.
 *
 * Los nombres de los campos no son uno solo a propósito: `provider_id` es
 * como los llama Supabase y `sub` es el estándar de OpenID, y según la
 * versión llega uno u otro.
 */
export function useCuentaDiscordDeLaSesion(): CuentaDiscord {
  const ident = useAuthStore((s) =>
    s.user?.identities?.find((i) => i.provider === 'discord'),
  );
  return useMemo(() => {
    const d = ident?.identity_data as Record<string, unknown> | undefined;
    if (!d && !ident) return CUENTA_VACIA;

    const bruto = cad(d?.provider_id) || cad(d?.sub) || cad(ident?.id);
    const id = /^\d{17,20}$/.test(bruto) ? bruto : '';
    if (!id) return CUENTA_VACIA;

    const claims = (d?.custom_claims ?? {}) as Record<string, unknown>;
    const usuario = cad(d?.user_name) || cad(d?.preferred_username) || cad(d?.name);
    const mostrar = cad(claims.global_name) || cad(d?.full_name) || cad(d?.name);
    const avatar = cad(d?.avatar_url) || cad(d?.picture);

    return {
      id,
      usuario: usuario.slice(0, 32),
      mostrar: mostrar.slice(0, 32),
      // Solo del CDN de Discord: es de donde puede venir, y asi este campo
      // no se convierte en una via para cargar lo que sea desde un perfil.
      avatar: /^https:\/\/cdn\.discordapp\.com\//.test(avatar) ? avatar : '',
    };
  }, [ident]);
}

/** Atajo para quien solo necesita el id. */
export function useIdDiscordDeLaSesion(): string {
  return useCuentaDiscordDeLaSesion().id;
}
