import { supabase, hasBackend } from './supabase';
import { CONFIG } from '@/config';
import { normalizarPerfil } from './normalizar';
import type { Session, User, Provider } from '@supabase/supabase-js';

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

  const { data, error } = await client.from('perfiles_publicos')
    .select('id,username,apariencia,creado,actualizado')
    .eq('username', username)
    .maybeSingle();

  if (error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || ''))) {
    return porLaTabla();
  }
  if (error) throw traducir(error);
  return aPerfil(data);
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

export async function subirMedio(blob: Blob, tipo: string, extension: string) {
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
  
  const pub = supabase.storage.from(cubo).getPublicUrl(ruta);
  const url = pub?.data?.publicUrl;
  if (!url) throw new Error('No se pudo obtener la direccion del archivo');
  return url + '?v=' + Date.now();
}

export async function borrarMedio(tipo: string, extension: string) {
  if (!supabase) return false;
  try {
    const u = await usuario();
    if (!u) return false;
    const cubo = CONFIG.BUCKET_MEDIA;
    const ruta = u.id + '/' + tipo + '.' + extension;
    await supabase.storage.from(cubo).remove([ruta]);
    return true;
  } catch {
    return false;
  }
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
