/** Conversión hex ↔ RGB para los controles de color del editor. */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const acotar = (v: number) => Math.max(0, Math.min(255, Math.round(v) || 0));

export function hexARgb(hex: string, porDefecto = '#FFFFFF'): Rgb {
  const limpio = /^#[0-9a-f]{6}$/i.test(hex) ? hex : porDefecto;
  const n = parseInt(limpio.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbAHex({ r, g, b }: Rgb): string {
  const c = (v: number) => acotar(v).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export { acotar as acotarCanal };
