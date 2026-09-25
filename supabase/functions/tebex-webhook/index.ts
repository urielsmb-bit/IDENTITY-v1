/**
 * Los avisos de pago de Tebex.
 *
 * Tebex cobra el Premium de por vida y avisa aqui de cada pago, devolucion
 * o disputa. Esta funcion comprueba que el aviso es de verdad de Tebex y
 * se lo pasa a `tebex_aviso` (APLICAR_0031), que da o quita el diamante.
 *
 * LO QUE LA PROTEGE ES LA FIRMA. Esta direccion es publica y cualquiera
 * puede mandarle un «payment.completed» inventado. Tebex firma cada aviso
 * con un secreto que solo conocen Tebex y esta funcion: sin esa firma, o
 * con una que no cuadra, no se hace nada.
 *
 * Se despliega SIN comprobar sesion (`--no-verify-jwt`): quien llama es
 * Tebex, no alguien con cuenta en sharee.
 *
 *   npx supabase functions deploy tebex-webhook --no-verify-jwt
 *   npx supabase secrets set TEBEX_WEBHOOK_SECRET=…     (Tebex → Webhooks)
 *   npx supabase secrets set TEBEX_PAQUETE_PREMIUM=…    (el id del paquete)
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const texto = new TextEncoder();

function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json' },
  });
}

function aHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compara sin cortar en el primer caracter distinto: asi el tiempo de
 *  respuesta no le chiva a nadie cuantos caracteres ha acertado. */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/**
 * La firma de Tebex: el SHA-256 del cuerpo TAL CUAL llego, en hexadecimal,
 * y de eso un HMAC-SHA256 con el secreto. Del cuerpo crudo, no del JSON
 * leido y vuelto a escribir: cualquier espacio de diferencia la rompe.
 */
async function firmaValida(cuerpo: string, firma: string, secreto: string): Promise<boolean> {
  const resumen = aHex(await crypto.subtle.digest('SHA-256', texto.encode(cuerpo)));
  const clave = await crypto.subtle.importKey(
    'raw',
    texto.encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const esperada = aHex(await crypto.subtle.sign('HMAC', clave, texto.encode(resumen)));
  return iguales(esperada, firma.trim().toLowerCase());
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A que perfil va el pago. La pagina lo manda en `custom` al crear la
 * cesta y otra vez al añadir el paquete: la documentacion de Tebex promete
 * los dos en los avisos pero solo enseña el del producto, asi que se mira
 * en los dos sitios.
 */
function perfilDe(s: Record<string, any>): string | null {
  const candidatos = [
    s?.custom?.perfil,
    ...(Array.isArray(s?.products) ? s.products.map((p: any) => p?.custom?.perfil) : []),
  ];
  for (const c of candidatos) {
    if (typeof c === 'string' && UUID.test(c)) return c;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'solo POST' }, 405);

  const secreto = Deno.env.get('TEBEX_WEBHOOK_SECRET');
  if (!secreto) return json({ error: 'falta TEBEX_WEBHOOK_SECRET' }, 500);

  const cuerpo = await req.text();
  const firma = req.headers.get('x-signature') ?? '';
  const firmado = !!firma && (await firmaValida(cuerpo, firma, secreto));

  let aviso: Record<string, any>;
  try {
    aviso = JSON.parse(cuerpo);
  } catch {
    return json({ error: 'cuerpo mal formado' }, 400);
  }

  const tipo = String(aviso?.type ?? '');

  /* La prueba de Tebex al dar de alta la direccion: hay que devolverle su
     propio id. Hasta que no se contesta bien, no manda nada mas —y sin
     webhook validado, Tebex no deja crear un paquete sin entregables—.

     Se contesta AUNQUE la firma no cuadre. Este aviso no trae ningun pago
     y contestarlo no da ni quita nada: solo devuelve el id que ya venia.
     Tebex no documenta si lo firma, y exigirlo aqui dejaba la direccion
     sin validar sin decir por que. Si la firma falla se apunta en el
     registro: es la pista de que el secreto guardado no es el de Tebex, y
     los avisos de pago, que SI exigen firma, fallarian igual. */
  if (tipo === 'validation.webhook') {
    if (!firmado) console.warn('[tebex-webhook] validacion sin firma valida: revisa TEBEX_WEBHOOK_SECRET');
    return json({ id: aviso.id });
  }

  /* Todo lo demas, con firma o nada. */
  if (!firmado) return json({ error: 'firma no valida' }, 401);

  /* Premium es pago unico: los avisos de suscripciones no aplican. */
  if (!tipo.startsWith('payment.')) return json({ ok: true, ignorado: tipo });

  const s = (aviso.subject ?? {}) as Record<string, any>;

  /* Solo el paquete de Premium. Si un dia la tienda vende otra cosa, sus
     pagos no pueden acabar dando el diamante. */
  const paquete = Deno.env.get('TEBEX_PAQUETE_PREMIUM') ?? '';
  const productos: any[] = Array.isArray(s.products) ? s.products : [];
  if (paquete && !productos.some((p) => String(p?.id) === paquete)) {
    return json({ ok: true, ignorado: 'otro paquete' });
  }

  const transaccion = String(s.transaction_id ?? '');
  if (!transaccion) return json({ error: 'aviso sin transaccion' }, 400);

  const precio = s.price_paid ?? s.price ?? {};
  const importe = Number(precio.amount);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data, error } = await admin.rpc('tebex_aviso', {
    p_aviso: String(aviso.id ?? `${tipo}:${transaccion}`),
    p_tipo: tipo,
    p_transaccion: transaccion,
    p_perfil: perfilDe(s),
    p_importe: Number.isFinite(importe) ? importe : null,
    p_moneda: typeof precio.currency === 'string' ? precio.currency : null,
  });

  /* Un fallo de la base se contesta con 500 para que Tebex lo reintente:
     un pago que no llega a dar el diamante es justo lo que no puede
     perderse en silencio. */
  if (error) {
    console.error('[tebex-webhook]', error.message);
    return json({ error: 'no se pudo aplicar' }, 500);
  }

  return json({ ok: true, resultado: data });
});
