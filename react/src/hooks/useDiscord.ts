import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

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
  cancion: {
    titulo: string;
    artista: string;
    portada: string;
    /** Id de la pista en Spotify. Con el se puede REPRODUCIR, no solo
     *  contar que suena: de aqui sale el reproductor del perfil cuando su
     *  dueño no ha puesto musica propia. */
    id: string;
  } | null;
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
/**
 * El estado de Discord de alguien, leido de NUESTRA tabla.
 *
 * Antes esto era un websocket a Lanyard. Lanyard es un bot en un servidor
 * publico, y por eso el estado en vivo solo se veia de quien ademas
 * hubiera entrado ahi: un paso manual en mitad de «conecta tu Discord»,
 * que no da casi nadie.
 *
 * Ahora la presencia la recoge nuestro propio bot —la funcion de borde
 * `discord-presencia` toma la foto de la pasarela cada minuto— y aqui
 * solo se lee la fila. Los datos siguen siendo de Discord y de nadie mas;
 * lo que cambia es de quien es el bot que los recibe.
 *
 * Se pregunta cada minuto porque cada minuto es lo que tarda en
 * refrescarse la foto: preguntar mas a menudo solo repetiria la lectura.
 */
const RANCIA_MS = 5 * 60 * 1000;

export function useDiscord(id: string | undefined, activo = true) {
  const [presencia, setPresencia] = useState<PresenciaDiscord | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    setPresencia(null);
    setError('');
    if (!activo || !id || !/^\d{17,20}$/.test(id)) return;
    /* Sin backend no hay tabla que leer. No es un fallo: es el modo local. */
    if (!supabase) return;

    let vivo = true;
    const cliente = supabase;

    const traer = async () => {
      setCargando(true);
      const { data, error: fallo } = await cliente
        .from('presencia')
        /* Todas las columnas, sin nombrarlas.
        
           Nombrarlas ata esta lectura a que una migracion concreta ya se
           haya aplicado: se pidio `cancion_id` en cuanto la funcion
           empezo a escribirla, y como la columna todavia no existia
           PostgREST tumbaba la consulta ENTERA —«42703: column
           presencia.cancion_id does not exist»— y el perfil se quedaba sin
           estado, sin cancion y sin punto. No sin lo nuevo: sin nada.
        
           A la escritura ya se le habia puesto ese cuidado y a la lectura
           se me olvido. Con `*` no hay nada que desincronizar: llega lo
           que haya, y los campos que falten se leen como vacios. */
        .select('*')
        .eq('discord_id', id)
        .maybeSingle();

      if (!vivo) return;
      setCargando(false);

      if (fallo) {
        setPresencia(null);
        setError('sin-conexion');
        return;
      }

      /* Sin fila: esta persona no esta en nuestro servidor todavia, o el
         bot aun no ha tomado su primera foto. */
      if (!data) {
        setPresencia(null);
        setError('sin-presencia');
        return;
      }

      /* Una foto vieja no es un estado: si la funcion deja de correr, el
         perfil no puede seguir diciendo «en linea» de hace tres dias. Se
         calla, que es lo unico honesto cuando no se sabe. */
      const edad = Date.now() - new Date(data.actualizado as string).getTime();
      if (!Number.isFinite(edad) || edad > RANCIA_MS) {
        setPresencia(null);
        setError('sin-presencia');
        return;
      }

      const estado = String(data.estado ?? 'offline');
      setPresencia({
        id,
        /* La identidad NO sale de aqui: sale del perfil, que la copio al
           enlazar la cuenta. Esta tabla solo sabe de estados. */
        usuario: '',
        mostrar: '',
        avatar: '',
        decoracion: '',
        estado,
        estadoNombre: NOMBRE_ESTADO[estado] ?? NOMBRE_ESTADO.offline!,
        actividad: String(data.actividad ?? ''),
        detalle: String(data.detalle ?? ''),
        guild: null,
        cancion: data.cancion_titulo
          ? {
              titulo: String(data.cancion_titulo),
              artista: String(data.cancion_artista ?? ''),
              portada: String(data.cancion_portada ?? ''),
              id: String(data.cancion_id ?? ''),
            }
          : null,
      });
      setError('');
    };

    void traer();
    const reloj = window.setInterval(traer, 60_000);
    return () => {
      vivo = false;
      window.clearInterval(reloj);
    };
  }, [id, activo]);

  return { presencia, cargando, error };
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

/**
 * El marco del avatar, traido de Discord y no de Lanyard.
 *
 * La decoracion de Nitro SI se puede saber sin Lanyard: viene en el propio
 * usuario, y el inicio de sesion con Discord nos deja un token con el que
 * preguntarselo. Lo que no se puede saber es el estado y la actividad —eso
 * Discord solo lo entrega por la pasarela y a un bot que comparta servidor
 * contigo, que es literalmente lo que es Lanyard—.
 *
 * El token solo existe en la vuelta del propio inicio de sesion: no se
 * guarda ni se refresca. Por eso esto se pregunta UNA vez, justo cuando se
 * conecta la cuenta, y lo que se queda en el perfil es la direccion de la
 * imagen. Quien enlazo Discord antes de que esto existiera tiene que volver
 * a conectarlo para que se la traiga.
 *
 * Si no hay token, si Discord no contesta o si la cuenta no lleva marco, no
 * pasa nada: se queda sin marco, que es como estaba.
 */
export function useDecoracionDeLaSesion(): string {
  const token = useAuthStore((s) => s.session?.provider_token ?? '');
  const hayDiscord = useAuthStore((s) =>
    !!s.user?.identities?.some((i) => i.provider === 'discord'),
  );
  const [deco, setDeco] = useState('');

  useEffect(() => {
    if (!token || !hayDiscord) return;
    let vivo = true;

    (async () => {
      try {
        const r = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const j = (await r.json()) as { avatar_decoration_data?: { asset?: unknown } };
        const asset = j?.avatar_decoration_data?.asset;
        /* El identificador se comprueba antes de meterlo en una direccion:
           llega de fuera, y una barra o dos puntos ahi dentro apuntarian la
           imagen a otro sitio. */
        if (vivo && typeof asset === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(asset)) {
          setDeco(
            `https://cdn.discordapp.com/avatar-decoration-presets/${asset}.png?size=160&passthrough=true`,
          );
        }
      } catch {
        /* Sin marco, igual que antes. No es un fallo que contarle a nadie. */
      }
    })();

    return () => {
      vivo = false;
    };
  }, [token, hayDiscord]);

  return deco;
}

/**
 * Meterse en el servidor donde el bot puede ver tu estado.
 *
 * Es la pieza que quita el paso manual. Discord solo reparte la presencia
 * a un bot que comparta servidor contigo, y hasta ahora eso significaba
 * pedirte que entraras al de Lanyard por tu cuenta — un desvio a mitad de
 * «conecta tu Discord» que casi nadie hace. Ahora te mete el nuestro, con
 * el permiso `guilds.join` que acabas de dar en la pantalla de Discord.
 *
 * El token del bot no aparece por aqui: la llamada va a una funcion de
 * borde, que es la unica que lo tiene. Desde el navegador solo viaja TU
 * token, y ni siquiera decimos quien eres — eso se lo pregunta la funcion
 * a Discord, para que nadie pueda meter a otra persona escribiendo su id.
 *
 * Una vez por token: el token cambia en cada enlace, asi que esto corre
 * al conectar la cuenta y no en cada pintada.
 */
export function useEntrarEnElServidor(): void {
  const token = useAuthStore((s) => s.session?.provider_token ?? '');
  const hayDiscord = useAuthStore((s) =>
    !!s.user?.identities?.some((i) => i.provider === 'discord'),
  );
  const hecho = useRef('');

  useEffect(() => {
    if (!token || !hayDiscord || !supabase) return;
    if (hecho.current === token) return;
    hecho.current = token;

    /* Sin `await` y sin contarle nada a nadie: si falla, lo unico que pasa
       es que no habra estado en vivo, que es como estaba antes. No es un
       error que merezca interrumpir a quien acaba de conectar su cuenta. */
    void supabase.functions
      .invoke('discord-entrar', { body: { access_token: token } })
      .then(
        () => {},
        () => {},
      );
  }, [token, hayDiscord]);
}

/** Atajo para quien solo necesita el id. */
export function useIdDiscordDeLaSesion(): string {
  return useCuentaDiscordDeLaSesion().id;
}
