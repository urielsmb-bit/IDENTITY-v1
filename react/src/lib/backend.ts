import { supabase, hasBackend } from './supabase';
import { CONFIG } from '@/config';
import { normalizarPerfil } from './normalizar';
import type { Session, User, Provider } from '@supabase/supabase-js';
import { extraerPlantilla, type AjustesPlantilla } from './plantilla';
import type { Profile } from '@/types';

// ---- State ----
let sesionViva: Session | null = null;
let provsCache: any = null;

if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    sesionViva = data?.session || null;
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    sesionViva = session;
  });
}

function esArchivoLocal(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'file:';
}

export function iniciar(): boolean {
  return hasBackend();
}

export function haySesion(): boolean {
  return !!sesionViva;
}

export function getSesionViva(): Session | null {
  return sesionViva;
}

export function hay(): boolean {
  return hasBackend();
}

export function cliente() {
  return supabase;
}

function urlFuncion(nombre: string): string {
  const url = CONFIG.SUPABASE_URL;
  return url.replace(/\/+$/, '') + '/functions/v1/' + nombre;
}

const COLUMNAS = ['username', 'estado', 'creado', 'actualizado'];

export function aPerfil(fila: any): any {
  if (!fila) return null;
  const p = { ...(fila.apariencia || {}) };
  p.username = fila.username;
  p.joined = fila.creado || p.joined;
  p._id = fila.id;
  p._actualizado = fila.actualizado;
  // Único punto por el que pasan todas las filas del servidor (cargarPerfil,
  // cargarMio, crearPerfil, guardarPerfil, descubrir): sanear aquí cubre
  // cualquier perfil ajeno antes de que llegue a pintarse.
  return normalizarPerfil(p);
}

export function aFila(p: any): any {
  const ap: Record<string, any> = {};
  Object.keys(p).forEach(k => {
    if (k.charAt(0) === '_') return;
    if (COLUMNAS.includes(k)) return;
    ap[k] = p[k];
  });
  return { username: p.username, apariencia: ap };
}

// ---- Auth ----

export async function sesion(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

export async function usuario(): Promise<User | null> {
  const s = await sesion();
  return s ? s.user : null;
}

export async function entrar(correo: string, clave: string) {
  if (!supabase) throw new Error('sin backend');
  const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
  if (error) throw traducir(error);
  return data.session;
}

export async function registrar(correo: string, clave: string) {
  if (!supabase) throw new Error('sin backend');
  const { data, error } = await supabase.auth.signUp({ email: correo, password: clave });
  if (error) throw traducir(error);
  return { sesion: data.session || null, confirmar: !data.session };
}

export async function conProveedor(proveedor: Provider, permisos?: string) {
  if (!supabase) throw new Error('sin backend');
  if (esArchivoLocal()) {
    throw new Error('Has abierto el archivo con doble clic. Para entrar hace falta servirlo.');
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: proveedor,
    options: {
      scopes: permisos || undefined,
      redirectTo: window.location.origin + '/'
    }
  });
  if (error) throw traducir(error);
  return data;
}

export async function salir() {
  if (!supabase) return true;
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) console.warn('[backend] signOut', error.message);
  return true;
}

export async function recuperarClave(correo: string) {
  if (!supabase) throw new Error('sin backend');
  const { error } = await supabase.auth.resetPasswordForEmail(correo, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) throw traducir(error);
  return true;
}

export async function cambiarClave(nueva: string, actual?: string) {
  if (!supabase) throw new Error('sin backend');

  if (actual) {
    const u = await usuario();
    if (u && u.email) {
      const { error } = await supabase.auth.signInWithPassword({ email: u.email, password: actual });
      if (error) throw new Error('La contrasena actual no es correcta.');
    }
  }

  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) throw traducir(error);
  return true;
}

export async function borrarCuenta(confirmacion: string) {
  if (!supabase) throw new Error('sin backend');
  const s = await sesion();
  if (!s) throw new Error('Hay que entrar en la cuenta primero');
  
  const res = await fetch(urlFuncion('borrar-cuenta'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer ' + s.access_token,
      'apikey': CONFIG.SUPABASE_KEY
    },
    body: JSON.stringify({ confirmacion })
  });
  
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'No se pudo borrar la cuenta');
  return true;
}

export async function proveedores() {
  if (!supabase) return {};
  if (provsCache) return provsCache;
  
  try {
    const res = await fetch(CONFIG.SUPABASE_URL + '/auth/v1/settings', {
      headers: { apikey: CONFIG.SUPABASE_KEY }
    });
    if (res.ok) {
      const j = await res.json();
      provsCache = j?.external || {};
    } else {
      provsCache = {};
    }
  } catch {
    return {};
  }
  return provsCache;
}

export function alCambiarSesion(fn: (evento: string, sesion: Session | null) => void) {
  if (!supabase) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange(fn);
  return () => { try { subscription.unsubscribe(); } catch { /* ya estaba desuscrito */ } };
}

// ---- Profiles ----

let avisadoDeLaVista = false;

export async function cargarPerfil(username: string) {
  if (!supabase) return null;
  const client = supabase;

  const porLaTabla = async () => {
    if (!avisadoDeLaVista) {
      avisadoDeLaVista = true;
      console.warn('[backend] La vista perfiles_publicos no existe todavia. Se lee de la tabla.');
    }
    const { data, error } = await client.from('perfiles')
      .select('id,username,apariencia,creado,actualizado')
      .eq('username', username)
      .maybeSingle();
      
    if (error) throw traducir(error);
    return aPerfil(data);
  };

  /* Con las cifras. Desde 0008 la vista publica las trae, y sin pedirlas
     aqui el perfil llegaba con `views` vacio: el contador del propio perfil
     y el del carrusel salian a cero aunque la base tuviera el numero bueno,
     mientras la tarjeta de al lado —que lee la fila de Descubrir— enseñaba
     el de verdad. Dos fuentes para el mismo dato y una sin el campo. */
  const CAMPOS = 'id,username,apariencia,creado,actualizado,vistas,nota,num_notas';

  let { data, error } = await client.from('perfiles_publicos')
    .select(CAMPOS)
    .eq('username', username)
    .maybeSingle();

  // 42703 = la columna no existe: la vista es anterior a 0008.
  if (error && (error.code === '42703' || /column .* does not exist/i.test(error.message || ''))) {
    ({ data, error } = await client.from('perfiles_publicos')
      .select('id,username,apariencia,creado,actualizado')
      .eq('username', username)
      .maybeSingle());
  }

  if (error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || ''))) {
    return porLaTabla();
  }
  if (error) throw traducir(error);

  const p = aPerfil(data);
  if (p && data) {
    const f = data as Record<string, unknown>;
    if (f.vistas != null) p.views = Number(f.vistas) || 0;
    if (f.nota != null) p.nota = Number(f.nota);
    if (f.num_notas != null) p.numNotas = Number(f.num_notas) || 0;
  }
  return p;
}

export async function cargarMio() {
  if (!supabase) return null;
  const u = await usuario();
  if (!u) return null;
  
  const { data, error } = await supabase.from('perfiles')
    .select('id,username,apariencia,estado,creado,actualizado')
    .eq('dueno', u.id)
    .maybeSingle();
    
  if (error) throw traducir(error);
  return aPerfil(data);
}

export async function nombreDisponible(nombre: string) {
  if (!supabase) return true;
  const { data, error } = await supabase.rpc('nombre_disponible', { p_nombre: nombre });
  if (error) throw traducir(error);
  return data === true;
}

export async function crearPerfil(p: any) {
  if (!supabase) throw new Error('sin backend');
  const u = await usuario();
  if (!u) throw new Error('Hay que entrar en la cuenta primero');
  
  const fila = aFila(p);
  fila.dueno = u.id;
  fila.acepto_en = new Date().toISOString();
  fila.acepto_version = CONFIG.VERSION_LEGAL || null;
  
  const { data, error } = await supabase.from('perfiles')
    .insert(fila)
    .select('id,username,apariencia,estado,creado,actualizado')
    .single();
    
  if (error) throw traducir(error);
  return aPerfil(data);
}

export async function guardarPerfil(p: any): Promise<any> {
  if (!supabase) throw new Error('sin backend');
  const client = supabase;
  if (!p._id) return crearPerfil(p);

  const escribir = async (marca: string) => {
    let q = client.from('perfiles').update(aFila(p)).eq('id', p._id);
    if (marca) q = q.eq('actualizado', marca);
    const { data, error } = await q.select('id,username,apariencia,estado,creado,actualizado').maybeSingle();
    if (error) throw traducir(error);
    return data ? aPerfil(data) : null;
  };

  const guardado = await escribir(p._actualizado);
  if (guardado) return guardado;

  const { data, error } = await client.from('perfiles').select('actualizado').eq('id', p._id).maybeSingle();
  if (error) throw traducir(error);
  if (!data) {
    const e = new Error('Este perfil ya no esta en tu cuenta.');
    (e as any).code = 'sin-fila';
    throw e;
  }
  
  const g2 = await escribir(data.actualizado);
  if (!g2) {
    const e2 = new Error('No se pudo guardar: el perfil cambia mas rapido de lo que se puede escribir.');
    (e2 as any).code = 'conflicto';
    throw e2;
  }
  g2._desplazo = true;
  return g2;
}

export async function borrarPerfil(id: string) {
  if (!supabase) throw new Error('sin backend');
  const { error } = await supabase.from('perfiles').delete().eq('id', id);
  if (error) throw traducir(error);
  return true;
}

// ---- Discover & Ranking ----

export interface OpcionesDescubrir {
  /** Columna de orden del servidor: puntuacion | vistas | nota | nuevos */
  orden?: string;
  limite?: number;
}

export async function descubrir(opciones: OpcionesDescubrir = {}) {
  if (!supabase) return [];
  const ORDENES: Record<string, string> = {
    puntuacion: 'puntuacion',
    vistas: 'vistas',
    nota: 'nota',
    nuevos: 'actualizado'
  };
  const orden = ORDENES[opciones.orden ?? ''] || 'puntuacion';
  
  const { data, error } = await supabase.from('descubrir')
    .select('*')
    .order(orden, { ascending: false, nullsFirst: false })
    .limit(opciones.limite || 30);
    
  if (error) throw traducir(error);
  return (data || []).map((f: any) => {
    const p = aPerfil(f);
    p.views = f.vistas;
    p.nota = f.nota;
    p.numNotas = f.num_notas;
    return p;
  });
}

/**
 * Lo que hace falta para decidir las insignias de un perfil.
 *
 * Va aparte de `cargarPerfil` a proposito: las metricas viven en otra vista
 * y las concesiones en otra tabla, y ninguna de las dos debe poder impedir
 * que el perfil se pinte. Si algo de esto falla, se devuelven ceros y el
 * perfil sale sin insignias, que es mejor que no salir.
 */
export async function insigniasDe(username: string) {
  const vacio = { vistas: 0, nota: null as number | null, numNotas: 0, concedidas: [] as string[] };
  if (!supabase) return vacio;
  const client = supabase;

  let id = '';
  let metricas = vacio;

  const leerDe = async (vista: string) => {
    const { data, error } = await client.from(vista)
      .select('id,vistas,nota,num_notas')
      .eq('username', username)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  try {
    /* De `perfiles_publicos` y no de `descubrir`: desde 0008, `descubrir`
       deja fuera a quien apaga «Perfil publico», y leer de ahi le habria
       quitado tambien las insignias de visitas y de notas. Salir del
       buscador y perder lo que has ganado son dos cosas distintas. */
    let fila;
    try {
      fila = await leerDe('perfiles_publicos');
    } catch {
      // Sin la migracion 0008 esa vista todavia no trae cifras.
      fila = await leerDe('descubrir');
    }
    if (fila) {
      id = String(fila.id ?? '');
      metricas = {
        vistas: Number(fila.vistas) || 0,
        nota: fila.nota == null ? null : Number(fila.nota),
        numNotas: Number(fila.num_notas) || 0,
        concedidas: [],
      };
    }
  } catch {
    /* sin metricas: las insignias por meta saldran sin ganar */
  }

  if (!id) return metricas;

  try {
    const { data, error } = await client.from('insignias_de_perfil')
      .select('insignia')
      .eq('perfil_id', id);
    // 42P01 = la vista todavia no existe. Es el estado normal hasta que se
    // aplique 0007_insignias.sql: no es un error que ensenar a nadie, y
    // mientras tanto solo faltan las concedidas a mano y «verificado».
    // Las de antiguedad, visitas y notas se calculan igual.
    if (!error && data) {
      metricas.concedidas = data
        .map((f: any) => String(f.insignia))
        .filter(Boolean);
    }
  } catch {
    /* idem */
  }

  return metricas;
}

/**
 * Las analiticas de un perfil propio.
 *
 * Todo sale del servidor. Antes esta pagina leia `localStorage`, asi que
 * ensenaba las visitas contadas EN ESTE NAVEGADOR: quien entrara desde el
 * movil veia ceros aunque tuviera mil visitas de verdad.
 *
 * Un aviso sobre lo que se puede y lo que no. La tabla `vistas` guarda una
 * fila POR VISITANTE —con cuando llego, cuando volvio y cuantas veces—, no
 * una por visita. De ahi salen los totales exactos, y una serie diaria de
 * GENTE NUEVA. Lo que no existe en ninguna parte es «visitas por dia»: para
 * eso habria que guardar una fila por visita, que es mucho mas caro y no se
 * eligio. La pagina dice lo que ensena, en vez de llamarlo otra cosa.
 *
 * `vistas` solo la lee su dueno: lo garantiza la politica de la tabla, no
 * esta consulta.
 */
export async function analiticasDe(perfilId: string, dias = 30) {
  const vacio = {
    unicas: 0,
    totales: 0,
    nota: null as number | null,
    numNotas: 0,
    porDia: {} as Record<string, number>,
    ultima: '' as string,
  };
  if (!supabase || !perfilId) return vacio;
  const client = supabase;

  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const [metricas, visitas] = await Promise.all([
    client.from('perfil_metricas')
      .select('vistas_unicas,vistas_totales,suma_notas,num_notas')
      .eq('perfil_id', perfilId)
      .maybeSingle(),
    client.from('vistas')
      .select('primera,ultima')
      .eq('perfil_id', perfilId)
      .gte('primera', desde)
      .order('primera', { ascending: false })
      .limit(5000),
  ]);

  const m: any = metricas.data ?? {};
  const filas: any[] = visitas.data ?? [];

  const porDia: Record<string, number> = {};
  for (let i = 0; i < dias; i++) {
    porDia[new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)] = 0;
  }
  let ultima = '';
  for (const f of filas) {
    const dia = String(f.primera ?? '').slice(0, 10);
    if (dia in porDia) porDia[dia] = (porDia[dia] ?? 0) + 1;
    const u = String(f.ultima ?? '');
    if (u > ultima) ultima = u;
  }

  const num = Number(m.num_notas) || 0;
  return {
    unicas: Number(m.vistas_unicas) || 0,
    totales: Number(m.vistas_totales) || 0,
    nota: num > 0 ? Number(m.suma_notas) / num : null,
    numNotas: num,
    porDia,
    ultima,
  };
}

export async function contarVista(username: string) {
  if (!supabase) return;
  try {
    await fetch(CONFIG.FN_VISTAS || urlFuncion('registrar-vista'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + CONFIG.SUPABASE_KEY
      },
      body: JSON.stringify({ username })
    });
  } catch {
    // ignorar
  }
}

// ---- Media ----

/* Saca la ruta dentro del cubo a partir de una direccion publica, y
   devuelve null si esa direccion NO es un archivo nuestro de este
   usuario. Eso descarta de golpe los enlaces pegados a mano, las
   direcciones de Vimeo y los archivos de otra cuenta: solo se borra lo
   que sabemos que subimos aqui.

   La base ya lo impide por su cuenta —la politica de borrado exige que
   la primera carpeta sea el uid— asi que esto no es la cerradura, es no
   llamar a la puerta para nada. */
/* Exportada solo para poder probarla: es la que decide QUE se borra. */
export function rutaDeUrl(url: string, uid: string, cubo: string): string | null {
  const marca = '/storage/v1/object/public/' + cubo + '/';
  const i = url.indexOf(marca);
  if (i < 0) return null;
  const cruda = url.slice(i + marca.length).split('?')[0];
  if (!cruda) return null;
  let ruta: string;
  try {
    ruta = decodeURIComponent(cruda);
  } catch {
    return null;
  }
  return ruta.startsWith(uid + '/') ? ruta : null;
}

/* Borra un archivo del cubo por su direccion publica.
   Sustituye a un `borrarMedio(tipo, extension)` que habia aqui y que no
   llamaba nadie: pedia la extension, y quien pulsa «Quitar» lo unico que
   tiene a mano es la direccion. Por eso llevaba muerto desde el principio
   y por eso «Quitar» no borraba nada. */
export async function borrarMedioPorUrl(url: string) {
  if (!supabase || !url) return false;
  try {
    const u = await usuario();
    if (!u) return false;
    const cubo = CONFIG.BUCKET_MEDIA;
    const ruta = rutaDeUrl(url, u.id, cubo);
    if (!ruta) return false;
    await supabase.storage.from(cubo).remove([ruta]);
    return true;
  } catch {
    return false;
  }
}

/* `anterior` es la direccion del archivo al que este sustituye.
   Hace falta porque la ruta lleva la extension —`<id>/fondo.mp4`— y el
   `upsert` solo pisa al viejo si la extension coincide: subir un webm
   encima de un mp4 dejaba los dos. Y como NADA borraba nunca, esos
   huerfanos contaban para el tope de ocho archivos por cuenta, hasta
   que la subida empezaba a fallar con «Borra alguno antes de subir
   otro» y no habia ninguna forma de borrar nada. */
export async function subirMedio(
  blob: Blob,
  tipo: string,
  extension: string,
  anterior?: string,
) {
  if (!supabase) throw new Error('sin backend');
  const u = await usuario();
  if (!u) throw new Error('Hay que entrar en la cuenta para subir archivos');
  
  const cubo = CONFIG.BUCKET_MEDIA;
  const ext = String(extension || '').replace(/[^a-z0-9]/gi, '').slice(0, 5).toLowerCase() || 'bin';
  const nombre = String(tipo).replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'archivo';
  const ruta = u.id + '/' + nombre + '.' + ext;

  const { error } = await supabase.storage.from(cubo).upload(ruta, blob, {
    upsert: true,
    contentType: blob.type || undefined,
    cacheControl: '3600'
  });
  if (error) throw traducir(error);
  
  /* El anterior se va DESPUES de que el nuevo este arriba: si se borrara
     antes y la subida fallara, el usuario se quedaria sin ninguno de los
     dos. Y si el borrado falla no se dice nada, porque el trabajo que
     pidio —subir— ya salio bien. */
  if (anterior) {
    const vieja = rutaDeUrl(anterior, u.id, cubo);
    if (vieja && vieja !== ruta) {
      try {
        await supabase.storage.from(cubo).remove([vieja]);
      } catch {
        /* se queda un huerfano; no es motivo para romperle la subida */
      }
    }
  }

  const pub = supabase.storage.from(cubo).getPublicUrl(ruta);
  const url = pub?.data?.publicUrl;
  if (!url) throw new Error('No se pudo obtener la direccion del archivo');
  return url + '?v=' + Date.now();
}


// ---- Rating & Reports ----

export async function valorar(perfilId: string, nota: number) {
  if (!supabase) throw new Error('sin backend');
  const u = await usuario();
  if (!u) throw new Error('Hay que entrar para valorar');
  const { error } = await supabase.from('valoraciones')
    .upsert({ perfil_id: perfilId, autor_id: u.id, nota });
  if (error) throw traducir(error);
  return true;
}

export async function denunciar(perfilId: string, motivo: string, detalle?: string) {
  if (!supabase) throw new Error('sin backend');
  const { error } = await supabase.from('denuncias')
    .insert({ perfil_id: perfilId, motivo, detalle: detalle || null });
  if (error) throw traducir(error);
  return true;
}

// ---- Error translation ----

export function traducir(e: any): Error {
  const m = e?.message || '';
  const c = e?.code || '';
  let salida;

  if (c === '23505' || /duplicate key/i.test(m)) {
    salida = /username/i.test(m) ? 'Ese nombre de usuario ya esta cogido.' : 'Eso ya existe.';
  } else if (/no esta disponible/i.test(m)) {
    salida = 'Ese nombre de usuario esta reservado.';
  } else if (/maximo de perfiles/i.test(m)) {
    salida = 'Ya tienes un perfil en esta cuenta.';
  } else if (c === '23514' || /violates check constraint/i.test(m)) {
    salida = /apariencia_tamano/.test(m)
      ? 'El perfil ocupa demasiado. Quita alguna imagen pesada.'
      : /username_forma/.test(m)
        ? 'El nombre solo admite letras, numeros y guion bajo, de 3 a 20.'
        : 'Hay un dato que no cumple las reglas.';
  } else if (c === '42501' || /row-level security/i.test(m)) {
    salida = 'No tienes permiso para hacer eso.';
  } else if (c === 'PT429' || e?.status === 429 || /rate limit/i.test(m)) {
    salida = (m && !/rate limit/i.test(m)) ? m : 'Demasiados intentos seguidos. Espera un momento.';
  } else if (/invalid login credentials/i.test(m)) {
    salida = 'El correo o la contrasena no son correctos.';
  } else if (/email not confirmed/i.test(m)) {
    salida = 'Confirma tu correo antes de entrar.';
  } else if (/failed to fetch|networkerror|load failed/i.test(m)) {
    salida = 'Sin conexion. Lo guardado sigue aqui; se enviara al volver.';
  } else {
    salida = m || 'Algo ha fallado.';
  }

  const err = new Error(salida);
  (err as any).code = c;
  (err as any).original = m;
  return err;
}

// ---- Plantillas publicadas por la gente ----

export interface PlantillaPublica {
  id: string;
  nombre: string;
  ajustes: AjustesPlantilla;
  usos: number;
  creado: string;
  mia: boolean;
  /** Quien la publico. Vacio si su perfil ya no esta activo. */
  autor: string;
  autorAvatar: string;
  autorNombre: string;
  /** El perfil de su autor, saneado, para poder pintar una previa de
   *  verdad en vez de un maniqui. Nulo si su perfil ya no esta activo. */
  autorPerfil: Profile | null;
}

/** Las publicadas, las mas usadas primero. */
export async function listarPlantillas(): Promise<PlantillaPublica[]> {
  if (!supabase) return [];
  /* Se ata a una constante: dentro de la funcion de abajo, TypeScript ya
     no puede saber que el `if` de arriba sigue valiendo. */
  const db = supabase;
  /* `usuario` la añade la migracion 0014. Si aun no esta aplicada, pedirla
     rompe la consulta entera y con ella una pagina que hoy funciona. Se
     reintenta sin ella: se pierden las previas —que es justo lo que esa
     migracion viene a arreglar— y lo demas sigue en pie. Un despliegue no
     tiene por que dejar la pagina rota mientras se aplica el SQL. */
  const pedir = (cols: string) =>
    db
      .from('plantillas')
      .select(cols)
      .eq('estado', 'activa')
      .order('usos', { ascending: false })
      .order('creado', { ascending: false })
      .limit(60);

  /* Con la lista de columnas en una variable, el cliente ya no puede
     deducir la forma de la fila, asi que se declara aqui. Todo lo que
     entra por aqui se convierte campo a campo mas abajo. */
  type FilaPlantilla = {
    id: string; nombre: string; ajustes: unknown; usos: number;
    creado: string; dueno: string; usuario?: string | null;
  };

  let r = await pedir('id, nombre, ajustes, usos, creado, dueno, usuario');
  if (r.error) r = await pedir('id, nombre, ajustes, usos, creado, dueno');
  if (r.error) throw traducir(r.error);
  const data = (r.data ?? []) as unknown as FilaPlantilla[];

  const u = await usuario().catch(() => null);

  /* El perfil de cada autor, para poder pintar una previa de verdad.
     Se busca por NOMBRE DE USUARIO en `perfiles_publicos`, no por `dueno`
     en `perfiles`: la tabla no se lee desde fuera, y la vista —que es lo
     que hay— da la apariencia entera pero a proposito no da `dueno`,
     porque eso ataria cada perfil a una cuenta de acceso.

     El nombre lo trae la propia plantilla, puesto por un disparador al
     publicar y perseguido por otro si su autor se lo cambia. Copiarlo a
     mano y confiar en acordarse era la version que se rompia sola. */
  const usuarios = [...new Set(data.map((f) => String(f.usuario ?? '')).filter(Boolean))];
  const autores = new Map<
    string,
    { username: string; avatar: string; nombre: string; perfil: Profile }
  >();
  if (usuarios.length) {
    const { data: perfiles } = await db
      .from('perfiles_publicos')
      .select('username, apariencia')
      .in('username', usuarios);
    for (const p of perfiles ?? []) {
      const ap = (p.apariencia ?? {}) as Record<string, unknown>;
      /* `apariencia` es un JSON que escribio otra persona. Va por el mismo
         saneado que el perfil publico ANTES de que nadie lo pinte: un
         perfil ajeno sin sanear acaba siendo HTML y CSS de esta pagina. */
      autores.set(String(p.username).toLowerCase(), {
        username: String(p.username ?? ''),
        avatar: String(ap.avatarUrl ?? ''),
        nombre: String(ap.name ?? ''),
        perfil: normalizarPerfil({ ...ap, username: p.username }),
      });
    }
  }

  return data.map((f) => {
    const a = autores.get(String(f.usuario ?? '').toLowerCase());
    return {
      id: String(f.id),
      nombre: String(f.nombre ?? ''),
      /* Esta fila la escribio otra persona: se filtra antes de que toque
         nada, no al aplicarla. */
      ajustes: extraerPlantilla((f.ajustes ?? {}) as Partial<Profile>),
      usos: Number(f.usos ?? 0),
      creado: String(f.creado ?? ''),
      mia: !!u && f.dueno === u.id,
      autor: a?.username ?? '',
      autorAvatar: a?.avatar ?? '',
      autorNombre: a?.nombre ?? '',
      autorPerfil: a?.perfil ?? null,
    };
  });
}

/** Publica el aspecto del perfil que se le pase. Nunca su contenido. */
export async function publicarPlantilla(nombre: string, perfil: Partial<Profile>) {
  if (!supabase) throw new Error('sin backend');
  const u = await usuario();
  if (!u) throw new Error('Hay que entrar en la cuenta para publicar una plantilla');

  const limpio = nombre.trim().slice(0, 40);
  if (limpio.length < 2) throw new Error('Ponle un nombre de al menos dos letras');

  /* El filtro se hace aqui y no en la pagina: asi da igual desde donde se
     llame, nunca sale del navegador nada que no sea aspecto. */
  const ajustes = extraerPlantilla(perfil);

  const { error } = await supabase
    .from('plantillas')
    .insert({ dueno: u.id, nombre: limpio, ajustes });
  if (error) throw traducir(error);
  return true;
}

/** Suma un uso. Va por RPC porque el contador no lo escribe el navegador. */
export async function usarPlantilla(id: string) {
  if (!supabase || !id) return false;
  try {
    await supabase.rpc('usar_plantilla', { p_id: id });
    return true;
  } catch {
    /* Que no se pueda contar no es motivo para no dejarte usarla. */
    return false;
  }
}

export async function borrarPlantilla(id: string) {
  if (!supabase) throw new Error('sin backend');
  const { error } = await supabase.from('plantillas').delete().eq('id', id);
  if (error) throw traducir(error);
  return true;
}
