import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  UserPlus,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Database,
  ShoppingCart,
} from 'lucide-react';
import type { Profile } from '@/types';
import { cn } from '@/lib/utils';
import { useBrandingStore } from '@/stores/brandingStore';

interface SidebarProps {
  profile: Profile | null;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/conversations', label: 'Conversaciones', icon: MessageSquare },
  { to: '/customers', label: 'Clientes', icon: Users },
  { to: '/knowledge-bases', label: 'Bases de Datos', icon: Database },
  { to: '/orders', label: 'Pedidos', icon: ShoppingCart },
  { to: '/team', label: 'Equipo', icon: UserPlus },
  { to: '/settings', label: 'Configuración', icon: Settings },
];

const roleLabels: Record<string, string> = {
  gerente: 'Gerente',
  vendedor: 'Vendedor',
  logistica: 'Logística',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function Sidebar({ profile, onLogout, isOpen, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const { appName, logoUrl } = useBrandingStore();
  const brandInitial = appName.trim().charAt(0).toUpperCase() || 'O';

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={cn(
          'fixed top-0 left-0 z-50 flex h-screen flex-col border-r border-surface-200 bg-surface-50',
          'transition-all duration-300 ease-in-out',
          // Mobile: slide in/out
          'lg:relative lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        {/* Header / Brand */}
        <div className="flex h-16 items-center justify-between border-b border-surface-200 px-4">
          <div className="flex items-center gap-2 overflow-hidden">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={appName}
                className="h-9 w-9 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-500 text-sm font-bold text-white">
                {brandInitial}
              </div>
            )}
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden whitespace-nowrap text-lg font-bold text-surface-900"
                >
                  {appName}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Collapse toggle on desktop */}
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="hidden rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 lg:flex"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-primary-500/10 text-primary-500'
                    : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900',
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          ))}
        </nav>

        {/* Bottom user section */}
        <div className="border-t border-surface-200 p-3">
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg p-2',
              collapsed && 'flex-col gap-2',
            )}
          >
            {/* Clickable avatar + name → opens profile panel */}
            <button
              onClick={() => setShowProfilePanel(true)}
              title="Ver perfil"
              className={cn(
                'flex items-center gap-3 min-w-0 flex-1 rounded-lg hover:bg-surface-100 transition-colors text-left',
                collapsed && 'flex-col gap-1 flex-none w-full',
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-500/10 text-sm font-semibold text-accent-500">
                {profile ? getInitials(profile.full_name) : '??'}
              </div>

              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="min-w-0 flex-1 overflow-hidden"
                  >
                    <p className="truncate text-sm font-medium text-surface-900">
                      {profile?.full_name ?? 'Usuario'}
                    </p>
                    <p className="truncate text-xs text-surface-500">
                      {profile?.role ? roleLabels[profile.role] ?? profile.role : ''}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>

            <button
              onClick={() => setShowLogoutModal(true)}
              title="Cerrar sesión"
              className={cn(
                'shrink-0 rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-red-50 hover:text-red-500',
                collapsed && 'mt-1',
              )}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* ── Logout confirmation modal ── */}
      <AnimatePresence>
        {showLogoutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
            onClick={() => setShowLogoutModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <LogOut className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-surface-900">
                    ¿Cerrar sesión?
                  </h3>
                  <p className="mt-1 text-sm text-surface-500">
                    Se cerrará tu sesión en este dispositivo.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { setShowLogoutModal(false); onLogout(); }}
                  className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
                >
                  Cerrar sesión
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Profile panel ── */}
      <AnimatePresence>
        {showProfilePanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
            onClick={() => setShowProfilePanel(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm rounded-2xl bg-white shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
                <h3 className="text-base font-semibold text-surface-900">Mi perfil</h3>
                <button
                  onClick={() => setShowProfilePanel(false)}
                  className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Avatar + name */}
              <div className="flex flex-col items-center gap-3 px-5 py-6 bg-gradient-to-b from-primary-50 to-white">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-500/15 text-2xl font-bold text-accent-500">
                  {profile ? getInitials(profile.full_name) : '??'}
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-surface-900">
                    {profile?.full_name ?? '—'}
                  </p>
                  <span className="inline-block mt-1 rounded-full bg-primary-100 px-3 py-0.5 text-xs font-medium text-primary-700">
                    {profile?.role ? roleLabels[profile.role] ?? profile.role : '—'}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="px-5 pb-5 space-y-3">
                <div className="flex items-center gap-3 rounded-xl bg-surface-50 px-4 py-3">
                  <User className="h-4 w-4 shrink-0 text-surface-400" />
                  <div className="min-w-0">
                    <p className="text-xs text-surface-400">Correo electrónico</p>
                    <p className="text-sm font-medium text-surface-800 truncate">
                      {profile?.email ?? '—'}
                    </p>
                  </div>
                </div>

                {profile?.created_at && (
                  <div className="flex items-center gap-3 rounded-xl bg-surface-50 px-4 py-3">
                    <div className="h-4 w-4 shrink-0 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-green-400" />
                    </div>
                    <div>
                      <p className="text-xs text-surface-400">Miembro desde</p>
                      <p className="text-sm font-medium text-surface-800">
                        {formatDate(profile.created_at)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
