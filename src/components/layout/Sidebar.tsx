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
} from 'lucide-react';
import type { Profile } from '@/types';
import { cn } from '@/lib/utils';

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

export function Sidebar({ profile, onLogout, isOpen, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-500 text-sm font-bold text-white">
              B
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden whitespace-nowrap text-lg font-bold text-surface-900"
                >
                  Beep
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

            <button
              onClick={onLogout}
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
    </>
  );
}
