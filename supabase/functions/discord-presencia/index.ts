// ============================================================
// IDENTITY · función de borde · la foto del estado de Discord
//
// Discord no publica la presencia por su API REST: no existe el
// endpoint, ni siquiera para uno mismo con su propio token. Solo la
// manda por la PASARELA, y solo a un bot que comparta servidor contigo.
// Eso es lo que es Lanyard, y es lo que hace esto — con nuestro bot y
// nuestro servidor, para no depender de nadie.
//
// EL TRUCO PARA NO TENER UN PROCESO ENCENDIDO SIEMPRE
//
// Las presencias no hay que esperarlas: vienen enteras en el
// `GUILD_CREATE` que la pasarela manda justo después del IDENTIFY. Así
// que esto se conecta, recoge la foto y cierra, en un par de segundos.
// No hace falta mantener un websocket abierto, que es justamente lo que
// una función de borde no puede hacer.
//
//   HELLO (op 10) → IDENTIFY (op 2) → GUILD_CREATE → cerrar
//
// Comprobado contra la pasarela de verdad con un token inválido a
// propósito: el HELLO llega y el cierre es 4004 «Authentication failed»
// —no 4002 «Decode error»—, o sea que el IDENTIFY va bien formado y lo
// único que faltaba era el token.
//
// EL TOKEN DEL BOT NO SALE DE AQUÍ. Se lee del entorno y se usa en un
// único sitio: el IDENTIFY que va a `gateway.discord.gg`. No se registra,
// no se devuelve en ninguna respuesta y no viaja al navegador — que es
// exactamente el motivo de que esto sea una función de servidor y no
// código de la página.
//
// LO QUE ESCRIBE: una fila por persona, sobrescrita. Sin historial.
// Y a quien no salga en la foto se le pone «offline», que es lo que
// significa no aparecer: Discord no manda a los desconectados.
//
// Desplegar:  supabase functions deploy discord-presencia
// Secretos:   DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, CRON_SECRET
// Llamarla:   cada minuto, con dos cabeceras — `Authorization` con una
//             clave del proyecto (la pide la pasarela) y `x-cron-secret`
//             con el secreto de arriba (la pedimos nosotros).
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const PASARELA = 'wss://gateway.discord.gg/?v=10&encoding=json';

/* GUILDS (1<<0) para que llegue el GUILD_CREATE, y GUILD_PRESENCES
   (1<<8) para que venga con presencias. El segundo es un intent
   PRIVILEGIADO: hay que encenderlo a mano en el portal de Discord, y sin
   él la pasarela cierra con 4014 en vez de mandar nada. */
const INTENTS = (1 << 0) | (1 << 8);

/** Cuánto se espera a la primera foto antes de rendirse. */
const ESPERA_MS = 20_000;

/**
 * Cuánto se queda escuchando despues de la foto.
 *
 * Esto es lo que convierte un muestreo en algo casi en vivo. Conectar,
 * hacer la foto y colgar cuesta una sesion y da el estado de UN instante:
 * lo que pase en los dos minutos siguientes no se entera nadie hasta la
 * pasada siguiente.
 *
 * Quedandose escuchando, la MISMA sesion recibe cada `PRESENCE_UPDATE` en
 * el momento en que ocurre. Mismo gasto —una sesion por pasada, y Discord
 * solo da mil al dia— y los cambios entran al instante en vez de tardar
 * hasta dos minutos.
 *
 * El tope lo pone la plataforma, no nosotros: una funcion de borde vive
 * lo que dura su peticion. 110s deja margen bajo el limite y encaja con
 * un cron cada dos minutos, asi que la cobertura es casi continua.
 */
const VENTANA_MS = 110_000;

/** Los tipos de actividad de Discord, con el verbo que usa cada uno.
 *  Los mismos que ya usaba el editor, para que el texto no cambie según
 *  de dónde venga. */
const VERBOS: Record<number, string> = {
  0: 'Jugando a',
  1: 'Emitiendo',
  2: 'Escuchando',
  3: 'Viendo',
  5: 'Compitiendo en',
};

interface Actividad {
  name?: string;
  type?: number;
  details?: string;
  state?: string;
  assets?: { large_image?: string };
  /** El id de la pista en Spotify. Discord lo manda y no lo miraba nadie. */
  sync_id?: string;
}

interface Presencia {
  user?: { id?: string };
  status?: string;
  activities?: Actividad[];
}

interface Fila {
  discord_id: string;
  estado: string;
  actividad: string;
  detalle: string;
  cancion_titulo: string;
  cancion_artista: string;
  cancion_portada: string;
  cancion_id: string;
  /* Datos de la CUENTA, no del momento: los rellena `delUsuario` en la
     foto inicial. Opcionales para poder omitirlos si Discord no contesta,
     en vez de escribir vacio encima de lo que ya habia. */
  tag?: string;
  tag_icono?: string;
  deco?: string;
  actualizado: string;
}

/** La carátula que manda Spotify viene como `spotify:<id>`. */
function portadaSpotify(a: Actividad): string {
  const img = a.assets?.large_image ?? '';
  return img.startsWith('spotify:')
    ? `https://i.scdn.co/image/${img.slice('spotify:'.length)}`
    : '';
}

function aFila(p: Presencia, ahora: string): Fila | null {
  const id = p.user?.id ?? '';
  if (!/^\d{17,20}$/.test(id)) return null;

  const acts = Array.isArray(p.activities) ? p.activities : [];
  const spotify = acts.find((a) => a.type === 2 && a.name === 'Spotify');
  /* El estado personalizado (tipo 4) no lleva verbo: el texto ES el
     estado. El resto sí. */
  const custom = acts.find((a) => a.type === 4);
  const juego = acts.find((a) => a.type !== 4 && a.type !== 2);

  let actividad = '';
  let detalle = '';
  if (juego) {
    actividad = `${VERBOS[juego.type ?? 0] ?? 'En'} ${juego.name ?? ''}`.trim();
    detalle = (juego.details ?? '').slice(0, 120);
  } else if (custom) {
    actividad = (custom.state ?? '').slice(0, 120);
  }

  return {
    discord_id: id,
    estado: ['online', 'idle', 'dnd'].includes(p.status ?? '') ? p.status! : 'offline',
    actividad: actividad.slice(0, 120),
    detalle,
    cancion_titulo: (spotify?.details ?? '').slice(0, 120),
    cancion_artista: (spotify?.state ?? '').slice(0, 120),
    cancion_portada: spotify ? portadaSpotify(spotify) : '',
    /* Solo si tiene la forma de un id de Spotify. Se va a meter en una
       direccion, y lo que llega de fuera no se mete en una direccion sin
       mirarlo: una barra ahi dentro apuntaria el reproductor a otro
       sitio. Son 22 caracteres de base62; se admite algo de holgura. */
    cancion_id:
      spotify?.sync_id && /^[A-Za-z0-9]{16,32}$/.test(spotify.sync_id)
        ? spotify.sync_id
        : '',
    actualizado: ahora,
  };
}

/** Se conecta, recoge las presencias del servidor y cierra. */
interface DelUsuario {
  tag: string;
  tag_icono: string;
  deco: string;
}

/**
 * Lo que el bot puede saber de alguien SIN su token de OAuth.
 *
 * La etiqueta de servidor y el marco de Nitro no viajan en la presencia:
 * van en el usuario, no en el estado. Hasta ahora se copiaban al enlazar
 * la cuenta —lo que obliga a volver a conectar Discord cada vez que
 * aparece un campo nuevo, y ya ha pasado dos veces—. El bot puede
 * pedirlas el mismo, y ademas se refrescan solas.
 *
 * Cada identificador se comprueba antes de meterlo en una direccion: una
 * barra ahi dentro apuntaria la imagen a otro sitio.
 */
async function delUsuario(token: string, id: string): Promise<DelUsuario | null> {
  try {
    const r = await fetch(`https://discord.com/api/v10/users/${id}`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!r.ok) return null;
    const u = (await r.json()) as {
      avatar_decoration_data?: { asset?: unknown };
      primary_guild?: {
        tag?: unknown;
        badge?: unknown;
        identity_guild_id?: unknown;
        identity_enabled?: unknown;
      };
    };

    const out: DelUsuario = { tag: '', tag_icono: '', deco: '' };

    const asset = u.avatar_decoration_data?.asset;
    if (typeof asset === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(asset)) {
      out.deco =
        `https://cdn.discordapp.com/avatar-decoration-presets/${asset}.png?size=160&passthrough=true`;
    }

    const pg = u.primary_guild;
    /* Apagada no se enseña: quien la tiene puesta pero desactivada no la
       lleva, y no somos nosotros quien para ponersela. */
    if (pg?.identity_enabled !== false && typeof pg?.tag === 'string') {
      out.tag = pg.tag.slice(0, 8);
      const g = pg.identity_guild_id;
      const b = pg.badge;
      if (
        typeof g === 'string' && /^\d{17,20}$/.test(g) &&
        typeof b === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(b)
      ) {
        out.tag_icono = `https://cdn.discordapp.com/guild-tag-badges/${g}/${b}.png?size=32`;
      }
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Cuantas sesiones nuevas le quedan hoy al bot.
 *
 * Cada pasada de esto abre un IDENTIFY, y Discord los raciona por dia. Si
 * el cron va demasiado seguido se agotan y la presencia se congela hasta
 * que el contador se repone — sin ningun error visible, que es la peor
 * forma de romperse.
 *
 * NO viene en el READY, aunque lo parezca: viene de `/gateway/bot`. Y se
 * pide solo cuando se pregunta (`?limites=1`), para no gastar una
 * peticion de mas en cada minuto del año.
 */
async function sesionesQueQuedan(token: string) {
  try {
    const r = await fetch('https://discord.com/api/v10/gateway/bot', {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { session_start_limit?: Record<string, number> };
    const l = j.session_start_limit;
    if (!l) return null;
    return {
      quedan: l.remaining,
      de: l.total,
      reponen_en_h: Math.round((l.reset_after ?? 0) / 3600000),
    };
  } catch {
    return null;
  }
}

function tomarFoto(
  token: string,
  guild: string,
  /** Se llama con la foto inicial y luego con CADA cambio que llegue. */
  alLlegar: (p: Presencia[], inicial: boolean) => void | Promise<void>,
  ventanaMs: number,
): Promise<{ cambios: number; segundos: number }> {
  return new Promise((resolve, reject) => {
    const arranque = Date.now();
    const ws = new WebSocket(PASARELA);
    let acabado = false;
    let seq: number | null = null;
    let latido: number | undefined;
    let cambios = 0;
    let fotoHecha = false;
    /* En qué servidores está el bot de verdad. Se apunta para poder
       decirlo cuando la foto no llega: «no llegó a tiempo» no lleva a
       ninguna parte, y el fallo casi siempre es que el id del servidor no
       es ese o que el bot no está dentro. */
    const donde = new Set<string>();
    /* Y QUIEN es el bot, que viene en el READY. Sin esto, «no estoy en
       ningun servidor» deja una duda que no se puede resolver: si el
       token es de otra aplicacion distinta de la que invitaste, el
       sintoma es identico. Con el nombre y el id se compara en dos
       segundos contra la lista de miembros del servidor. */
    let quien = '';
    /** El id del propio bot, para no guardarse a si mismo. */
    let yo = '';

    const acabar = (fn: () => void) => {
      if (acabado) return;
      acabado = true;
      clearTimeout(reloj);
      if (latido) clearInterval(latido);
      try {
        ws.close();
      } catch {
        /* ya estaba cerrado */
      }
      fn();
    };

    let reloj = setTimeout(
      () =>
        acabar(() =>
          reject(
            new Error(
              donde.size
                ? `el bot no ve el servidor ${guild}. Está en: ${[...donde].join(', ')}`
                : `el bot ${quien || '(sin identificar)'} no está en ningún servidor`,
            ),
          ),
        ),
      ESPERA_MS,
    );

    ws.onmessage = (ev) => {
      let m: { op?: number; t?: string; d?: Record<string, unknown> };
      try {
        m = JSON.parse(String(ev.data));
      } catch {
        return;
      }

      /* La secuencia, que hay que devolverle en cada latido. */
      if (typeof m.s === 'number') seq = m.s;

      if (m.op === 10) {
        /* Ahora SI hay que latir: la ventana de escucha dura mas que el
           margen que da el HELLO (~41s), y sin latidos Discord cierra la
           sesion por su cuenta a mitad de la ventana. */
        const cada = Number((m.d as { heartbeat_interval?: number })?.heartbeat_interval) || 41250;
        latido = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: 1, d: seq }));
          }
        }, cada);

        ws.send(JSON.stringify({
          op: 2,
          d: {
            token,
            intents: INTENTS,
            properties: { os: 'linux', browser: 'identity', device: 'identity' },
          },
        }));
        return;
      }

      /* READY trae la lista de servidores del bot, y cada GUILD_CREATE
         confirma uno. Los dos sirven para saber dónde está. */
      if (m.t === 'READY') {
        const u = m.d?.user as { id?: string; username?: string } | undefined;
        if (u?.id) {
          quien = `${u.username ?? '?'} (${u.id})`;
          yo = u.id;
        }
      }
      if (m.t === 'READY' && Array.isArray(m.d?.guilds)) {
        for (const g of m.d.guilds as Array<{ id?: string }>) {
          if (g?.id) donde.add(g.id);
        }
      }
      if (m.t === 'GUILD_CREATE' && typeof m.d?.id === 'string') donde.add(m.d.id);

      if (m.t === 'GUILD_CREATE' && m.d?.id === guild && !fotoHecha) {
        fotoHecha = true;
        const p = Array.isArray(m.d.presences) ? (m.d.presences as Presencia[]) : [];
        /* Fuera el propio bot: esta siempre en linea por definicion y no
           es nadie con perfil que enseñar. */
        void alLlegar(p.filter((x) => x.user?.id !== yo), true);

        /* Y a partir de aqui NO se cuelga: se queda escuchando lo que
           cambie. El reloj deja de ser «me rindo» y pasa a ser «hasta
           aqui llega mi turno». */
        clearTimeout(reloj);
        reloj = setTimeout(
          () => acabar(() => resolve({ cambios, segundos: Math.round((Date.now() - arranque) / 1000) })),
          ventanaMs,
        );
      }

      /* Cada cambio, en el momento en que ocurre. Esto es lo que hace que
         cambiar de cancion o ponerse ausente se vea al instante en vez de
         esperar a la siguiente pasada del cron. */
      if (m.t === 'PRESENCE_UPDATE' && m.d?.guild_id === guild) {
        const p = m.d as unknown as Presencia;
        if (p.user?.id && p.user.id !== yo) {
          cambios++;
          void alLlegar([p], false);
        }
      }
    };

    ws.onerror = () => acabar(() => reject(new Error('no se pudo hablar con la pasarela')));

    ws.onclose = (e) => {
      /* 4004 = el token del bot no vale. 4014 = el intent de presencias
         sigue apagado en el portal. Los dos son de configuración y no de
         código, así que se dicen por su nombre en vez de dejar un «cerró
         y ya» que no lleva a ninguna parte. */
      const porque =
        e.code === 4004
          ? 'el token del bot no vale'
          : e.code === 4014
            ? 'falta encender el intent de presencias en el portal de Discord'
            : `la pasarela cerró (${e.code})`;
      acabar(() => reject(new Error(porque)));
    };
  });
}

Deno.serve(async (req) => {
  /* Esto no lo llama un navegador: lo llama un cron. Y la puerta es un
     secreto NUESTRO en su propia cabecera, no la clave de servicio.
     
     Dos motivos. Uno: `Authorization` ya la mira la pasarela de Supabase
     —tiene que llevar una clave válida del proyecto o la petición no
     llega hasta aquí—, así que esa cabecera no es nuestra para usarla de
     contraseña. Y dos: la clave que la pasarela acepta es la pública del
     navegador, que está en el frontend de cualquiera; con eso solo, esto
     lo dispararía quien quisiera.
     
     Se probó comparando contra `SUPABASE_SERVICE_ROLE_KEY` y no valía:
     Supabase está migrando de claves —hay cuatro en el proyecto— y lo que
     inyecta bajo ese nombre no es lo que devuelve el CLI. Un secreto
     propio no depende de esa migración. */
  const esperado = (Deno.env.get('CRON_SECRET') ?? '').trim();
  const dado = req.headers.get('x-cron-secret') ?? '';

  /* O la clave de servicio, mirando el ROL que declara.
     
     La pasarela de Supabase ya ha comprobado la firma antes de que esto
     corra —si no, la peticion no llega— asi que aqui solo hace falta
     leer de quien es: `anon` es la clave publica del navegador y no
     vale, `service_role` solo vive en el servidor y si.
     
     Esto es lo que permite que el cron no necesite un secreto aparte, y
     por tanto que la migracion que lo programa no lleve ninguno escrito
     dentro. */
  const rol = (() => {
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const trozo = jwt.split('.')[1];
    if (!trozo) return '';
    try {
      const json = atob(trozo.replace(/-/g, '+').replace(/_/g, '/'));
      return String((JSON.parse(json) as { role?: unknown }).role ?? '');
    } catch {
      return '';
    }
  })();

  if (rol !== 'service_role' && (!esperado || dado !== esperado)) {
    return new Response('no', { status: 401 });
  }

  /* `.trim()` porque estos se pegan a mano y un salto de línea al final
     no se ve, pero convierte el id en otro id. */
  const token = (Deno.env.get('DISCORD_BOT_TOKEN') ?? '').trim();
  const guild = (Deno.env.get('DISCORD_GUILD_ID') ?? '').trim();
  if (!token || !guild) {
    return Response.json({ ok: false, motivo: 'sin-bot' }, { status: 200 });
  }

  const pideLimites = new URL(req.url).searchParams.has('limites');
  /* La ventana se puede acortar para probar sin esperar dos minutos. */
  const ventana = Math.min(
    VENTANA_MS,
    Number(new URL(req.url).searchParams.get('ventana')) * 1000 || VENTANA_MS,
  );

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  let fallo = '';

  /** Escribe lo que llegue. Se llama con la foto inicial y con cada cambio. */
  const guardar = async (presencias: Presencia[], inicial: boolean) => {
    const ahora = new Date().toISOString();
    const filas = presencias.map((x) => aFila(x, ahora)).filter((f): f is Fila => f !== null);
    if (filas.length === 0 && !inicial) return;

    /* La etiqueta y el marco, preguntados al propio Discord. Solo en la
       foto inicial: son datos de la cuenta, no del momento, y no cambian
       cada vez que alguien pasa de cancion. Una peticion por persona
       presente, y son pocas.

       Si la peticion falla se deja el campo FUERA de la fila en vez de
       escribir vacio: un tropiezo de red no puede borrarle a nadie su
       etiqueta hasta la siguiente vuelta. */
    if (inicial) {
      const extras = await Promise.all(
        filas.map((f) => delUsuario(token, f.discord_id)),
      );
      extras.forEach((e, i) => {
        if (!e) return;
        Object.assign(filas[i]!, e);
      });
    }

    if (filas.length > 0) {
      let { error } = await db.from('presencia').upsert(filas, { onConflict: 'discord_id' });

      /* La columna `cancion_id` llego despues (0020). Desplegar la funcion
         y aplicar la migracion son dos actos distintos y nunca caen a la
         vez: entre uno y otro esto escribiria una columna que no existe y
         la presencia se congelaria. Si la base dice que no la conoce, se
         reintenta sin ella: el estado se sigue guardando y lo unico que
         falta es poder REPRODUCIR lo que suena. */
      if (
        error &&
        (error.code === 'PGRST204' || /cancion_id|tag|deco/.test(error.message))
      ) {
        console.warn('discord-presencia · faltan columnas de la 0020; se escribe sin ellas');
        const sinId = filas.map(
          ({ cancion_id: _a, tag: _b, tag_icono: _c, deco: _d, ...resto }) => resto,
        );
        ({ error } = await db.from('presencia').upsert(sinId, { onConflict: 'discord_id' }));
      }

      if (error) {
        console.error('discord-presencia · upsert', error.message);
        fallo = error.message;
        return;
      }
    }

    /* Y a quien NO salga en la FOTO, «offline»: la pasarela no manda a los
       desconectados, asi que no aparecer es exactamente eso.
       
       Solo con la foto inicial. Un `PRESENCE_UPDATE` habla de UNA persona;
       apagar a todas las demas cada vez que alguien cambia de cancion
       dejaria el servidor entero desconectado entre evento y evento. */
    if (!inicial) return;
    const dentro = filas.map((f) => f.discord_id);
    const apagar = db.from('presencia').update({ estado: 'offline', actualizado: ahora });
    const { error: err2 } = dentro.length
      ? await apagar.not('discord_id', 'in', `(${dentro.join(',')})`).neq('estado', 'offline')
      : await apagar.neq('estado', 'offline');
    if (err2) console.error('discord-presencia · apagar', err2.message);
  };

  let resumen: { cambios: number; segundos: number };
  try {
    resumen = await tomarFoto(token, guild, guardar, ventana);
  } catch (e) {
    /* El motivo si se registra —hace falta para saber si es el token o el
       intent— pero nunca el token. */
    console.error('discord-presencia', e instanceof Error ? e.message : e);
    return Response.json(
      { ok: false, motivo: e instanceof Error ? e.message : 'fallo' },
      { status: 200 },
    );
  }

  if (fallo) {
    return Response.json({ ok: false, motivo: 'base', detalle: fallo }, { status: 200 });
  }

  return Response.json(
    {
      ok: true,
      /* Cuantos cambios entraron EN VIVO durante la ventana, y cuanto
         duro. Es la unica forma de saber si la plataforma esta cortando
         la funcion antes de tiempo. */
      cambios: resumen.cambios,
      segundos: resumen.segundos,
      /* Solo si se pregunta. Util una vez al mes y decisivo el dia que
         la presencia se congele sin motivo aparente. */
      sesiones: pideLimites ? await sesionesQueQuedan(token) : undefined,
    },
    { status: 200 },
  );
});
