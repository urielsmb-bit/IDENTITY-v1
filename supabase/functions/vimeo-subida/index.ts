// ============================================================
// IDENTITY · función de borde · subir un fondo a Vimeo
//
// POR QUÉ EXISTE
//
// Subir a Vimeo necesita un token con permiso de escritura sobre
// LA CUENTA DE IDENTITY. Ese token no puede pisar el navegador:
// quien lo saque del bundle puede subir lo que quiera a la cuenta,
// y también borrar lo que ya hay. Así que el token vive aquí, en
// las variables de la función, y el navegador nunca lo ve.
//
// LO QUE NO HACE: no le pasa el archivo por encima. El vídeo va
// DIRECTO del navegador a Vimeo, con el enlace de un solo uso que
// esta función pide en su nombre. Un fondo son decenas de MB y
// hacerlos pasar por aquí sería pagar el tráfico dos veces y
// chocar con el límite de tamaño de petición.
//
//   navegador                 esta función              Vimeo
//      │── ticket ──────────────▶│                        │
//      │                         │── POST /me/videos ────▶│  (token)
//      │◀──── upload_link ───────│◀──── uri + link ───────│
//      │───────── el archivo, directo ──────────────────▶│
//      │── estado ──────────────▶│── GET /videos/{id} ───▶│
//
// Desplegar:
//   supabase secrets set VIMEO_TOKEN="..."
//   supabase secrets set VIMEO_DOMINIOS="identity-v2.vercel.app"
//   supabase functions deploy vimeo-subida
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { cors, preflight, origenValido, cuerpoEsJson } from '../_compartido/cors.ts';

/** Versión de la API que se pide explícitamente: sin esto Vimeo
 *  sirve la que le parezca y un cambio suyo rompe esto sin aviso. */
const ACEPTA = 'application/vnd.vimeo.*+json;version=3.4';

/** Tope por archivo.
 *
 *  No hace falta comprimir antes de subir: Vimeo transcodifica cada
 *  original a varias calidades y sirve la que le toque a cada visitante.
 *  Recomprimir en el navegador le daría un original peor del que partir
 *  —se perdería calidad dos veces— y encima tardaría minutos.
 *
 *  Así que el original sube tal cual y el tope es generoso. Sigue habiendo
 *  uno porque el espacio de la cuenta es compartido entre todos los
 *  perfiles: es una barrera contra el accidente, no contra el uso. */
const MAX_BYTES = 500 * 1024 * 1024;

function api(ruta: string, init: RequestInit = {}): Promise<Response> {
  const token = Deno.env.get('VIMEO_TOKEN') ?? '';
  return fetch('https://api.vimeo.com' + ruta, {
    ...init,
    headers: {
      Authorization: 'bearer ' + token,
      Accept: ACEPTA,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

/** Quién pide. Sin sesión no se sube: si no, la cuenta de Vimeo es
 *  un cubo abierto para cualquiera que encuentre la URL. */
async function quien(req: Request): Promise<{ id: string } | null> {
  const auth = req.headers.get('authorization') ?? '';
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!jwt) return null;

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const { data, error } = await sb.auth.getUser(jwt);
  if (error || !data.user) return null;
  return { id: data.user.id };
}

Deno.serve(async (req: Request) => {
  const CORS = cors(req);

  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }
  if (!origenValido(req)) return new Response(null, { status: 403, headers: CORS });
  if (!cuerpoEsJson(req)) return new Response(null, { status: 415, headers: CORS });

  if (!Deno.env.get('VIMEO_TOKEN')) {
    // Falla hacia cerrado y lo dice: sin token no hay nada que hacer,
    // y un 500 mudo se investiga durante media hora.
    return new Response(JSON.stringify({ error: 'VIMEO_TOKEN sin configurar' }), {
      status: 503,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const usuario = await quien(req);
  if (!usuario) return new Response(null, { status: 401, headers: CORS });

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return new Response('Bad request', { status: 400, headers: CORS });
  }

  const accion = String(cuerpo.accion ?? '');
  const json = (d: unknown, status = 200) =>
    new Response(JSON.stringify(d), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  // ── 1 · pedir el ticket de subida ─────────────────────────
  if (accion === 'ticket') {
    const tamano = Number(cuerpo.tamano);
    if (!isFinite(tamano) || tamano <= 0 || tamano > MAX_BYTES) {
      return json({ error: `El vídeo debe pesar menos de ${MAX_BYTES / 1048576} MB` }, 400);
    }

    /* `view: disable` + `embed: whitelist` es lo que hace que el
       vídeo NO aparezca en vimeo.com y solo se pueda ver incrustado
       en los dominios permitidos. Sin esto, los fondos de la gente
       serían una galería pública en la cuenta de IDENTITY.

       Pero la privacidad por dominio no está en todos los planes. Si
       el plan no la admite, Vimeo responde 400 y ANTES eso dejaba la
       subida muerta sin explicar por qué. Ahora se reintenta con lo
       más cerrado que sí permite todo plan de pago: `unlisted`, que
       no sale en búsquedas ni en el perfil de la cuenta, aunque sí se
       ve con el enlace directo. Es un escalón menos, y se dice cuál
       se usó en vez de callarlo. */
    const nombre = `fondo-${usuario.id}-${Date.now()}`;
    const descripcion = `Fondo de perfil subido desde IDENTITY por ${usuario.id}`;

    const pedir = (privacy: Record<string, unknown>) =>
      api('/me/videos', {
        method: 'POST',
        body: JSON.stringify({
          upload: { approach: 'tus', size: tamano },
          name: nombre,
          description: descripcion,
          privacy,
        }),
      });

    let privacidad = 'estricta';
    let r = await pedir({
      view: 'disable',
      embed: 'whitelist',
      download: false,
      comments: 'nobody',
    });

    if (r.status === 400) {
      // Puede ser el plan, o puede ser otra cosa: el cuerpo lo dice.
      const porQue = await r.text();
      console.warn('privacidad estricta rechazada, se prueba unlisted:', porQue.slice(0, 200));
      privacidad = 'unlisted';
      r = await pedir({ view: 'unlisted', download: false, comments: 'nobody' });
    }

    if (!r.ok) {
      const detalle = await r.text();
      return json({ error: 'Vimeo rechazó la subida', detalle: detalle.slice(0, 400) }, 502);
    }

    const d = await r.json();
    const uri = String(d?.uri ?? '');           // "/videos/123456789"
    const id = uri.split('/').pop() ?? '';
    const enlace = String(d?.upload?.upload_link ?? '');
    if (!id || !enlace) return json({ error: 'Vimeo no devolvió el enlace de subida' }, 502);

    /* El dominio se autoriza AHORA, no al terminar: si la subida se
       corta a medias el vídeo queda igualmente inservible fuera de
       aquí, que es lo que se quiere. */
    for (const dom of (Deno.env.get('VIMEO_DOMINIOS') ?? '').split(',').map((x) => x.trim())) {
      if (dom) await api(`/videos/${id}/privacy/domains/${dom}`, { method: 'PUT' });
    }

    return json({ id, enlace, privacidad });
  }

  // ── 2 · preguntar si ya está transcodificado ──────────────
  if (accion === 'estado') {
    const id = String(cuerpo.id ?? '').replace(/\D/g, '');
    if (!id) return json({ error: 'Falta el id' }, 400);

    const r = await api(`/videos/${id}?fields=transcode.status,width,height`);
    if (!r.ok) return json({ error: 'No se pudo consultar el vídeo' }, 502);

    const d = await r.json();
    const estado = String(d?.transcode?.status ?? 'in_progress');
    return json({
      estado,                                   // in_progress | complete | error
      ancho: Number(d?.width) || 0,
      alto: Number(d?.height) || 0,
    });
  }

  return json({ error: 'Acción desconocida' }, 400);
});
