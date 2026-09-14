/**
 * Lo que dice Supabase, dicho en cristiano.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUE EXISTE ESTO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Supabase responde en ingles y con frases de API. Ensenarselas tal cual a
 * alguien que no puede entrar —o que no consigue conectar su Discord— es
 * dejarle mirando un aviso rojo sin saber que hacer.
 *
 * Paso de verdad: varias personas entraron con Google y al darle a conectar
 * Discord les salia `Manual linking is disabled`. Nadie —ni ellas ni quien
 * lleva la pagina— podia adivinar que eso era un interruptor del panel de
 * Supabase, apagado de fabrica en todos los proyectos. El aviso era exacto
 * y completamente inutil.
 *
 * ────────────────────────────────────────────────────────────────────────
 * COMO SE RECONOCE CADA UNO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Primero por `code`, que es un identificador estable, y solo si no viene
 * se mira el texto. Al reves seria fragil: el texto de Supabase cambia
 * entre versiones y el codigo no.
 *
 * Y lo que no se reconoce se devuelve tal cual en vez de taparse con un
 * «algo ha fallado»: un mensaje en ingles es malo, pero uno que no dice
 * nada es peor, porque ya no se puede ni buscar.
 */

/** Lo que trae un error de Supabase, sin depender de su tipo. */
type ErrorConCodigo = { message?: unknown; code?: unknown; status?: unknown };

function partes(e: unknown): { texto: string; codigo: string } {
  const o = (e ?? {}) as ErrorConCodigo;
  const texto = e instanceof Error ? e.message : String(o.message ?? e ?? '');
  const codigo = typeof o.code === 'string' ? o.code : '';
  return { texto, codigo };
}

/**
 * Traduce un error de entrar, registrarse o recuperar la contrasena.
 */
export function traducirError(e: unknown): string {
  const { texto, codigo } = partes(e);
  const m = texto.toLowerCase();

  if (codigo === 'invalid_credentials' || m.includes('invalid login credentials'))
    return 'El correo o la contraseña no son correctos.';
  if (codigo === 'email_not_confirmed' || m.includes('email not confirmed'))
    return 'Confirma tu correo antes de entrar. Te enviamos un enlace al registrarte.';
  if (
    codigo === 'user_already_exists' ||
    m.includes('user already registered') ||
    m.includes('already been registered')
  )
    return 'Ya existe una cuenta con ese correo. Prueba a entrar.';
  if (codigo === 'weak_password' || m.includes('password should be at least'))
    return 'La contraseña es demasiado corta.';
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return 'Ese correo no parece válido.';
  if (
    codigo === 'over_request_rate_limit' ||
    codigo === 'over_email_send_rate_limit' ||
    m.includes('rate limit') ||
    m.includes('too many')
  )
    return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';
  if (m.includes('supabase no está configurado'))
    return 'Esta copia no tiene servidor configurado: puedes editar tu perfil, pero no crear cuenta.';

  return texto || 'No se pudo completar la operación.';
}

/** Como se llama cada proveedor cuando hay que nombrarlo en una frase. */
const NOMBRES: Record<string, string> = { discord: 'Discord', google: 'Google' };

/**
 * Traduce un error de CONECTAR o SOLTAR una cuenta de otro sitio.
 *
 * Es aparte de `traducirError` porque los errores no se parecen: aqui no hay
 * contrasenas ni correos, hay identidades. Lo que comparten es el final, asi
 * que lo que no se reconozca pasa por el otro antes de rendirse.
 */
export function traducirErrorDeEnlace(e: unknown, proveedor = ''): string {
  const { texto, codigo } = partes(e);
  const m = texto.toLowerCase();
  const quien = NOMBRES[proveedor] || 'esa cuenta';

  /* El interruptor del panel. Quien lo lee no puede arreglarlo, asi que lo
     que dice es a quien avisar, no que ha pasado por dentro. */
  if (codigo === 'manual_linking_disabled' || m.includes('manual linking is disabled'))
    return `Ahora mismo no se pueden conectar cuentas de ${quien}. Es cosa nuestra, no tuya: avísanos y lo dejamos listo.`;

  /* El caso frecuente de verdad: esa cuenta ya es OTRA cuenta de sharee.
     Pasa a quien entro un dia con Discord y otro dia se hizo una con
     Google, y acaba con dos perfiles sin saberlo. */
  if (
    codigo === 'identity_already_exists' ||
    m.includes('already been taken') ||
    (m.includes('already') && m.includes('linked'))
  )
    return `Ese ${quien} ya está usándose en otra cuenta de sharee. Cierra sesión y entra con ${quien}, o suéltalo allí antes de conectarlo aquí.`;

  /* Supabase no deja quedarse sin ninguna forma de entrar. Lo normal es que
     esto se explique antes de llamar, pero si llega, que se entienda. */
  if (codigo === 'single_identity_not_deletable' || m.includes('single identity'))
    return 'Es la única forma que tienes de entrar. Conecta otra antes de quitar esta.';

  /* La vuelta de Discord llego mal o tarde: casi siempre es que se dejo la
     pestana a medias o que se tardo demasiado en dar a autorizar. */
  if (codigo === 'bad_oauth_state' || m.includes('invalid state') || m.includes('bad_oauth'))
    return 'Se perdió el hilo por el camino. Vuelve a darle y termina sin cerrar la pestaña.';

  if (codigo === 'over_request_rate_limit' || m.includes('rate limit') || m.includes('too many'))
    return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';

  return traducirError(e);
}
