import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Bell,
  Search,
  FlaskConical,
  Users,
  MessageSquare,
  ShoppingCart,
  Database,
  LayoutDashboard,
  Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDemoStore } from '@/stores/demoStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/config';

interface HeaderProps {
  title: string;
  onMenuToggle: () => void;
}

interface SearchResult {
  id: string;
  type: 'customer' | 'conversation' | 'order' | 'knowledge' | 'page';
  title: string;
  subtitle?: string;
  path: string;
  icon: LucideIcon;
}

// Static in-app navigation shortcuts — always searchable even offline
const PAGE_SHORTCUTS: SearchResult[] = [
  { id: 'page-dashboard', type: 'page', title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { id: 'page-conversations', type: 'page', title: 'Conversaciones', path: '/conversations', icon: MessageSquare },
  { id: 'page-customers', type: 'page', title: 'Clientes', path: '/customers', icon: Users },
  { id: 'page-knowledge', type: 'page', title: 'Bases de Datos', path: '/knowledge-bases', icon: Database },
  { id: 'page-orders', type: 'page', title: 'Pedidos', path: '/orders', icon: ShoppingCart },
];

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  page: 'Página',
  customer: 'Cliente',
  conversation: 'Conversación',
  order: 'Pedido',
  knowledge: 'Base de datos',
};

export function Header({ title, onMenuToggle }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { isDemoMode, setDemoMode } = useDemoStore();
  const { profile, team } = useAuthStore();
  const teamId = profile?.team_id ?? team?.id;
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const staticMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return PAGE_SHORTCUTS.filter((p) => p.title.toLowerCase().includes(q));
  }, [query]);

  // Debounced Supabase query — runs whenever the user types
  const runSearch = useCallback(
    async (q: string) => {
      if (!q) {
        setResults(staticMatches);
        setLoading(false);
        return;
      }
      if (!isSupabaseConfigured || !teamId) {
        setResults(staticMatches);
        setLoading(false);
        return;
      }
      setLoading(true);
      const like = `%${q}%`;
      try {
        const [customersRes, conversationsRes, ordersRes, knowledgeRes] = await Promise.all([
          supabase
            .from('customers')
            .select('id, name, phone, email')
            .eq('team_id', teamId)
            .or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
            .limit(5),
          supabase
            .from('conversations')
            .select('id, last_message, channel_contact_id')
            .eq('team_id', teamId)
            .or(`last_message.ilike.${like},channel_contact_id.ilike.${like}`)
            .limit(5),
          supabase
            .from('orders')
            .select('id, status, notes, total')
            .eq('team_id', teamId)
            .or(`notes.ilike.${like},status.ilike.${like}`)
            .limit(5),
          supabase
            .from('knowledge_bases')
            .select('id, name, description')
            .eq('team_id', teamId)
            .or(`name.ilike.${like},description.ilike.${like}`)
            .limit(5),
        ]);

        const merged: SearchResult[] = [];

        (customersRes.data ?? []).forEach((c: { id: string; name: string; phone?: string; email?: string }) => {
          merged.push({
            id: `customer-${c.id}`,
            type: 'customer',
            title: c.name,
            subtitle: c.phone ?? c.email ?? '',
            path: '/customers',
            icon: Users,
          });
        });

        (conversationsRes.data ?? []).forEach(
          (c: { id: string; last_message?: string; channel_contact_id: string }) => {
            merged.push({
              id: `conversation-${c.id}`,
              type: 'conversation',
              title: c.channel_contact_id,
              subtitle: c.last_message ?? '',
              path: '/conversations',
              icon: MessageSquare,
            });
          }
        );

        (ordersRes.data ?? []).forEach(
          (o: { id: string; status: string; notes?: string; total?: number }) => {
            merged.push({
              id: `order-${o.id}`,
              type: 'order',
              title: `Pedido #${o.id.slice(0, 8)}`,
              subtitle: `${o.status}${o.total ? ` · $${o.total}` : ''}${o.notes ? ` · ${o.notes}` : ''}`,
              path: '/orders',
              icon: ShoppingCart,
            });
          }
        );

        (knowledgeRes.data ?? []).forEach(
          (k: { id: string; name: string; description?: string }) => {
            merged.push({
              id: `knowledge-${k.id}`,
              type: 'knowledge',
              title: k.name,
              subtitle: k.description ?? '',
              path: '/knowledge-bases',
              icon: Database,
            });
          }
        );

        setResults([...staticMatches, ...merged]);
      } catch (err) {
        console.error('Global search failed:', err);
        setResults(staticMatches);
      } finally {
        setLoading(false);
      }
    },
    [teamId, staticMatches]
  );

  useEffect(() => {
    if (!searchOpen) return;
    const handle = setTimeout(() => {
      runSearch(query.trim());
    }, 250);
    return () => clearTimeout(handle);
  }, [query, searchOpen, runSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!searchOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [searchOpen]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.path);
    setSearchOpen(false);
    setQuery('');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-surface-200 bg-white/80 px-4 backdrop-blur-sm sm:px-6">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-surface-500 hover:bg-surface-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <h1 className="text-lg font-semibold text-surface-900">{title}</h1>
      </div>

      {/* Right: search, notifications */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div ref={containerRef} className="relative">
          <div
            className={cn(
              'flex items-center overflow-hidden rounded-lg border border-surface-200 bg-surface-50 transition-all duration-200',
              searchOpen ? 'w-64 sm:w-80' : 'w-9'
            )}
          >
            <button
              onClick={() => setSearchOpen((prev) => !prev)}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-surface-400 hover:text-surface-600"
              aria-label="Buscar"
            >
              <Search className="h-4 w-4" />
            </button>
            {searchOpen && (
              <input
                type="text"
                placeholder="Buscar clientes, pedidos, conversaciones…"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchOpen(false);
                    setQuery('');
                  } else if (e.key === 'Enter' && results.length > 0) {
                    handleSelect(results[0]);
                  }
                }}
                className="h-9 w-full bg-transparent pr-3 text-sm text-surface-900 outline-none placeholder:text-surface-400"
              />
            )}
          </div>

          {searchOpen && (
            <div className="absolute right-0 top-11 w-80 max-h-96 overflow-y-auto rounded-xl border border-surface-200 bg-white shadow-xl sm:w-96">
              {loading && (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-surface-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando…
                </div>
              )}

              {!loading && query.trim() === '' && (
                <>
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-surface-400">
                    Ir a
                  </div>
                  {PAGE_SHORTCUTS.map((r) => {
                    const Icon = r.icon;
                    return (
                      <button
                        key={r.id}
                        onClick={() => handleSelect(r)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-50"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-100 text-surface-500">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium text-surface-800">{r.title}</span>
                      </button>
                    );
                  })}
                </>
              )}

              {!loading && query.trim() !== '' && results.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-surface-500">
                  Sin resultados para &ldquo;{query}&rdquo;.
                </div>
              )}

              {!loading &&
                query.trim() !== '' &&
                results.length > 0 &&
                results.map((r) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(r)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-surface-900">
                            {r.title}
                          </span>
                          <span className="shrink-0 rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-surface-500">
                            {TYPE_LABELS[r.type]}
                          </span>
                        </div>
                        {r.subtitle && (
                          <p className="truncate text-xs text-surface-500">{r.subtitle}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        {/* Demo mode toggle */}
        <button
          onClick={() => setDemoMode(!isDemoMode)}
          title={isDemoMode ? 'Desactivar datos de demo' : 'Ver datos de demo'}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
            isDemoMode
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              : 'text-surface-500 hover:bg-surface-100 hover:text-surface-700'
          )}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{isDemoMode ? 'Demo activo' : 'Demo'}</span>
        </button>

        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-surface-500 hover:bg-surface-100">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-500" />
        </button>
      </div>
    </header>
  );
}
