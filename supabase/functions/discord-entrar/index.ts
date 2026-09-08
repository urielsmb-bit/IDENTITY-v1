// ============================================================
// IDENTITY · función de borde · meter a alguien en el servidor
//
// El problema que resuelve: para que se vea tu estado de Discord hace
// falta que un bot nuestro comparta servidor contigo. Eso, hasta ahora,
// significaba pedirte que entraras a un servidor a mano — el de Lanyard—,
// y un paso manual en mitad de «conecta tu Discord» lo hace casi nadie.
//
// Discord tiene la puerta abierta para esto y es oficial:
//
//     PUT /guilds/{guild}/members/{user}
//     Authorization: Bot <token>          ← el bot, con permiso de invitar
//     { "access_token": "<token de la persona con scope guilds.join>" }
//
// O sea que NO es meter a nadie a la fuerza: hace falta un token que la
// propia persona nos ha dado, y la pantalla de permisos de Discord se lo
// dice con todas las letras («Unirse a servidores por ti»). Sin ese
// consentimiento no hay llamada que valga.
//
// POR QUÉ EL SERVIDOR Y NO EL NAVEGADOR: el token del bot. Es la llave de
// la cuenta del bot entera; puesta en el navegador la tendría cualquiera
// que abra las herramientas de desarrollo.
//
// NO SE FÍA DE QUIÉN DICE SER: el navegador manda su token de Discord y
// nada más. Quién es se le pregunta a Discord con ese mismo token. Si el
// id viniera en el cuerpo, cualquiera podría meter a otra persona en el
// servidor escribiendo su snowflake.
//
// Desplegar:  supabase functions deploy discord-entrar
// Secretos:   DISCORD_BOT_TOKEN, DISCORD_GUILD_ID
// ============================================================

import { cors, preflight, origenValido, cuerpoEsJson } from '../_compartido/cors.ts';

const API = 'https://discord.com/api/v10';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);

  const cabeceras = { ...cors(req), 'content-type': 'application/json' };
  const no = (estado: number, motivo: string) =>
    new Response(JSON.stringify({ error: motivo }), { status: estado, headers: cabeceras });

  if (req.method !== 'POST') return no(405, 'metodo');
  if (!origenValido(req)) return no(403, 'origen');
  if (!cuerpoEsJson(req)) return no(415, 'tipo');

  const bot = Deno.env.get('DISCORD_BOT_TOKEN') ?? '';
  const guild = Deno.env.get('DISCORD_GUILD_ID') ?? '';
  /* Sin bot configurado esto no es un error de quien llama: es que la
     pieza todavía no está montada. Se dice y ya; el bloque de Discord
     sigue funcionando sin estado en vivo, como antes. */
  if (!bot || !guild) {
    return new Response(JSON.stringify({ ok: false, motivo: 'sin-bot' }), {
      status: 200,
      headers: cabeceras,
    });
  }

  let cuerpo: { access_token?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return no(400, 'json');
  }

  const token = typeof cuerpo.access_token === 'string' ? cuerpo.access_token.trim() : '';
  /* Un token de OAuth de Discord es una cadena corta de caracteres de
     URL. Se comprueba la forma antes de ponerlo en una cabecera: no por
     desconfianza del formato, sino para no reenviar a Discord cualquier
     cosa que llegue por el cuerpo. */
  if (!token || token.length > 128 || !/^[A-Za-z0-9._-]+$/.test(token)) {
    return no(400, 'token');
  }

  /* ---- 1 · quién es, según Discord ------------------------- */
  const yo = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!yo.ok) return no(401, 'token-no-valido');

  const datos = (await yo.json()) as { id?: unknown };
  const id = typeof datos.id === 'string' ? datos.id : '';
  if (!/^\d{17,20}$/.test(id)) return no(502, 'sin-id');

  /* ---- 2 · meterle en el servidor -------------------------- */
  /* 201 = se ha añadido. 204 = ya estaba dentro, que para nosotros es el
     mismo final feliz y pasa en cada reconexión. */
  const alta = await fetch(`${API}/guilds/${guild}/members/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${bot}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ access_token: token }),
  });

  if (alta.status === 201 || alta.status === 204) {
    return new Response(
      JSON.stringify({ ok: true, nuevo: alta.status === 201 }),
      { status: 200, headers: cabeceras },
    );
  }

  /* Los dos fallos que de verdad pasan, dichos por su nombre para que el
     editor pueda explicarlos en vez de enseñar un número:
       403 → al bot le falta el permiso de crear invitaciones en el
             servidor, o la persona tiene el servidor bloqueado.
       400 → el token no trae el scope `guilds.join`. */
  const texto = await alta.text().catch(() => '');
  console.error('discord-entrar', alta.status, texto.slice(0, 300));
  return new Response(
    JSON.stringify({ ok: false, motivo: alta.status === 403 ? 'sin-permiso' : 'sin-scope' }),
    { status: 200, headers: cabeceras },
  );
});
