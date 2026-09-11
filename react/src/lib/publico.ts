import { CONFIG } from '@/config';
import { normalizarPerfil } from './normalizar';
import { filaPrecargada } from './precarga';

/**
 * Lo que necesita un visitante para ver un perfil. Y nada más.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE ESTE FICHERO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Medido sobre el paquete de producción:
 *
 *   @supabase/supabase-js entero .......... 55 kB comprimidos
 *     └ realtime-js ....................... 16 kB  ← no se usa en toda la app
 *     └ auth-js ........................... 23 kB  ← un visitante no entra
 *     └ postgrest-js (leer una fila) ......  4 kB  ← lo único que hace falta
 *
 * O sea que quien abre el perfil de alguien —que es la inmensa mayoría del
 * tráfico de esto, y casi siempre desde un teléfono— se bajaba cincuenta y
 * cinco kilobytes, los parseaba y construía un cliente con su motor de
 * websockets y su temporizador de refresco de sesión… para hacer un GET.
 *
 * Aquí ese GET se hace con `fetch`. PostgREST es una API REST corriente:
 * `?username=eq.pepe&select=…` con la clave anónima en la cabecera. El SDK
 * no aporta nada a una lectura pública salvo azúcar sintáctico.
 *
 * El SDK sigue existiendo y sigue siendo el camino para todo lo demás
 * —entrar, guardar, subir, el editor entero—, pero ahora se carga cuando
 * hace falta y no antes.
 *
 * ────────────────────────────────────────────────────────────────────────
 * MISMA LIMPIEZA
 * ────────────────────────────────────────────────────────────────────────
 *
 * `aPerfil` vive AQUÍ y `backend.ts` la importa de aquí, no al revés. Es el
 * único embudo por el que pasa toda fila que venga del servidor, y tener dos
 * copias —una para el visitante y otra para el dueño— sería tener dos ideas
 * distintas de qué es un perfil válido. La que se salte algo es la que abre
 * el agujero.
 */

/**
 * Si hay servidor configurado.
 *
 * Sale de la configuración y no de si existe el cliente, que es lo mismo
 * —el cliente se crea justo cuando hay configuración— pero sin obligar a
 * importar el SDK para preguntarlo. Eso era, literalmente, cincuenta y cinco
 * kilobytes por un booleano.
 */
export function hayBackend(): boolean {
  return CONFIG.hayBackend();
}

function cabeceras(): HeadersInit {
  return {
    apikey: CONFIG.SUPABASE_KEY,
    authorization: 'Bearer ' + CONFIG.SUPABASE_KEY,
    accept: 'application/json',
  };
}

/**
 * Una lectura de PostgREST.
 *
 * Devuelve siempre un array; quien quiera una fila coge la primera. No se usa
 * la cabecera `vnd.pgrst.object+json`, que devuelve un objeto suelto, porque
 * con ella «no hay ninguna fila» llega como un 406 —un error— en vez de como
 * una lista vacía. Un perfil que no existe no es un fallo del servidor: es
 * una respuesta.
 */
async function leer(vista: string, consulta: string, señal?: AbortSignal): Promise<unknown[]> {
  const base = CONFIG.SUPABASE_URL.replace(/\/+$/, '');
  const r = await fetch(`${base}/rest/v1/${vista}?${consulta}`, {
    headers: cabeceras(),
    signal: señal,
  });
  if (!r.ok) {
    const e = new Error(`${vista}: ${r.status}`) as Error & { estado: number };
    e.estado = r.status;
    throw e;
  }
  const datos: unknown = await r.json();
  return Array.isArray(datos) ? datos : [];
}

/** La fila del servidor convertida en perfil, saneada. */
export function aPerfil(fila: any): any {
  if (!fila) return null;
  const p = { ...(fila.apariencia || {}) };
  p.username = fila.username;
  p.joined = fila.creado || p.joined;
  p._id = fila.id;
  p._actualizado = fila.actualizado;
  return normalizarPerfil(p);
}

/** Igual, pero conservando las cifras que la vista pública trae aparte. */
export function conCifras(fila: unknown) {
  const p = aPerfil(fila);
  if (p && fila) {
    const f = fila as Record<string, unknown>;
    if (f.vistas != null) p.views = Number(f.vistas) || 0;
    if (f.nota != null) p.nota = Number(f.nota);
    if (f.num_notas != null) p.numNotas = Number(f.num_notas) || 0;
  }
  return p;
}

const CAMPOS = 'id,username,apariencia,creado,actualizado,vistas,nota,num_notas';
const CAMPOS_TABLA = 'id,username,apariencia,creado,actualizado';

let avisadoDeLaVista = false;

/**
 * El perfil de alguien.
 *
 * Primero mira si el servidor lo dejó escrito dentro del HTML: `api/perfil.ts`
 * ya consulta esa misma fila para poner el título y la imagen de la vista
 * previa, así que escribirla ahí no le cuesta una petición más y al navegador
 * le ahorra una ida y vuelta entera antes de poder pintar.
 */
export async function cargarPerfil(username: string, señal?: AbortSignal) {
  const precargada = filaPrecargada(username);
  if (precargada) return conCifras(precargada);
  if (!hayBackend()) return null;

  const q = `username=eq.${encodeURIComponent(username)}&limit=1`;
  try {
    const filas = await leer('perfiles_publicos', `select=${CAMPOS}&${q}`, señal);
    return filas.length ? conCifras(filas[0]) : null;
  } catch (e) {
    /* 404 de PostgREST = la vista todavía no existe. Es el estado normal
       hasta que se aplique la migración, no un fallo: se lee de la tabla,
       que tiene los mismos datos sin las cifras. */
    if ((e as { estado?: number }).estado !== 404) throw e;
    if (!avisadoDeLaVista) {
      avisadoDeLaVista = true;
      console.warn('[publico] La vista perfiles_publicos no existe todavia. Se lee de la tabla.');
    }
    const filas = await leer('perfiles', `select=${CAMPOS_TABLA}&${q}`, señal);
    return filas.length ? aPerfil(filas[0]) : null;
  }
}

/** Las cifras y las insignias concedidas de alguien, por su nombre. */
export async function insigniasDe(username: string) {
  const vacio = { vistas: 0, nota: null as number | null, numNotas: 0, concedidas: [] as string[] };
  if (!hayBackend()) return vacio;

  const q = `username=eq.${encodeURIComponent(username)}&limit=1`;
  let fila: any = null;
  try {
    const filas = await leer('perfiles_publicos', `select=id,vistas,nota,num_notas&${q}`);
    fila = filas[0] ?? null;
  } catch {
    /* De `perfiles_publicos` y no de `descubrir`: `descubrir` deja fuera a
       quien apaga «Perfil publico», y leer de ahí le quitaría también las
       insignias de visitas y de notas. Salir del buscador y perder lo que has
       ganado son dos cosas distintas. */
    try {
      const filas = await leer('descubrir', `select=id,vistas,nota,num_notas&${q}`);
      fila = filas[0] ?? null;
    } catch {
      return vacio;
    }
  }
  if (!fila) return vacio;

  const metricas = {
    vistas: Number(fila.vistas) || 0,
    nota: fila.nota == null ? null : Number(fila.nota),
    numNotas: Number(fila.num_notas) || 0,
    concedidas: [] as string[],
  };
  metricas.concedidas = await concedidasDe(String(fila.id ?? ''));
  return metricas;
}

/** Las insignias que el equipo le ha dado a un perfil. */
export async function concedidasDe(perfilId: string): Promise<string[]> {
  if (!hayBackend() || !perfilId) return [];
  try {
    const filas = await leer(
      'insignias_de_perfil',
      `select=insignia&perfil_id=eq.${encodeURIComponent(perfilId)}`,
    );
    return filas.map((f: any) => String(f.insignia)).filter(Boolean);
  } catch {
    /* La vista puede no existir todavía. Mientras tanto solo faltan las
       concedidas a mano y «verificado»; las de antigüedad, visitas y notas se
       calculan igual. */
    return [];
  }
}

/** Una visita más. Ya era `fetch` antes de todo esto. */
export async function contarVista(username: string) {
  if (!hayBackend()) return;
  const base = CONFIG.SUPABASE_URL.replace(/\/+$/, '');
  try {
    await fetch(CONFIG.FN_VISTAS || base + '/functions/v1/registrar-vista', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + CONFIG.SUPABASE_KEY,
      },
      body: JSON.stringify({ username }),
    });
  } catch {
    // Una visita sin contar no le arruina la pagina a nadie.
  }
}

/**
 * La presencia de Discord de alguien.
 *
 * Es una lectura publica como las demas y estaba trayendose el SDK entero a
 * la ruta del perfil: `ProfileView` monta el widget siempre, asi que bastaba
 * con eso para que quien mira el perfil de otra persona se bajara el cliente
 * de autenticacion de Supabase.
 *
 * `select=*` a proposito, igual que antes: nombrar las columnas ata esta
 * lectura a que una migracion concreta ya este aplicada, y si falta una
 * PostgREST tumba la consulta ENTERA. El perfil se quedaria sin estado, sin
 * cancion y sin punto; no sin lo nuevo, sin nada.
 */
export async function presenciaDe(discordId: string): Promise<any | null> {
  if (!hayBackend() || !discordId) return null;
  const filas = await leer(
    'presencia',
    `select=*&discord_id=eq.${encodeURIComponent(discordId)}&limit=1`,
  );
  return filas[0] ?? null;
}
