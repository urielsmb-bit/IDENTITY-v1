import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
/* De `publico` y no del SDK. Esto lo monta `App.tsx` en el arranque, asi
   que preguntar aqui «hay servidor?» importando el cliente de Supabase
   metia sus 55 kB en la carga inicial de TODAS las rutas —incluidas las
   que ni siquiera estan protegidas— por un booleano que sale de la
   configuracion. */
import { hayBackend as hasBackend } from '@/lib/publico';
import type { ReactNode } from 'react';

/**
 * Wraps routes that require an active Supabase session.
 * Redirects to /entrar with a `volver` query param to return after login.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, initialized } = useAuthStore();
  const location = useLocation();

  // Sin backend configurado el proyecto trabaja sólo en local:
  // no hay sesión que exigir.
  if (!hasBackend()) return <>{children}</>;

  // Wait until auth state is known
  if (!initialized) {
    return <div className="cargando" aria-busy="true" />;
  }

  if (!session) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/entrar?volver=${returnTo}`} replace />;
  }

  return <>{children}</>;
}
