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
  discordUser: 'sharkiii', discordName: 'Uriel',
  discordAvatar: 'https://cdn.discordapp.com/avatars/1/abc.png',
  gateText: 'contraseña: 1234',
  socials: [{ net: 'x', user: 'shark' }],
  links: [{ label: 'mi web', url: 'https://ejemplo.com' }],
  projects: [{ title: 'proyecto' }],
  gallery: [{ url: 'https://x/foto.jpg' }],
  tags: ['dev'],
  views: 11, verified: true,
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
    'discordUser', 'discordName', 'discordAvatar',
    'socials', 'links', 'projects', 'gallery', 'tags',
    'views', 'verified',
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

  it('NO se lleva un archivo SUBIDO, y NO dice nada del fondo', () => {
    const s = extraerPlantilla({
      bgType: 'image',
      bgValue: 'https://x.supabase.co/storage/v1/object/public/media/uid/fondo.png',
    } as Partial<Profile>);
    expect(s).not.toHaveProperty('bgType');
    expect(s).not.toHaveProperty('bgValue');
  });

  it('SI se lleva un video enlazado de fuera, con su proporcion', () => {
    const s = extraerPlantilla({
      bgType: 'video', bgValue: 'https://vimeo.com/1', bgRatio: 2.35,
    } as Partial<Profile>);
    expect(s.bgType).toBe('video');
    expect(s.bgValue).toBe('https://vimeo.com/1');
    expect(s.bgRatio).toBe(2.35);
  });

  it('un fondo que solo vive en su navegador no viaja', () => {
    for (const v of ['media:abc-123', 'blob:http://x/1', 'data:image/png;base64,AAAA']) {
      const s = extraerPlantilla({ bgType: 'image', bgValue: v } as Partial<Profile>);
      expect(s).not.toHaveProperty('bgValue');
    }
  });

  it('«sin fondo» elegido a proposito SI viaja', () => {
    const s = extraerPlantilla({ bgType: 'none', bgValue: '' } as Partial<Profile>);
    expect(s.bgType).toBe('none');
  });

  /* La portada del video es otro archivo y va atada al fondo: sin esta
     regla, una plantilla podria llevarse la foto y no el video, y quien la
     aplicara veria una imagen fija que nadie puso ahi. */
  it('la portada viaja CON el video, no sola', () => {
    const s = extraerPlantilla({
      bgType: 'video',
      bgValue: 'https://vimeo.com/1',
      bgPoster: 'https://cdn.ajeno.com/p.webp',
    } as Partial<Profile>);
    expect(s.bgValue).toBe('https://vimeo.com/1');
    expect(s.bgPoster).toBe('https://cdn.ajeno.com/p.webp');
  });

  it('si el video no viaja, la portada tampoco', () => {
    const s = extraerPlantilla({
      bgType: 'video',
      bgValue: 'https://x.supabase.co/storage/v1/object/public/media/uid/f.mp4',
      bgPoster: 'https://cdn.ajeno.com/p.webp',
    } as Partial<Profile>);
    expect(s).not.toHaveProperty('bgValue');
    expect(s).not.toHaveProperty('bgPoster');
  });

  /* Y una portada que es un archivo NUESTRO tampoco sale, aunque el video
     si: es una direccion fija que su dueno reescribe, asi que el dia que
     cambie de fondo le cambia la portada a todo el que use la plantilla. */
  it('una portada subida al cubo no viaja aunque el video si', () => {
    const s = extraerPlantilla({
      bgType: 'video',
      bgValue: 'https://vimeo.com/1',
      bgPoster: 'https://x.supabase.co/storage/v1/object/public/media/uid/poster.webp',
    } as Partial<Profile>);
    expect(s.bgValue).toBe('https://vimeo.com/1');
    expect(s).not.toHaveProperty('bgPoster');
  });
});

describe('aplicarPlantilla · el fondo de quien la usa', () => {
  const conVideo = {
    username: 'yo', theme: 'minimal',
    bgType: 'video', bgValue: 'https://vimeo.com/999',
  } as unknown as Profile;

  it('una plantilla cuyo autor tenia una foto SUYA no me borra mi video', () => {
    const dePlantilla = extraerPlantilla({
      theme: 'gaming',
      bgType: 'image',
      bgValue: 'https://x.supabase.co/storage/v1/object/public/media/otro/fondo.png',
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
      'socials', 'links', 'projects', 'gallery', 'tags', 'title',
      'location', 'pronouns', 'emoji', 'age', 'discordId', 'gateText',
      'discordUser', 'discordName', 'discordAvatar',
      'views', 'verified', 'gate'];
    const cruce = (CAMPOS_PLANTILLA as readonly string[]).filter((c) => prohibidos.includes(c));
    expect(cruce).toEqual([]);
  });
});

/**
 * La frontera de ahora.
 *
 * No es «que clase de cosa es» sino DE QUIEN ES EL ARCHIVO. Un enlace de
 * fuera lo carga cualquiera; un archivo del cubo tiene una direccion fija
 * que su dueño reescribe, asi que repartirlo dentro de una plantilla es
 * apuntar a algo que puede cambiar bajo los pies de todo el mundo.
 */
describe('de quien es el archivo', () => {
  it('el cursor dibujado viaja; el subido, no', () => {
    expect(extraerPlantilla({ cursorImg: 'https://x/flecha.png' } as Partial<Profile>).cursorImg)
      .toBe('https://x/flecha.png');
    expect(
      extraerPlantilla({
        cursorImg: 'https://x.supabase.co/storage/v1/object/public/media/uid/cursor.png',
      } as Partial<Profile>),
    ).not.toHaveProperty('cursorImg');
  });
});

describe('la musica de la plantilla', () => {
  it('se lleva la cancion enlazada, con su titulo y su artista', () => {
    const s = extraerPlantilla({
      audio: {
        provider: 'spotify', src: 'spotify', title: '', artist: '', cover: '',
        yt: '', ytUrl: '',
        tracks: [{
          title: 'HAD-U-KEN', artist: 'Glokky', length: '2:41',
          cover: 'https://i.scdn.co/image/abc',
          src: 'spotify', yt: '', preview: '', url: '',
          embed: 'https://open.spotify.com/embed/track/abc',
        }],
      },
    } as unknown as Partial<Profile>);
    expect(s.audio?.tracks?.[0]?.title).toBe('HAD-U-KEN');
    expect(s.audio?.tracks?.[0]?.artist).toBe('Glokky');
    expect(s.audio?.tracks?.[0]?.embed).toBe('https://open.spotify.com/embed/track/abc');
  });

  it('una pista que solo sonaba con un archivo suyo se cae entera', () => {
    const s = extraerPlantilla({
      audio: {
        tracks: [{
          title: 'mi grabacion', artist: '', length: '', cover: '',
          src: 'manual', yt: '', preview: '', embed: '',
          url: 'https://x.supabase.co/storage/v1/object/public/media/uid/cancion.mp3',
        }],
      },
    } as unknown as Partial<Profile>);
    expect(s).not.toHaveProperty('audio');
  });

  it('sin nada sonable la plantilla NO habla de musica, y no borra la mia', () => {
    const mia = {
      username: 'yo',
      audio: { tracks: [{ title: 'la mia', yt: 'abc123' }] },
    } as unknown as Profile;
    const r = aplicarPlantilla(mia, extraerPlantilla({ theme: 'gaming' } as Partial<Profile>));
    expect(r.audio?.tracks?.[0]?.title).toBe('la mia');
  });

  it('una fila manipulada no cuela un enlace de esos que no se cargan', () => {
    const s = extraerPlantilla({
      audio: {
        tracks: [{ title: 'x', src: 'manual', url: 'javascript:alert(1)', yt: 'ok123' }],
      },
    } as unknown as Partial<Profile>);
    expect(s.audio?.tracks?.[0]?.url).toBe('');
    expect(s.audio?.tracks?.[0]?.yt).toBe('ok123');
  });
});
