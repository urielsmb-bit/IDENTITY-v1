export function esc(str: any): string {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeMedia(u: any): string {
  const str = String(u || '');
  return /^(https?:|data:image\/|blob:|media:)/i.test(str) ? str : '';
}

export function safeUrl(u: any): string {
  const str = String(u || '').trim();
  if (!str) return '#';
  if (/^(https?:|mailto:|tel:|#)/i.test(str)) return str;
  if (/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(str)) return 'https://' + str;
  return '#';
}

export function tipoBloque(id: any): string {
  const str = String(id || '');
  const i = str.indexOf('#');
  return i === -1 ? str : str.slice(0, i);
}

export function esCopia(id: any): boolean {
  return String(id || '').indexOf('#') !== -1;
}

export function nuevaCopia(tipo: string, lista: string[]): string {
  let n = 2;
  while (lista.includes(`${tipo}#${n}`)) n++;
  return `${tipo}#${n}`;
}

export function slug(s: any): string {
  return String(s || '').toLowerCase().trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '')
    .slice(0, 24);
}

export function num(n: any): string {
  const numValue = Number(n) || 0;
  if (numValue >= 1e6) return (numValue / 1e6).toFixed(numValue % 1e6 === 0 ? 0 : 1) + 'M';
  if (numValue >= 1e3) return (numValue / 1e3).toFixed(numValue % 1e3 === 0 ? 0 : 1) + 'K';
  return String(numValue);
}

export function full(n: any): string {
  return (Number(n) || 0).toLocaleString('es-CO');
}

export function seed(str: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return function () {
    h += 0x6D2B79F5;
    h |= 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function read<T>(k: string, dflt: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : dflt;
  } catch {
    return dflt;
  }
}

export let ultimoError: { code: string; message: string } | null = null;

export function errorDeEscritura(e: any): { code: string; message: string } {
  const n = (e && e.name) || '';
  const c = e && e.code;
  if (n === 'QuotaExceededError' || n === 'NS_ERROR_DOM_QUOTA_REACHED' || c === 22 || c === 1014) {
    return {
      code: 'lleno',
      message: 'No queda espacio en este navegador. Quita una imagen o un video pesado y vuelve a intentarlo.'
    };
  }
  if (n === 'SecurityError' || n === 'InvalidAccessError') {
    return {
      code: 'bloqueado',
      message: 'Este navegador no permite guardar datos aqui (modo privado o permisos bloqueados).'
    };
  }
  return {
    code: 'fallo',
    message: 'No se pudo guardar: ' + ((e && e.message) || 'error desconocido')
  };
}

export function write(k: string, v: any): boolean {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    ultimoError = null;
    return true;
  } catch (e) {
    ultimoError = errorDeEscritura(e);
    return false;
  }
}
