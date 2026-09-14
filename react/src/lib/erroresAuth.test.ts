import { describe, expect, it } from 'vitest';
import { traducirError, traducirErrorDeEnlace } from './erroresAuth';

/** Un error de Supabase tal y como llega: mensaje en ingles y un codigo. */
const deSupabase = (message: string, code?: string) =>
  Object.assign(new Error(message), code ? { code } : {});

describe('traducirError · entrar y registrarse', () => {
  it('la contrasena equivocada no se cuenta como «usuario no existe»', () => {
    expect(traducirError(deSupabase('Invalid login credentials'))).toContain(
      'no son correctos',
    );
  });

  it('el correo sin confirmar dice DONDE esta el enlace', () => {
    expect(traducirError(deSupabase('Email not confirmed'))).toContain('enlace');
  });

  it('reconoce por codigo aunque cambie el texto', () => {
    /* Esto es lo que protege de verdad: Supabase reescribe sus frases entre
       versiones, y el dia que pase el codigo sigue valiendo. */
    expect(traducirError(deSupabase('something else entirely', 'invalid_credentials'))).toContain(
      'no son correctos',
    );
  });

  it('lo que no reconoce lo devuelve tal cual, no lo tapa', () => {
    expect(traducirError(deSupabase('Postgres exploded'))).toBe('Postgres exploded');
  });

  it('un error sin mensaje no deja la pantalla en blanco', () => {
    expect(traducirError(null)).toBeTruthy();
  });
});

describe('traducirErrorDeEnlace · conectar una cuenta', () => {
  /* El error real que veian quienes entraron con Google y le daban a
     conectar Discord. `linkIdentity` viene apagado de fabrica en Supabase. */
  it('el enlazado manual apagado dice a quien avisar, no que ha pasado por dentro', () => {
    const m = traducirErrorDeEnlace(deSupabase('Manual linking is disabled'), 'discord');
    expect(m).toContain('Discord');
    expect(m).toContain('avísanos');
    expect(m).not.toContain('linking');
  });

  it('lo reconoce tambien por codigo', () => {
    expect(
      traducirErrorDeEnlace(deSupabase('otro texto', 'manual_linking_disabled'), 'google'),
    ).toContain('Google');
  });

  it('una identidad ya usada explica la salida, no solo el problema', () => {
    const m = traducirErrorDeEnlace(
      deSupabase('Identity is already linked to another user', 'identity_already_exists'),
      'discord',
    );
    expect(m).toContain('otra cuenta');
    expect(m).toContain('entra con Discord');
  });

  it('la vuelta a medias de Discord no se confunde con un fallo de la cuenta', () => {
    expect(traducirErrorDeEnlace(deSupabase('invalid state', 'bad_oauth_state'))).toContain(
      'pestaña',
    );
  });

  it('sin proveedor no escribe «undefined» en la frase', () => {
    const m = traducirErrorDeEnlace(deSupabase('Manual linking is disabled'));
    expect(m).not.toContain('undefined');
    expect(m).toContain('esa cuenta');
  });

  it('lo que no es de enlazar cae en el traductor de siempre', () => {
    expect(traducirErrorDeEnlace(deSupabase('Invalid login credentials'))).toContain(
      'no son correctos',
    );
  });
});
