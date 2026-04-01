import { useState, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { useDemoStore } from '@/stores/demoStore';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/conversations': 'Conversaciones',
  '/customers': 'Clientes',
  '/team': 'Equipo',
  '/settings': 'Configuración',
};

// Pages that need full height without scrollable wrapper (e.g. chat)
const FULL_HEIGHT_PAGES = ['/conversations'];

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, logout } = useAuthStore();
  const { isDemoMode } = useDemoStore();
  const location = useLocation();

  const title = pageTitles[location.pathname] ?? 'Dashboard';
  const isFullHeight = useMemo(
    () => FULL_HEIGHT_PAGES.some((p) => location.pathname.startsWith(p)),
    [location.pathname]
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">
      <Sidebar
        profile={profile}
        onLogout={logout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={title}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        />

        {isFullHeight ? (
          <main className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${location.pathname}-${isDemoMode}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${location.pathname}-${isDemoMode}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
