import { Routes, Route, Outlet, Navigate, useParams } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Toast } from './components/layout/Toast';
import { Frontera } from './components/layout/Frontera';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Pages — lazy loaded for code splitting
import { lazy, Suspense } from 'react';

/**
 * `/u/<usuario>` lleva a `/<usuario>`.
 *
 * `replace` y no un enlace normal: quien llegue por la direccion vieja no
 * debe quedarse con ella en el historial, o al pulsar «atras» desde el
 * perfil volveria a la redireccion y de ahi al perfil otra vez, sin poder
 * salir.
 */
function RedirigirPerfil() {
  const { username = '' } = useParams();
  return <Navigate to={`/${encodeURIComponent(username)}`} replace />;
}

const LandingPage = lazy(() => import('./pages/LandingPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const ProbarPlantillaPage = lazy(() => import('./pages/ProbarPlantillaPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));

import { useAuthInit } from './hooks/useAuth';

function LoadingFallback() {
  return <div className="cargando" aria-busy="true" />;
}

/**
 * Las paginas de sharee, con su barra.
 *
 * El perfil publico se queda fuera a proposito: ahi la barra tapaba el
 * disenio con nuestro logo y nuestro menu, y la pagina de alguien no es el
 * sitio para nuestra navegacion. Quien llega a un perfil viene por esa
 * persona, no por nosotros.
 */
function ConBarra() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}

export default function App() {
  useAuthInit();

  return (
    <>
      <main id="view" className="view" tabIndex={-1}>
        {/* La ultima red. Si una pagina revienta, se ve que reviento en vez
            de una pantalla en blanco, y la barra sigue ahi para irse a otro
            sitio. */}
        <Frontera donde="esta página">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* La direccion de un perfil es `sharee.fun/<usuario>`, a secas.
                `/u/<usuario>` fue la de antes y sigue viva como REDIRECCION:
                esos enlaces estan pegados en biografias de Discord y de
                Instagram desde hace meses, y romperlos por cambiar de forma
                seria cobrarle el cambio a quien ya te habia enlazado. */}
            <Route path="/u/:username" element={<RedirigirPerfil />} />

            <Route element={<ConBarra />}>
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="/entrar" element={<AuthPage />} />
            <Route path="/top" element={<LeaderboardPage />} />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/plantillas" element={<TemplatesPage />} />
            {/* Igual que arriba: la de antes, redirigida. */}
            <Route path="/templates" element={<Navigate to="/plantillas" replace />} />
            {/* Antes que `/:username`, o «probar» se leeria como el nombre
                de alguien. */}
            <Route path="/probar/:id" element={<ProbarPlantillaPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/terminos" element={<LegalPage />} />
            <Route path="/privacidad" element={<LegalPage />} />
            <Route path="/copyright" element={<LegalPage />} />
            </Route>

            {/* Un solo segmento que no sea ninguna de las rutas de arriba se
                trata como un nombre de usuario. Va fuera del grupo con barra
                por lo mismo: es un perfil. */}
            <Route path="/:username" element={<ProfilePage />} />
          </Routes>
        </Suspense>
        </Frontera>
      </main>
      <Toast />
    </>
  );
}
