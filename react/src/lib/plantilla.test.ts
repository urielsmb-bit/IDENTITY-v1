import { describe, it, expect } from 'vitest';
import { extraerPlantilla, aplicarPlantilla, CAMPOS_PLANTILLA } from './plantilla';
import type { Profile } from '@/types';

/**
 * Pruebas de la lista blanca de plantillas.
 *
 * Aqui lo que se prueba no es que funcione: es que NO se escape nada. Una
 * plantilla acaba en una tabla publica que lee cualquiera, asi que un
 * campo de mas no es un fallo de dibujo, es publicar la biografia o el
 * avatar de alguien sin que se entere.
 */
const PERSONAL = {
  username: 'shark', name: 'Uriel', title: 'Dev', location: 'Medellín',
  pronouns: 'el', emoji: '🦈', age: 22, bio: 'hola', about: 'texto largo',
  avatarUrl: 'https://x.supabase.co/storage/v1/object/public/media/uid/avatar.png',
  joined: '2026-01-01', discordId: '123456789012345678',
  gateText: 'contraseña: 1234', cursorImg: 'https://x/mi-cursor.png',
  socials: [{ net: 'x', user: 'shark' }],
  links: [{ label: 'mi web', url: 'https://ejemplo.com' }],
  projects: [{ title: 'proyecto' }],
  gallery: [{ url: 'https://x/foto.jpg' }],
  tags: ['dev'],
  audio: { url: 'https://x/cancion.mp3' },
  views: 11, nota: 4.5, numNotas: 2, verified: true,
} as unknown as Partial<Profile>;

const DISENO = {
  theme: 'cyberpunk', accent: '#22D3EE', surface: 'glass',
  particles: 'matrix', font: 'space', gap: 16, radius: 18,
  glowName: true, blockOrder: ['a', 'b'], pos: { a: { x: 1, y: 2 } },
} as unknown as Partial<Profile>;

describe('extraerPlantilla · lo que NO puede salir', () => {
  const salida = extraerPlantilla({ ...PERSONAL, ...DISENO });

  for (const campo of [
    'username', 'name', 'title', 'location', 'pronouns', 'emoji', 'age',
    'bio', 'about', 'avatarUrl', 'joined', 'discordId', 'gateText',
    'cursorImg', 'socials', 'links', 'projects', 'gallery', 'tags', 'audio',
    'views', 'nota', 'numNotas', 'verified',
  ]) {
    it(`no publica «${campo}»`, () => {
      expect(salida).not.toHaveProperty(campo);
    });
  }
});

describe('extraerPlantilla · lo que si lleva', () => {
  it('lleva el aspecto', () => {
    const s = extraerPlantilla({ ...PERSONAL, ...DISENO });
    expect(s.theme).toBe('cyberpunk');
    expect(s.accent).toBe('#22D3EE');
    expect(s.gap).toBe(16);
    expect(s.glowName).toBe(true);
  });

  it('lleva la colocacion, o una rejilla libre no se pareceria', () => {
    const s = extraerPlantilla({ ...PERSONAL, ...DISENO });
    expect(s.blockOrder).toEqual(['a', 'b']);
    expect(s.pos).toEqual({ a: { x: 1, y: 2 } });
  });

  it('no inventa campos que el perfil no tenia', () => {
    const s = extraerPlantilla({ theme: 'gaming' } as Partial<Profile>);
    expect(Object.keys(s)).toEqual(['theme']);
  });
});

describe('extraerPlantilla · el fondo', () => {
  it('deja pasar un color', () => {
    const s = extraerPlantilla({ bgType: 'color', bgValue: '#101010' } as Partial<Profile>);
    expect(s.bgType).toBe('color');
    expect(s.bgValue).toBe('#101010');
  });

  it('deja pasar un degradado', () => {
    const s = extraerPlantilla({ bgType: 'gradient', bgValue: 'a,b' } as Partial<Profile>);
    expect(s.bgType).toBe('gradient');
  });

  it('NO se lleva la imagen de nadie, y NO dice nada del fondo', () => {
    const s = extraerPlantilla({
      bgType: 'image',
      bgValue: 'https://x.supabase.co/storage/v1/object/public/media/uid/fondo.png',
    } as Partial<Profile>);
    expect(s).not.toHaveProperty('bgType');
    expect(s).not.toHaveProperty('bgValue');
  });

  it('NO se lleva el video de nadie, y NO dice nada del fondo', () => {
    const s = extraerPlantilla({ bgType: 'video', bgValue: 'https://vimeo.com/1' } as Partial<Profile>);
    expect(s).not.toHaveProperty('bgType');
    expect(s).not.toHaveProperty('bgValue');
  });

  it('«sin fondo» elegido a proposito SI viaja', () => {
    const s = extraerPlantilla({ bgType: 'none', bgValue: '' } as Partial<Profile>);
    expect(s.bgType).toBe('none');
  });
});

describe('aplicarPlantilla · el fondo de quien la usa', () => {
  const conVideo = {
    username: 'yo', theme: 'minimal',
    bgType: 'video', bgValue: 'https://vimeo.com/999',
  } as unknown as Profile;

  it('una plantilla cuyo autor tenia foto NO me borra mi video', () => {
    const dePlantilla = extraerPlantilla({
      theme: 'gaming', bgType: 'image', bgValue: 'https://x/suyo.png',
    } as Partial<Profile>);
    const r = aplicarPlantilla(conVideo, dePlantilla);
    expect(r.theme).toBe('gaming');
    expect(r.bgType).toBe('video');
    expect(r.bgValue).toBe('https://vimeo.com/999');
  });

  it('pero si su autor eligio «sin fondo», eso si manda', () => {
    const dePlantilla = extraerPlantilla({ theme: 'gaming', bgType: 'none' } as Partial<Profile>);
    const r = aplicarPlantilla(conVideo, dePlantilla);
    expect(r.bgType).toBe('none');
  });
});

describe('aplicarPlantilla', () => {
  const mio = {
    username: 'yo', name: 'Yo', bio: 'mi bio', theme: 'minimal',
    accent: '#FFFFFF', links: [{ label: 'mio', url: 'https://mio' }],
  } as unknown as Profile;

  it('cambia el aspecto y respeta lo mio', () => {
    const r = aplicarPlantilla(mio, { theme: 'gaming', accent: '#ED4245' });
    expect(r.theme).toBe('gaming');
    expect(r.accent).toBe('#ED4245');
    expect(r.name).toBe('Yo');
    expect(r.bio).toBe('mi bio');
    expect(r.links).toEqual([{ label: 'mio', url: 'https://mio' }]);
  });

  it('una fila manipulada no puede pisar mi nombre ni mis enlaces', () => {
    // Esa fila la escribio otra persona: se filtra otra vez al aplicarla.
    const r = aplicarPlantilla(mio, {
      theme: 'gaming',
      name: 'SUPLANTADO', bio: 'texto ajeno',
      links: [{ label: 'phishing', url: 'https://malo' }],
    } as unknown as Partial<Profile>);
    expect(r.theme).toBe('gaming');
    expect(r.name).toBe('Yo');
    expect(r.bio).toBe('mi bio');
    expect(r.links).toEqual([{ label: 'mio', url: 'https://mio' }]);
  });

  it('aguanta null y basura sin romperse', () => {
    expect(aplicarPlantilla(mio, null)).toBe(mio);
    expect(aplicarPlantilla(mio, undefined)).toBe(mio);
    expect(aplicarPlantilla(mio, 'texto' as never)).toBe(mio);
  });
});

describe('la lista blanca', () => {
  it('no nombra ningun campo de contenido', () => {
    const prohibidos = ['username', 'name', 'bio', 'about', 'avatarUrl',
      'socials', 'links', 'projects', 'gallery', 'tags', 'audio', 'title',
      'location', 'pronouns', 'emoji', 'age', 'discordId', 'gateText',
      'cursorImg', 'views', 'verified', 'gate'];
    const cruce = (CAMPOS_PLANTILLA as readonly string[]).filter((c) => prohibidos.includes(c));
    expect(cruce).toEqual([]);
  });
});
