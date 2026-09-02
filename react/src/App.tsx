import { Routes, Route } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Toast } from './components/layout/Toast';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Pages — lazy loaded for code splitting
import { lazy, Suspense } from 'react';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const AIPage = lazy(() => import('./pages/AIPage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));

import { useAuthInit } from './hooks/useAuth';

function LoadingFallback() {
  return <div className="cargando" aria-busy="true" />;
}

export default function App() {
  useAuthInit();

  return (
    <>
      <Navbar />
      <main id="view" className="view" tabIndex={-1}>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/u/:username" element={<ProfilePage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="/entrar" element={<AuthPage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/top" element={<LeaderboardPage />} />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/ai" element={<AIPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/terminos" element={<LegalPage />} />
            <Route path="/privacidad" element={<LegalPage />} />
            <Route path="/copyright" element={<LegalPage />} />
            {/* Fallback: treat unknown single-segment paths as usernames */}
            <Route path="/:username" element={<ProfilePage />} />
          </Routes>
        </Suspense>
      </main>
      <Toast />
    </>
  );
}
