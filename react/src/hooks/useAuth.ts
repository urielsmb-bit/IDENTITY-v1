import { useEffect } from 'react';
import { supabase, hasBackend } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

/** Los proveedores que IDENTITY ofrece enlazar a una cuenta ya abierta. */
export type ProveedorEnlazable = 'discord' | 'google' | 'spotify' | 'github';

/**
 * Hook that initializes Supabase auth listener on mount.
 * Should be called once in the app root (e.g., App.tsx or main.tsx).
 */
export function useAuthInit() {
  const { setSession, setInitialized } = useAuthStore();

  useEffect(() => {
    if (!hasBackend()) {
      setInitialized();
      return;
    }

    // Get initial session
    supabase?.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized();
    });

    // Listen for auth changes
    const sub = supabase?.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      },
    );

    return () => {
      sub?.data.subscription.unsubscribe();
    };
  }, [setSession, setInitialized]);
}

/**
 * Hook to access auth state and actions.
 */
export function useAuth() {
  const store = useAuthStore();

  const getClient = () => {
    if (!supabase) throw new Error('Supabase no está configurado');
    return supabase;
  };

  const signIn = async (email: string, password: string) => {
    const client = getClient();
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signUp = async (email: string, password: string) => {
    const client = getClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  /**
   * `volverA` es una ruta de esta misma app. Se concatena al origen, nunca
   * se acepta una URL entera: si no, `?volver=https://otro.sitio` convertiria
   * el login en un redirector abierto.
   */
  const signInWithProvider = async (
    provider: 'discord' | 'google',
    volverA = '/dashboard',
  ) => {
    const client = getClient();
    const destino = volverA.startsWith('/') && !volverA.startsWith('//')
      ? volverA
      : '/dashboard';
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin + destino,
      },
    });
    if (error) throw error;
    return data;
  };

  /**
   * Enlaza Discord con la cuenta que ya esta abierta.
   *
   * NO es `signInWithOAuth`: eso cambiaria la sesion a la cuenta de Discord
   * y quien entro por correo se encontraria en otro perfil. `linkIdentity`
   * anade la identidad a la cuenta actual, que es lo que hace falta para
   * poder leer su id y su decoracion.
   */
  const enlazarProveedor = async (
    proveedor: ProveedorEnlazable,
    volverA = '/dashboard',
  ) => {
    const client = getClient();
    const destino = volverA.startsWith('/') && !volverA.startsWith('//')
      ? volverA
      : '/dashboard';
    const { data, error } = await client.auth.linkIdentity({
      provider: proveedor,
      options: { redirectTo: window.location.origin + destino },
    });
    if (error) throw error;
    return data;
  };

  /** Se conserva el nombre viejo: lo usa el bloque de Discord. */
  const enlazarDiscord = (volverA = '/dashboard') =>
    enlazarProveedor('discord', volverA);

  /**
   * Suelta un proveedor de la cuenta.
   *
   * Supabase quiere el objeto identidad entero, no el nombre: una cuenta
   * puede tener dos del mismo proveedor y hay que decir cual. Y se niega a
   * quitar la ultima, que es la red de seguridad que evita quedarse fuera
   * de la propia cuenta; aqui se comprueba antes para poder explicarlo en
   * vez de ensenar el error crudo.
   */
  const desenlazarProveedor = async (proveedor: string) => {
    const client = getClient();
    const { data, error: errLista } = await client.auth.getUserIdentities();
    if (errLista) throw errLista;

    const todas = data?.identities ?? [];
    const cual = todas.find((i) => i.provider === proveedor);
    if (!cual) throw new Error('Esa cuenta ya no esta conectada.');
    if (todas.length < 2) {
      throw new Error(
        'Es la unica forma que tienes de entrar. Conecta otra antes de quitar esta.',
      );
    }

    const { error } = await client.auth.unlinkIdentity(cual);
    if (error) throw error;

    // La sesion en memoria sigue teniendo la identidad recien quitada: sin
    // refrescarla, la pantalla la seguiria dando por conectada.
    await client.auth.refreshSession();
  };

  /**
   * Cierra la sesion en todos los aparatos.
   *
   * `scope: 'global'` invalida TODOS los tokens de refresco del usuario, no
   * solo el de este navegador: es lo que hay que pulsar cuando se sospecha
   * que alguien mas entro.
   */
  const cerrarEnTodos = async () => {
    const client = getClient();
    const { error } = await client.auth.signOut({ scope: 'global' });
    if (error) throw error;
  };

  /**
   * Cambia el correo de la cuenta.
   *
   * No es inmediato y es a proposito: Supabase manda un enlace de
   * confirmacion a la direccion nueva, y hasta que no se pulsa, la vieja
   * sigue siendo la buena. Sin ese paso, cualquiera con la sesion abierta un
   * minuto podria llevarse la cuenta a un correo suyo.
   */
  const cambiarCorreo = async (nuevo: string) => {
    const client = getClient();
    const { error } = await client.auth.updateUser({ email: nuevo });
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const client = getClient();
    // Sin `redirectTo` el enlace del correo deja al usuario en la raiz del
    // sitio, sin nada que le pida la contrasena nueva.
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/entrar',
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const client = getClient();
    const { error } = await client.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  };

  return {
    ...store,
    signIn,
    signUp,
    signInWithProvider,
    enlazarDiscord,
    enlazarProveedor,
    desenlazarProveedor,
    cerrarEnTodos,
    cambiarCorreo,
    resetPassword,
    updatePassword,
  };
}
