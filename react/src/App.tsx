import { Routes, Route, Outlet, Navigate, useParams } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Pie } from './components/layout/Pie';
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
/* El panel de quien reparte insignias. Va aparte y no dentro del panel
   normal porque no es una seccion del editor: no edita tu perfil, edita
   el de otra persona. */
const AdminPage = lazy(() => import('./pages/AdminPage'));

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

/**
 * Las páginas que además llevan pie.
 *
 * No es lo mismo que «las que llevan barra». El panel y las analíticas la
 * llevan porque hay que poder salir de ellas, pero son PANTALLAS DE
 * TRABAJO: ocupan el alto entero, se desplazan por dentro, y un pie con
 * «Términos del servicio» debajo del editor sólo estorba. Lo mismo con la
 * prueba de una plantilla a pantalla completa.
 *
 * Aquí están las páginas que se LEEN: la portada, los planes, el ranking,
 * la galería y los tres documentos legales. En esas, no tener pie es lo
 * que se nota — un documento legal que termina y no ofrece a dónde ir es
 * un callejón.
 */
function ConPie() {
  return (
    <>
      <Outlet />
      <Pie />
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
            {/* Las de trabajo: barra si, pie no. Ocupan el alto entero y
                se desplazan por dentro. */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="/entrar" element={<AuthPage />} />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            {/* Igual que arriba: la de antes, redirigida. */}
            <Route path="/templates" element={<Navigate to="/plantillas" replace />} />
            {/* Antes que `/:username`, o «probar» se leeria como el nombre
                de alguien. A pantalla completa y sin pie: es una prueba del
                diseño, no una pagina que se lee. */}
            <Route path="/probar/:id" element={<ProbarPlantillaPage />} />

            {/* Y las que se LEEN, que ademas llevan pie. */}
            <Route element={<ConPie />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/top" element={<LeaderboardPage />} />
              <Route path="/plantillas" element={<TemplatesPage />} />
              <Route path="/pricing" element={<PricingPage />} />
            </Route>
            {/* `admin` esta en `nombres_reservados` desde la migracion
                fundacional, asi que nadie puede tener un perfil que
                choque con esta ruta. Quien entre sin permiso ve una
                pagina que dice que no hay nada: el candado de verdad
                esta en `es_admin()`, dentro de la base. */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            {/* Los tres documentos, con pie: uno que termina y no ofrece a
                donde ir es un callejon. */}
            <Route element={<ConPie />}>
              <Route path="/terminos" element={<LegalPage />} />
              <Route path="/privacidad" element={<LegalPage />} />
              <Route path="/copyright" element={<LegalPage />} />
            </Route>
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
