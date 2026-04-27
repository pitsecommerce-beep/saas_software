import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';

function SplashScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 overflow-hidden relative">
      {/* Ambient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-primary-500/20 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-accent-500/15 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative"
        >
          <img src="/logo.png" alt="Logo" className="h-20 w-auto object-contain" />
          {/* Ripple rings */}
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-3xl border border-white/20"
              initial={{ scale: 1, opacity: 0.4 }}
              animate={{ scale: 1 + i * 0.35, opacity: 0 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.4,
                ease: 'easeOut',
              }}
            />
          ))}
        </motion.div>

        {/* Dot loader */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-2"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-white/60"
              animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeInOut',
              }}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
import { MainLayout } from '@/components/layout/MainLayout';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import OnboardingPage from '@/pages/OnboardingPage';
import DashboardPage from '@/pages/DashboardPage';
import ConversationsPage from '@/pages/ConversationsPage';
import CustomersPage from '@/pages/CustomersPage';
import TeamPage from '@/pages/TeamPage';
import SettingsPage from '@/pages/SettingsPage';
import KnowledgeBasesPage from '@/pages/KnowledgeBasesPage';
import OrdersPage from '@/pages/OrdersPage';
import AuthCallbackPage from '@/pages/AuthCallbackPage';

/**
 * Wraps protected routes. Redirects to /login if not authenticated,
 * or to /onboarding if the profile has no team yet.
 * When profile fetch failed (server error) we redirect to /login
 * instead of onboarding to avoid a confusing loop.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, profileFetchFailed } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If profile fetch failed due to server error (e.g. RLS infinite recursion),
  // send to login with a clean slate rather than onboarding.
  if (profileFetchFailed) {
    return <Navigate to="/login" replace />;
  }

  // No profile yet — still loading or trigger hasn't fired
  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  // Profile exists but no team — send to onboarding to create/join a team
  if (!profile.team_id) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

/**
 * Wraps public routes (login, register). Redirects authenticated users
 * with a complete profile to the dashboard instead of showing auth forms.
 */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, profileFetchFailed } = useAuthStore();

  // If user is fully set up (has user + profile + team), send to dashboard.
  if (user && profile?.team_id && !profileFetchFailed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { initialize, loading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <BrowserRouter basename={import.meta.env.VITE_BASE_PATH ?? '/saas_software'}>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  // Use a simplified key: public auth pages get their own key for cross-fade,
  // everything else groups under a single key so the MainLayout doesn't re-mount.
  const isAuthPage = ['/login', '/register'].includes(location.pathname);
  const routeKey = isAuthPage ? location.pathname : 'app';

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={routeKey}>
        {/* Public routes — redirect to dashboard if already authenticated */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        {/* Onboarding — accessible to users setting up their team */}
        <Route path="/onboarding" element={<OnboardingPage />} />
        {/* OAuth callback — always accessible */}
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="conversations" element={<ConversationsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="knowledge-bases" element={<KnowledgeBasesPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default App;
