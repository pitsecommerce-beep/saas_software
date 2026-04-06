'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Package,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/config';
import { ORDER_STATUSES } from '@/config/modules';
import { Badge } from '@/components/ui/Badge';
import type { OrderStatus } from '@/types';

interface OrderRow {
  id: string;
  customer_id: string | null;
  conversation_id: string | null;
  status: OrderStatus;
  total: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: { name: string } | null;
  conversation?: { channel: string } | null;
  order_items?: {
    id: string;
    product_name: string;
    sku: string | null;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
}

function OrdersPage() {
  const { profile } = useAuthStore();
  const teamId = profile?.team_id;

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!isSupabaseConfigured || !teamId) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, customer:customers(name), conversation:conversations(channel), order_items(*)')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data as OrderRow[]) ?? []);
    } catch (err) {
      console.error('Error loading orders:', err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (!isSupabaseConfigured || !teamId) return;
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('team_id', teamId);

    if (error) {
      console.error('Error updating order status:', error);
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus, updated_at: new Date().toISOString() } : o))
    );
  };

  // Filter and search
  const filteredOrders = orders.filter((o) => {
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const customerName = (o.customer as { name?: string } | null)?.name?.toLowerCase() ?? '';
      const shortId = o.id.slice(0, 8).toLowerCase();
      return customerName.includes(q) || shortId.includes(q);
    }
    return true;
  });

  const getStatusLabel = (status: string) => {
    return ORDER_STATUSES.find((s) => s.id === status)?.label ?? status;
  };

  const getStatusColor = (status: string) => {
    return ORDER_STATUSES.find((s) => s.id === status)?.color ?? 'bg-gray-100 text-gray-700';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount == null) return '$0.00';
    return `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (!loading && orders.length === 0) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <h1 className="text-2xl font-bold text-surface-900">Pedidos</h1>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-200 bg-white py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100 mb-4">
            <ShoppingCart className="h-8 w-8 text-surface-400" />
          </div>
          <h3 className="text-base font-semibold text-surface-700 mb-1">Sin pedidos aun</h3>
          <p className="text-sm text-surface-500 max-w-sm">
            Los pedidos apareceran aqui cuando el agente de IA los cree durante las conversaciones con clientes. Asegurate de habilitar la herramienta "Crear pedido" en la configuracion del agente.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-900">Pedidos</h1>
        <span className="text-sm text-surface-500">
          {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <input
            type="text"
            placeholder="Buscar por cliente o ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-surface-200 bg-white pl-10 pr-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        >
          <option value="all">Todos los estados</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Orders table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-surface-50 border-b border-surface-200 text-xs font-medium text-surface-500 uppercase tracking-wider">
            <span>ID</span>
            <span>Cliente</span>
            <span>Canal</span>
            <span>Estado</span>
            <span>Total</span>
            <span>Fecha</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-surface-100">
            {filteredOrders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const customerName = (order.customer as { name?: string } | null)?.name ?? 'Sin cliente';
              const channel = (order.conversation as { channel?: string } | null)?.channel ?? '—';
              const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : channel === 'instagram' ? 'Instagram' : channel === 'messenger' ? 'Messenger' : channel;

              return (
                <div key={order.id}>
                  {/* Row */}
                  <button
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    className="w-full text-left grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_1fr_1fr_1fr_auto] gap-2 sm:gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-surface-400 shrink-0" />
                      <span className="text-sm font-mono text-surface-600">
                        #{order.id.slice(0, 8)}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-surface-800 truncate">
                      {customerName}
                    </span>
                    <span className="text-sm text-surface-600">{channelLabel}</span>
                    <div>
                      <Badge size="sm" className={getStatusColor(order.status)}>
                        {getStatusLabel(order.status)}
                      </Badge>
                    </div>
                    <span className="text-sm font-semibold text-surface-800">
                      {formatCurrency(order.total)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-surface-500">
                        {formatDate(order.created_at)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-surface-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-surface-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 py-4 bg-surface-50 border-t border-surface-100 space-y-4">
                          {/* Order items */}
                          <div>
                            <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                              Productos
                            </h4>
                            {order.order_items && order.order_items.length > 0 ? (
                              <div className="rounded-lg border border-surface-200 bg-white overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-surface-50 text-xs text-surface-500 uppercase">
                                      <th className="text-left px-3 py-2">Producto</th>
                                      <th className="text-left px-3 py-2">SKU</th>
                                      <th className="text-right px-3 py-2">Cant.</th>
                                      <th className="text-right px-3 py-2">P. Unit.</th>
                                      <th className="text-right px-3 py-2">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-surface-100">
                                    {order.order_items.map((item) => (
                                      <tr key={item.id}>
                                        <td className="px-3 py-2 text-surface-800">{item.product_name}</td>
                                        <td className="px-3 py-2 text-surface-500 font-mono text-xs">{item.sku ?? '—'}</td>
                                        <td className="px-3 py-2 text-right text-surface-700">{item.quantity}</td>
                                        <td className="px-3 py-2 text-right text-surface-700">{formatCurrency(item.unit_price)}</td>
                                        <td className="px-3 py-2 text-right font-medium text-surface-800">{formatCurrency(item.subtotal)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-surface-500">Sin productos registrados</p>
                            )}
                          </div>

                          {/* Notes & actions row */}
                          <div className="flex flex-col sm:flex-row gap-4">
                            {/* Notes */}
                            {order.notes && (
                              <div className="flex-1">
                                <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">
                                  Notas
                                </h4>
                                <p className="text-sm text-surface-700 bg-white rounded-lg px-3 py-2 border border-surface-200">
                                  {order.notes}
                                </p>
                              </div>
                            )}

                            {/* Change status */}
                            <div>
                              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">
                                Cambiar estado
                              </h4>
                              <select
                                value={order.status}
                                onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)}
                                className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                              >
                                {ORDER_STATUSES.map((s) => (
                                  <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                              </select>
                            </div>

                            {/* Link to conversation */}
                            {order.conversation_id && (
                              <div>
                                <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">
                                  Conversacion
                                </h4>
                                <a
                                  href={`/conversations`}
                                  className="inline-flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-600 transition-colors"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Ver conversacion
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {filteredOrders.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-surface-500">
              No se encontraron pedidos con los filtros seleccionados.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OrdersPage;
