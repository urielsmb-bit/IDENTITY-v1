import { useEffect, useRef, useState } from 'react';
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
  /** «Jugando a…», «Escuchando…», o vacío */
  actividad: string;
  detalle: string;
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
  } else {
    actividad = NOMBRE_ESTADO[estado] ?? '';
  }

  const dec = u.avatar_decoration_data?.asset;
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
    actividad,
    detalle: detalle.slice(0, 80),
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

/**
 * El id de Discord de quien tiene la sesión abierta, sacado de su login.
 *
 * Si entró con Discord, Supabase ya guarda su id en la identidad: pedírselo
 * a mano es pedirle un dato que la página tiene delante. Devuelve cadena
 * vacía si entró por otro medio.
 */
export function useIdDiscordDeLaSesion(): string {
  return useAuthStore((s) => {
    const ident = s.user?.identities?.find((i) => i.provider === 'discord');
    const d = ident?.identity_data as Record<string, unknown> | undefined;
    // Supabase lo pone en `provider_id`; `sub` es el nombre estándar de
    // OpenID y algunas versiones usan ese.
    const v = d?.provider_id ?? d?.sub ?? ident?.id;
    return typeof v === 'string' && /^\d{17,20}$/.test(v) ? v : '';
  });
}
