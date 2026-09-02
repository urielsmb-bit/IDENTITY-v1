const BASE = 'identity.media';
const TIENDA = 'archivos';
const PREFIJO = 'media:';

const LIMITE_CACHE = 8;
let cache: Record<string, string> = {};
let orden: string[] = [];
let base: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (base) return base;
  base = new Promise((ok, mal) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      mal(new Error('Este navegador no tiene IndexedDB'));
      return;
    }
    const pet = indexedDB.open(BASE, 1);
    pet.onupgradeneeded = () => {
      if (!pet.result.objectStoreNames.contains(TIENDA)) {
        pet.result.createObjectStore(TIENDA);
      }
    };
    pet.onsuccess = () => { ok(pet.result); };
    pet.onerror = () => { mal(pet.error || new Error('No se pudo abrir el almacén')); };
    pet.onblocked = () => { mal(new Error('El almacén está bloqueado por otra pestaña')); };
  });
  base.catch(() => { base = null; });
  return base;
}

function conTienda<T>(modo: IDBTransactionMode, fn: (t: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return abrir().then(db => {
    return new Promise((ok, mal) => {
      const t = db.transaction(TIENDA, modo);
      const pet = fn(t.objectStore(TIENDA));
      t.oncomplete = () => { ok(pet ? (pet.result as T) : undefined); };
      t.onerror = () => { mal(t.error); };
      t.onabort = () => { mal(t.error || new Error('transacción cancelada')); };
    });
  });
}

function recordar(ref: string, url: string) {
  if (cache[ref]) URL.revokeObjectURL(cache[ref]);
  cache[ref] = url;
  const i = orden.indexOf(ref);
  if (i > -1) orden.splice(i, 1);
  orden.push(ref);
  while (orden.length > LIMITE_CACHE) {
    const viejo = orden.shift();
    if (viejo && cache[viejo]) {
      URL.revokeObjectURL(cache[viejo]);
      delete cache[viejo];
    }
  }
}

export function disponible(): boolean {
  return typeof window !== 'undefined' && !!window.indexedDB;
}

export function esRef(v: any): boolean {
  return typeof v === 'string' && v.indexOf(PREFIJO) === 0;
}

export function nuevaRef(): string {
  return PREFIJO + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export async function guardar(blob: Blob): Promise<string> {
  const ref = nuevaRef();
  await conTienda('readwrite', t => t.put(blob, ref));
  recordar(ref, URL.createObjectURL(blob));
  return ref;
}

export async function obtener(ref: string): Promise<Blob | null> {
  if (!esRef(ref)) return null;
  try {
    const b = await conTienda<Blob>('readonly', t => t.get(ref));
    return b || null;
  } catch {
    return null;
  }
}

export async function borrar(ref: string): Promise<boolean> {
  if (!esRef(ref)) return false;
  if (cache[ref]) {
    URL.revokeObjectURL(cache[ref]);
    delete cache[ref];
    const i = orden.indexOf(ref);
    if (i > -1) orden.splice(i, 1);
  }
  try {
    await conTienda('readwrite', t => t.delete(ref));
    return true;
  } catch {
    return false;
  }
}

export async function claves(): Promise<string[]> {
  try {
    const k = await conTienda<string[]>('readonly', t => (t as any).getAllKeys());
    return k || [];
  } catch {
    return [];
  }
}

export function refsDe(p: any): string[] {
  const out: string[] = [];
  const visto: Record<string, boolean> = {};
  try {
    const txt = JSON.stringify(p) || '';
    const re = /media:[a-z0-9]+-[a-z0-9]+/g;
    let m;
    while ((m = re.exec(txt))) {
      if (!visto[m[0]]) {
        visto[m[0]] = true;
        out.push(m[0]);
      }
    }
  } catch {
    // ignorar
  }
  return out;
}

export async function precargar(p: any) {
  const refs = refsDe(p).filter(r => !cache[r]);
  if (!refs.length || !disponible()) {
    return { cargados: 0, faltan: [] };
  }
  const faltanBruto = await Promise.all(refs.map(async r => {
    const b = await obtener(r);
    if (b) {
      recordar(r, URL.createObjectURL(b));
      return null;
    }
    return r;
  }));
  const faltan = faltanBruto.filter(Boolean) as string[];
  return { cargados: refs.length - faltan.length, faltan };
}

export function url(ref: string): string {
  if (!esRef(ref)) return '';
  const u = cache[ref];
  if (u) {
    const i = orden.indexOf(ref);
    if (i > -1) {
      orden.splice(i, 1);
      orden.push(ref);
    }
  }
  return u || '';
}

export function resolver(valor: string): string {
  return esRef(valor) ? url(valor) : (valor || '');
}

export function soltar() {
  orden.forEach(r => { if (cache[r]) URL.revokeObjectURL(cache[r]); });
  cache = {};
  orden = [];
}

export async function recolectar(protegidas?: string[], storeLocalFn?: () => Record<string, any>) {
  const enUso: Record<string, boolean> = {};
  (protegidas || []).forEach(r => { enUso[r] = true; });
  
  if (storeLocalFn) {
    const locales = storeLocalFn();
    Object.keys(locales).forEach(u => {
      refsDe(locales[u]).forEach(r => { enUso[r] = true; });
    });
  }
  
  const todas = await claves();
  const sobran = todas.filter(k => !enUso[k]);
  await Promise.all(sobran.map(k => borrar(k)));
  return { borrados: sobran.length };
}

export async function espacio() {
  if (!navigator.storage || !navigator.storage.estimate) {
    return null;
  }
  try {
    const e = await navigator.storage.estimate();
    if (e.usage === undefined || e.quota === undefined) return null;
    return {
      usadoMB: +(e.usage / 1048576).toFixed(1),
      cuotaMB: +(e.quota / 1048576).toFixed(1),
      libreMB: +((e.quota - e.usage) / 1048576).toFixed(1),
      pct: e.quota ? +((e.usage / e.quota) * 100).toFixed(1) : 0
    };
  } catch {
    return null;
  }
}

export async function persistir(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persist) return false;
  try {
    const ya = await navigator.storage.persisted();
    return ya ? true : await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function aDataUri(ref: string): Promise<string | null> {
  const b = await obtener(ref);
  if (!b) return null;
  return new Promise(ok => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result as string);
    fr.onerror = () => ok(null);
    fr.readAsDataURL(b);
  });
}

export async function desdeDataUri(uri: string): Promise<string | null> {
  if (typeof uri !== 'string' || uri.indexOf('data:') !== 0) return null;
  try {
    const r = await fetch(uri);
    const b = await r.blob();
    return await guardar(b);
  } catch {
    return null;
  }
}

export async function inflar(p: any): Promise<any> {
  const copia = JSON.parse(JSON.stringify(p));
  const refs = refsDe(copia);
  if (!refs.length) return copia;
  
  const pares = await Promise.all(refs.map(async r => {
    const uri = await aDataUri(r);
    return { ref: r, uri };
  }));
  
  let txt = JSON.stringify(copia);
  pares.forEach(par => {
    txt = txt.split('"' + par.ref + '"').join(JSON.stringify(par.uri || ''));
  });
  
  try {
    return JSON.parse(txt);
  } catch {
    return copia;
  }
}

export async function extraer(p: any, campos?: string[]): Promise<{ movidos: number, liberadoKB: number }> {
  campos = campos || ['bgValue'];
  const tareas = campos.filter(c => typeof p[c] === 'string' && p[c].indexOf('data:video') === 0)
    .map(async c => {
      // Simplistic size estimation since app isn't passed directly:
      // data URI size minus base64 overhead
      const len = p[c].length;
      const liberadoKB = Math.round((len * (3/4)) / 1024);
      
      const ref = await desdeDataUri(p[c]);
      if (ref) {
        p[c] = ref;
        return liberadoKB;
      }
      return 0;
    });
    
  if (!tareas.length) return { movidos: 0, liberadoKB: 0 };
  
  const kbs = await Promise.all(tareas);
  const total = kbs.reduce((a, b) => a + b, 0);
  return { movidos: kbs.filter(Boolean).length, liberadoKB: total };
}
