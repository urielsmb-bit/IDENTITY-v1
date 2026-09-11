import { supabase } from './supabase';
import { traducir } from './backend';

/**
 * Repartir insignias.
 *
 * Todo pasa por funciones de la base que comprueban el permiso DENTRO. Aquí
 * no hay ni una decisión de seguridad: si alguien llama a `conceder` sin ser
 * de los que reparten, la base contesta 42501 y no se escribe nada. Esta
 * capa solo traduce.
 *
 * Esa es la parte importante y por eso se dice aquí: esconder el panel NO es
 * la protección. El panel se esconde porque enseñarle a todo el mundo un
 * botón que no va a funcionar es una mala interfaz, no porque esconderlo
 * impida nada. Cualquiera puede abrir la consola y llamar a la RPC; lo que
 * lo para es `es_admin()` dentro de la función.
 */

/** ¿Puede quien ha entrado repartir insignias? */
export async function soyAdmin(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc('es_admin');
    if (error) return false;
    return data === true;
  } catch {
    /* La 0023 todavía sin aplicar: no hay función, no hay panel. */
    return false;
  }
}

export interface ConcesionAdmin {
  insignia: string;
  concedida: string;
  /** El id de la cuenta que la dio. Vacío si esa cuenta ya no está. */
  por: string | null;
  nota: string | null;
}

/** Lo que tiene concedido un perfil, con quién se lo dio y por qué. */
export async function insigniasDeAdmin(username: string): Promise<ConcesionAdmin[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('insignias_de_admin', {
    p_username: username,
  });
  if (error) throw traducir(error);
  return (data ?? []) as ConcesionAdmin[];
}

export async function concederInsignia(
  username: string,
  insignia: string,
  nota?: string,
): Promise<void> {
  if (!supabase) throw new Error('sin backend');
  const { error } = await supabase.rpc('conceder_insignia', {
    p_username: username,
    p_insignia: insignia,
    p_nota: nota ?? null,
  });
  if (error) throw traducir(error);
}

export async function retirarInsignia(
  username: string,
  insignia: string,
  nota?: string,
): Promise<void> {
  if (!supabase) throw new Error('sin backend');
  const { error } = await supabase.rpc('retirar_insignia', {
    p_username: username,
    p_insignia: insignia,
    p_nota: nota ?? null,
  });
  if (error) throw traducir(error);
}

/**
 * Busca un perfil por su nombre de usuario.
 *
 * De la vista pública, que es la que se lee desde fuera: para repartir una
 * insignia no hace falta ver nada que no vea cualquiera. Devuelve null si no
 * hay nadie con ese nombre, que es lo que el panel necesita saber antes de
 * enseñar diecisiete interruptores.
 */
export async function buscarPerfil(
  username: string,
): Promise<{ username: string; name: string; avatarUrl: string } | null> {
  if (!supabase) return null;
  const limpio = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!limpio) return null;

  const { data, error } = await supabase
    .from('perfiles_publicos')
    .select('username, apariencia')
    .eq('username', limpio)
    .maybeSingle();

  if (error || !data) return null;
  const ap = (data.apariencia ?? {}) as Record<string, unknown>;
  return {
    username: String(data.username ?? ''),
    name: String(ap.name ?? ''),
    avatarUrl: String(ap.avatarUrl ?? ''),
  };
}
