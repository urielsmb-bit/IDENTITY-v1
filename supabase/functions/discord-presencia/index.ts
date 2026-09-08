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

/** Cuánto se espera a la foto antes de rendirse. El HELLO da ~41s de
 *  margen antes del primer latido, así que aquí no hace falta latir. */
const ESPERA_MS = 20_000;

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
    actualizado: ahora,
  };
}

/** Se conecta, recoge las presencias del servidor y cierra. */
function tomarFoto(token: string, guild: string): Promise<Presencia[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(PASARELA);
    let acabado = false;
    /* En qué servidores está el bot de verdad. Se apunta para poder
       decirlo cuando la foto no llega: «no llegó a tiempo» no lleva a
       ninguna parte, y el fallo casi siempre es que el id del servidor no
       es ese o que el bot no está dentro. */
    const donde = new Set<string>();

    const acabar = (fn: () => void) => {
      if (acabado) return;
      acabado = true;
      clearTimeout(reloj);
      try {
        ws.close();
      } catch {
        /* ya estaba cerrado */
      }
      fn();
    };

    const reloj = setTimeout(
      () =>
        acabar(() =>
          reject(
            new Error(
              donde.size
                ? `el bot no ve el servidor ${guild}. Está en: ${[...donde].join(', ')}`
                : 'el bot no está en ningún servidor todavía',
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

      if (m.op === 10) {
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
      if (m.t === 'READY' && Array.isArray(m.d?.guilds)) {
        for (const g of m.d.guilds as Array<{ id?: string }>) {
          if (g?.id) donde.add(g.id);
        }
      }
      if (m.t === 'GUILD_CREATE' && typeof m.d?.id === 'string') donde.add(m.d.id);

      if (m.t === 'GUILD_CREATE' && m.d?.id === guild) {
        const p = Array.isArray(m.d.presences) ? (m.d.presences as Presencia[]) : [];
        acabar(() => resolve(p));
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
  const esperado = Deno.env.get('CRON_SECRET') ?? '';
  const dado = req.headers.get('x-cron-secret') ?? '';
  if (!esperado || dado !== esperado) {
    return new Response('no', { status: 401 });
  }

  /* `.trim()` porque estos se pegan a mano y un salto de línea al final
     no se ve, pero convierte el id en otro id. */
  const token = (Deno.env.get('DISCORD_BOT_TOKEN') ?? '').trim();
  const guild = (Deno.env.get('DISCORD_GUILD_ID') ?? '').trim();
  if (!token || !guild) {
    return Response.json({ ok: false, motivo: 'sin-bot' }, { status: 200 });
  }

  let presencias: Presencia[];
  try {
    presencias = await tomarFoto(token, guild);
  } catch (e) {
    /* El motivo sí se registra —hace falta para saber si es el token o el
       intent— pero nunca el token. */
    console.error('discord-presencia', e instanceof Error ? e.message : e);
    return Response.json(
      { ok: false, motivo: e instanceof Error ? e.message : 'fallo' },
      { status: 200 },
    );
  }

  const ahora = new Date().toISOString();
  const filas = presencias.map((p) => aFila(p, ahora)).filter((f): f is Fila => f !== null);

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    servicio,
    { auth: { persistSession: false } },
  );

  if (filas.length > 0) {
    const { error } = await db.from('presencia').upsert(filas, { onConflict: 'discord_id' });
    if (error) {
      console.error('discord-presencia · upsert', error.message);
      return Response.json({ ok: false, motivo: 'base' }, { status: 200 });
    }
  }

  /* Y a quien NO salga en la foto, «offline»: la pasarela no manda a los
     desconectados, así que no aparecer es exactamente eso. Va dentro del
     camino de éxito a propósito — si esto se hiciera tras un fallo de
     red, un tropiezo de treinta segundos apagaría a todo el mundo. */
  const dentro = filas.map((f) => f.discord_id);
  const apagar = db.from('presencia').update({ estado: 'offline', actualizado: ahora });
  const { error: err2 } = dentro.length
    ? await apagar.not('discord_id', 'in', `(${dentro.join(',')})`).neq('estado', 'offline')
    : await apagar.neq('estado', 'offline');
  if (err2) console.error('discord-presencia · apagar', err2.message);

  return Response.json({ ok: true, vistos: filas.length }, { status: 200 });
});
