import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { hayBackend, presenciaDe } from '@/lib/publico';

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
   * El logo de lo que esta haciendo: el icono del juego o la aplicacion.
   *
   * No lo manda Discord hecho: la presencia trae un identificador de
   * archivo y hay que armar la direccion con el id de la aplicacion. Eso
   * lo hace el bot, que es quien ve la presencia cruda; aqui llega ya
   * como una direccion.
   */
  actividadImg: string;
  /**
   * La etiqueta de servidor de Discord: ese «LPR» de dos a cuatro letras que
   * la gente lleva al lado del nombre. Lanyard ya la mandaba en
   * `primary_guild` y no la miraba nadie.
   */
  guild: { tag: string; icono: string } | null;
  /**
   * `public_flags`: las insignias de la cuenta, en un solo numero.
   *
   * Viene por el BOT y no por el enlace, que es lo que hace que salgan las
   * de cualquier perfil y no solo las del dueño — y que se refresquen
   * solas. El Nitro no puede venir por aqui: Discord solo le cuenta
   * `premium_type` a la propia cuenta, nunca a un bot.
   */
  flags: number;
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

/**
 * Lo que se espera entre reintentos, en ms.
 *
 * ──────────────────────────────────────────────────────────────────────
 * POR QUE HAY REINTENTOS
 * ──────────────────────────────────────────────────────────────────────
 *
 * Una peticion puede morir sin que nadie haya hecho nada mal. Se vio en
 * vivo: el navegador dijo «bloqueada por CORS, falta
 * Access-Control-Allow-Origin», y el servidor mandaba esa cabecera
 * perfectamente —comprobado con `curl`, con el vuelo previo, y con 130
 * peticiones seguidas desde el mismo origen, las 130 en 200—. Lo que
 * habia pasado es que la conexion se corto antes de llegar respuesta, y
 * Chrome eso lo cuenta como fallo de CORS porque no tiene cabeceras que
 * mirar. El mensaje acusa al servidor de algo que no ha hecho.
 *
 * Perder un paquete de vez en cuando es normal y no se puede arreglar
 * desde aqui. Lo que si estaba en nuestra mano es lo que venia despues:
 * al primer fallo esto se rendia y el siguiente intento era el del reloj
 * de sesenta segundos. Un corte de un instante dejaba el widget en «sin
 * conexion» durante un minuto entero, justo al abrir el perfil.
 *
 * Dos reintentos cortos tapan eso. No arreglan una caida de verdad —si
 * no hay red, los tres fallan y se dice que no hay conexion, como antes—
 * pero un tropiezo deja de costar un minuto.
 *
 * Las esperas son desiguales a proposito: la primera es casi inmediata,
 * porque la mayoria de los cortes se arreglan solos al abrir otra
 * conexion; la segunda da margen a algo que dure un poco mas.
 */
const PAUSAS_REINTENTO = [1200, 3500];

/**
 * Pide algo, y lo reintenta si el fallo puede salir distinto la proxima vez.
 *
 * Un 4xx NO se reintenta: es una respuesta, no un tropiezo. Si la tabla
 * niega la lectura, insistir tres veces da tres negativas iguales y
 * retrasa el aviso. Se reintenta lo que se cae —la red— y lo que el
 * servidor mismo marca como pasajero, que son los 5xx.
 */
export async function conReintento<T>(pedir: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await pedir();
    } catch (e) {
      const estado = (e as { estado?: number } | null)?.estado;
      if (typeof estado === 'number' && estado < 500) throw e;
      if (i >= PAUSAS_REINTENTO.length) throw e;
      await new Promise((r) => setTimeout(r, PAUSAS_REINTENTO[i]));
    }
  }
}

export function useDiscord(id: string | undefined, activo = true) {
  const [presencia, setPresencia] = useState<PresenciaDiscord | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    setPresencia(null);
    setError('');
    if (!activo || !id || !/^\d{17,20}$/.test(id)) return;
    /* Sin backend no hay tabla que leer. No es un fallo: es el modo local. */
    if (!hayBackend()) return;

    let vivo = true;

    const traer = async () => {
      /* En una pestaña que no se ve, no. Un perfil abierto de fondo
         preguntaba igual una vez por minuto, para siempre: nadie estaba
         mirando el puntito verde y cada pestaña olvidada seguia gastando
         una consulta al minuto de la cuota del proyecto. Al volver a la
         pestaña se pregunta enseguida, que es cuando importa. */
      if (typeof document !== 'undefined' && document.hidden) return;
      setCargando(true);
      let data: any = null;
      let fallo: unknown = null;
      try {
        data = await conReintento(() => presenciaDe(id));
      } catch (e) {
        fallo = e;
      }
      /* La lectura pide TODAS las columnas, y eso no cambia por mudarse:
         nombrarlas ata esta consulta a que una migracion concreta ya este
         aplicada. Se pidio `cancion_id` en cuanto la funcion empezo a
         escribirla, y como la columna todavia no existia PostgREST tumbaba la
         consulta ENTERA —«42703: column presencia.cancion_id does not
         exist»— y el perfil se quedaba sin estado, sin cancion y sin punto.
         No sin lo nuevo: sin nada. Ver `presenciaDe` en `lib/publico.ts`. */

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
        /* El marco y la etiqueta ya NO vienen del enlace de OAuth: los
           lee el bot de `/users/{id}` y los deja aqui. Asi se refrescan
           solos —cambias de etiqueta y cambia— y nadie tiene que volver a
           conectar Discord cada vez que aparece un campo nuevo.
           
           Si la fila todavia no los trae (migracion 0020 sin aplicar),
           llegan vacios y el perfil tira de los suyos guardados. */
        decoracion: String(data.deco ?? ''),
        estado,
        estadoNombre: NOMBRE_ESTADO[estado] ?? NOMBRE_ESTADO.offline!,
        actividad: String(data.actividad ?? ''),
        detalle: String(data.detalle ?? ''),
        actividadImg: String(data.actividad_img ?? ''),
        flags: Number(data.flags) || 0,
        guild: data.tag
          ? { tag: String(data.tag), icono: String(data.tag_icono ?? '') }
          : null,
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
    /* Y al volver a mirar, una lectura inmediata: mientras la pestaña
       estuvo escondida no se pregunto nada, asi que lo que hay en pantalla
       es de antes de irse. */
    const alVolver = () => {
      if (!document.hidden) void traer();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo = false;
      window.clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
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
export interface ExtrasDiscord {
  /** Marco de Nitro alrededor del avatar. */
  deco: string;
  /** La etiqueta de servidor: esas dos a cuatro letras que se llevan al
   *  lado del nombre. */
  tag: string;
  /** El escudito que la acompaña. */
  tagIcono: string;
  /**
   * Si la cuenta tiene Nitro.
   *
   * Venía en la MISMA respuesta que el marco y no se leía: `premium_type`,
   * que Discord manda a cualquiera con permiso `identify` — o sea el del
   * propio inicio de sesión que ya se estaba usando. Ni una petición más.
   *
   * 0 es sin Nitro, y del 1 al 3 son las tres formas que tiene de haberlo:
   * Classic, Nitro y Basic. Aquí no se distinguen porque en el perfil no
   * hace falta: la insignia dice «tiene Nitro», no cuál de los tres paga.
   *
   * `null` MIENTRAS NO SE SEPA, y no `false`. Los otros campos de aquí son
   * direcciones, y una vacía ya significa «todavía nada»; un booleano no
   * tiene ese hueco. Con `false` de partida, el perfil de alguien CON Nitro
   * se guardaría como «sin Nitro» en el instante entre montar esto y que
   * Discord conteste, y la insignia se le caería sola.
   */
  nitro: boolean | null;
  /** `premium_type` tal cual, o `null` si Discord no mando el campo. */
  premiumCrudo: number | null;
  /** El Nitro no lo dijo Discord: se dedujo de la decoracion de avatar. */
  nitroDeducido: boolean;
  /**
   * `public_flags` tal cual: un numero donde cada bit es una insignia.
   *
   * Se guarda el numero y no la lista de insignias a proposito. La lista se
   * deduce de el en un momento, y el dia que Discord añada un bit nuevo
   * basta con añadir una fila a la tabla: los perfiles que ya lo tuvieran
   * guardado enseñaran la insignia sin que nadie vuelva a conectar nada.
   * Guardando la lista habria que pedirsela otra vez a todo el mundo.
   *
   * `null` mientras no se sepa, por lo mismo que `nitro`.
   */
  flags: number | null;
}

export function useDecoracionDeLaSesion(): ExtrasDiscord {
  const token = useAuthStore((s) => s.session?.provider_token ?? '');
  const hayDiscord = useAuthStore((s) =>
    !!s.user?.identities?.some((i) => i.provider === 'discord'),
  );
  const [extras, setExtras] = useState<ExtrasDiscord>({ deco: '', tag: '', tagIcono: '', nitro: null, flags: null, premiumCrudo: null, nitroDeducido: false });

  useEffect(() => {
    if (!token || !hayDiscord) return;
    let vivo = true;

    (async () => {
      try {
        const r = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const j = (await r.json()) as {
          avatar_decoration_data?: { asset?: unknown };
          /* Nitro. Venia en esta misma respuesta desde el principio y no se
             leia: 0 es no tener, 1 a 3 son Classic, Nitro y Basic. */
          premium_type?: unknown;
          /* Las insignias, en un solo numero. */
          public_flags?: unknown;
          /* La etiqueta de servidor. Antes la mandaba Lanyard y al quitarlo
             se perdio, porque la presencia de la pasarela NO la trae: va
             en el usuario, no en el estado. Aqui si esta. */
          primary_guild?: {
            tag?: unknown;
            badge?: unknown;
            sharee_guild_id?: unknown;
            sharee_enabled?: unknown;
          };
        };
        if (!vivo) return;

        const salida: ExtrasDiscord = { deco: '', tag: '', tagIcono: '', nitro: null, flags: null, premiumCrudo: null, nitroDeducido: false };

        /* Se compara con numeros y no con `truthy`: Discord manda 0 para
           quien no tiene, y un 0 tambien es falso por su cuenta — pero si
           algun dia mandara la cadena '0', `!!'0'` seria verdadero. */
        /* AUSENTE Y CERO NO SON LO MISMO, y hasta ahora se trataban igual.
           Si Discord manda `premium_type: 0` es que no hay Nitro; si NO
           manda el campo, es que el token no lleva permiso para saberlo, y
           decir «no tiene Nitro» seria afirmar algo que nadie ha dicho.
           Se distingue para poder contarlo bien cuando algo no cuadra. */
        const prem = j?.premium_type;
        salida.premiumCrudo = typeof prem === 'number' ? prem : null;
        salida.nitro = typeof prem === 'number' && prem > 0;

        /**
         * Y se deja dicho en la consola QUE MANDA DISCORD, por nombres.
         *
         * Aqui se llego con tres insignias en el perfil de Discord, cero en
         * `public_flags` y sin Nitro: los tres numeros correctos y el
         * resultado vacio. Eso solo puede querer decir que lo que esa
         * cuenta lleva vive en un campo que no estamos mirando —las cosas
         * nuevas de Discord, coleccionables y demas, no tienen bit— y la
         * unica forma de saber cual es preguntarle a la respuesta.
         *
         * Solo los NOMBRES de los campos, nunca su contenido: esto es para
         * saber si algo llega, no para volcar los datos de nadie.
         */
        console.info('[discord] campos que manda:', Object.keys(j || {}).join(', '));

        const fl = j?.public_flags;
        salida.flags = typeof fl === 'number' && isFinite(fl) ? fl : 0;

        /* Cada identificador se comprueba antes de meterlo en una
           direccion: llegan de fuera, y una barra o dos puntos ahi dentro
           apuntarian la imagen a otro sitio. */
        const asset = j?.avatar_decoration_data?.asset;
        if (typeof asset === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(asset)) {
          salida.deco =
            `https://cdn.discordapp.com/avatar-decoration-presets/${asset}.png?size=160&passthrough=true`;
        }

        /**
         * NITRO DEDUCIDO DE LA DECORACION, CUANDO DISCORD NO LO DICE.
         *
         * Esto no deberia hacer falta y se pone a regañadientes. Medido
         * con la cuenta del dueño, que tiene Nitro Basic activo —la
         * insignia se le ve en Discord, «Suscriptor desde 9 jul 2026»—:
         *
         *     public_flags .... 0
         *     premium_type .... 0     <- mandado, no ausente
         *
         * O sea que Discord contesta que no hay Nitro a una cuenta que lo
         * tiene. No es que falte un permiso ni que se lea mal el campo:
         * viene el cero. No he podido averiguar por que.
         *
         * Lo que si es cierto es que esa cuenta lleva decoracion de
         * avatar, y la decoracion es cosa de Nitro. Asi que cuando Discord
         * dice cero pero hay decoracion, se da por bueno el Nitro.
         *
         * LO QUE ESTO PUEDE EQUIVOCAR, y conviene tenerlo escrito: desde
         * 2024 las decoraciones tambien se compran sueltas en la tienda,
         * sin Nitro. A quien haya hecho eso le saldra la insignia sin
         * tenerlo. Es un fallo menos malo que el de ahora —no enseñarsela
         * a quien SI paga— pero es un fallo, y si algun dia Discord
         * empieza a contestar bien, esto sobra y se quita.
         */
        if (salida.nitro === false && salida.deco) {
          salida.nitro = true;
          salida.nitroDeducido = true;
        }

        const pg = j?.primary_guild;
        if (pg?.sharee_enabled !== false && typeof pg?.tag === 'string') {
          salida.tag = pg.tag.slice(0, 8);
          const g = pg.sharee_guild_id;
          const b = pg.badge;
          if (
            typeof g === 'string' && /^\d{17,20}$/.test(g) &&
            typeof b === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(b)
          ) {
            salida.tagIcono = `https://cdn.discordapp.com/guild-tag-badges/${g}/${b}.png?size=32`;
          }
        }

        setExtras(salida);
      } catch {
        /* Sin marco, igual que antes. No es un fallo que contarle a nadie. */
      }
    })();

    return () => {
      vivo = false;
    };
  }, [token, hayDiscord]);

  return extras;
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
    if (!token || !hayDiscord || !hayBackend()) return;
    if (hecho.current === token) return;
    hecho.current = token;

    /* Sin `await` y sin contarle nada a nadie: si falla, lo unico que pasa
       es que no habra estado en vivo, que es como estaba antes. No es un
       error que merezca interrumpir a quien acaba de conectar su cuenta. */
    /* Al vuelo: esto solo lo ejecuta quien ACABA de conectar su Discord, o
       sea alguien con sesion abierta y dentro del editor. Importarlo arriba
       metia el SDK en la ruta del perfil publico, donde nunca se llama. */
    void import('@/lib/supabase').then(({ supabase }) => {
      supabase?.functions
        .invoke('discord-entrar', { body: { access_token: token } })
        .then(
          () => {},
          () => {},
        );
    });
  }, [token, hayDiscord]);
}

/** Atajo para quien solo necesita el id. */
export function useIdDiscordDeLaSesion(): string {
  return useCuentaDiscordDeLaSesion().id;
}
