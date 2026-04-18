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
  CalendarDays,
  Pencil,
  Trash2,
  Plus,
  Save,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/config';
import { ORDER_STATUSES } from '@/config/modules';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CreateOrderModal } from '@/components/orders/CreateOrderModal';
import type { OrderStatus, DeliveryMethod } from '@/types';

const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  cliente_recoge: 'CLIENTE RECOGE',
  envio_directo: 'ENVÍO DIRECTO',
  envio_en_ruta: 'ENVÍO EN RUTA',
};

const DELIVERY_METHOD_OPTIONS: { value: DeliveryMethod | ''; label: string }[] = [
  { value: '', label: 'Sin definir' },
  { value: 'cliente_recoge', label: 'CLIENTE RECOGE' },
  { value: 'envio_directo', label: 'ENVÍO DIRECTO' },
  { value: 'envio_en_ruta', label: 'ENVÍO EN RUTA' },
];

interface OrderItemRow {
  id: string;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface OrderRow {
  id: string;
  customer_id: string | null;
  conversation_id: string | null;
  seller_id: string | null;
  status: OrderStatus;
  total: number | null;
  notes: string | null;
  delivery_method: DeliveryMethod | null;
  created_at: string;
  updated_at: string;
  customer?: { name: string } | null;
  conversation?: { channel: string } | null;
  seller?: { full_name: string } | null;
  order_items?: OrderItemRow[];
}

interface EditingOrder {
  id: string;
  notes: string;
  items: EditingItem[];
  deletedItemIds: string[];
}

interface EditingItem {
  id: string;
  isNew?: boolean;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
}

function OrdersPage() {
  const { profile } = useAuthStore();
  const teamId = profile?.team_id;

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editingOrder, setEditingOrder] = useState<EditingOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!isSupabaseConfigured || !teamId) {
      setLoading(false);
      return;
    }
    try {
      // Query orders *without* joining to profiles via the seller foreign key.
      // That join only works after the `add_order_seller_and_payment_fields`
      // migration has been applied; keeping it inline made the whole query
      // fail — and hid every existing order — on databases that haven't run
      // the migration yet. The seller name is hydrated in a follow-up query
      // below so it degrades gracefully if `seller_id` isn't present.
      const { data, error } = await supabase
        .from('orders')
        .select('*, customer:customers(name), conversation:conversations(channel), order_items(*)')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const loaded = (data as OrderRow[]) ?? [];

      // Enrich with seller full_name if any rows have a seller_id.
      const sellerIds = Array.from(
        new Set(
          loaded
            .map((o) => o.seller_id)
            .filter((v): v is string => typeof v === 'string' && v.length > 0)
        )
      );
      if (sellerIds.length > 0) {
        const { data: sellersData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', sellerIds);
        if (sellersData) {
          const sellerById = new Map(
            (sellersData as Array<{ id: string; full_name: string }>).map((p) => [p.id, p])
          );
          for (const order of loaded) {
            if (order.seller_id && sellerById.has(order.seller_id)) {
              order.seller = { full_name: sellerById.get(order.seller_id)!.full_name };
            }
          }
        }
      }

      setOrders(loaded);
    } catch (err) {
      console.error('Error loading orders:', err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const updateOrderDeliveryMethod = async (orderId: string, newMethod: DeliveryMethod | null) => {
    if (!isSupabaseConfigured || !teamId) return;
    const { error } = await supabase
      .from('orders')
      .update({ delivery_method: newMethod, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('team_id', teamId);

    if (error) {
      console.error('Error updating delivery method:', error);
      return;
    }
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, delivery_method: newMethod, updated_at: new Date().toISOString() } : o
      )
    );
  };

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

  // ---------------------------------------------------------------------------
  // Edit order helpers
  // ---------------------------------------------------------------------------

  const startEditing = (order: OrderRow) => {
    setEditingOrder({
      id: order.id,
      notes: order.notes ?? '',
      items: (order.order_items ?? []).map((item) => ({
        id: item.id,
        product_name: item.product_name,
        sku: item.sku ?? '',
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
      deletedItemIds: [],
    });
  };

  const cancelEditing = () => {
    setEditingOrder(null);
  };

  const updateEditingItem = (index: number, field: keyof EditingItem, value: string | number) => {
    setEditingOrder((prev) => {
      if (!prev) return prev;
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addEditingItem = () => {
    setEditingOrder((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: [
          ...prev.items,
          { id: `new-${Date.now()}`, isNew: true, product_name: '', sku: '', quantity: 1, unit_price: 0 },
        ],
      };
    });
  };

  const removeEditingItem = (index: number) => {
    setEditingOrder((prev) => {
      if (!prev) return prev;
      const item = prev.items[index];
      const deletedItemIds = item.isNew ? prev.deletedItemIds : [...prev.deletedItemIds, item.id];
      return { ...prev, items: prev.items.filter((_, i) => i !== index), deletedItemIds };
    });
  };

  const getEditingTotal = () => {
    if (!editingOrder) return 0;
    return editingOrder.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  };

  const saveOrder = async () => {
    if (!editingOrder || !isSupabaseConfigured || !teamId) return;
    setSaving(true);

    try {
      const newTotal = getEditingTotal();

      // 1. Update order notes & total
      const { error: orderErr } = await supabase
        .from('orders')
        .update({ notes: editingOrder.notes || null, total: newTotal, updated_at: new Date().toISOString() })
        .eq('id', editingOrder.id)
        .eq('team_id', teamId);
      if (orderErr) throw orderErr;

      // 2. Delete removed items
      if (editingOrder.deletedItemIds.length > 0) {
        const { error: delErr } = await supabase
          .from('order_items')
          .delete()
          .in('id', editingOrder.deletedItemIds);
        if (delErr) throw delErr;
      }

      // 3. Update existing items
      for (const item of editingOrder.items.filter((i) => !i.isNew)) {
        const { error: upErr } = await supabase
          .from('order_items')
          .update({
            product_name: item.product_name,
            sku: item.sku || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.quantity * item.unit_price,
          })
          .eq('id', item.id);
        if (upErr) throw upErr;
      }

      // 4. Insert new items
      const newItems = editingOrder.items.filter((i) => i.isNew);
      if (newItems.length > 0) {
        const { error: insErr } = await supabase
          .from('order_items')
          .insert(
            newItems.map((item) => ({
              order_id: editingOrder.id,
              product_name: item.product_name,
              sku: item.sku || null,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.quantity * item.unit_price,
            }))
          );
        if (insErr) throw insErr;
      }

      // 5. Refresh orders list
      await loadOrders();
      setEditingOrder(null);
    } catch (err) {
      console.error('Error saving order:', err);
    } finally {
      setSaving(false);
    }
  };

  // Filter and search
  const filteredOrders = orders.filter((o) => {
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const customerName = (o.customer as { name?: string } | null)?.name?.toLowerCase() ?? '';
      const shortId = o.id.slice(0, 8).toLowerCase();
      if (!customerName.includes(q) && !shortId.includes(q)) return false;
    }
    if (dateFrom) {
      const orderDate = new Date(o.created_at).toISOString().slice(0, 10);
      if (orderDate < dateFrom) return false;
    }
    if (dateTo) {
      const orderDate = new Date(o.created_at).toISOString().slice(0, 10);
      if (orderDate > dateTo) return false;
    }
    return true;
  });

  const hasActiveFilters = filterStatus !== 'all' || searchQuery || dateFrom || dateTo;

  const clearAllFilters = () => {
    setFilterStatus('all');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  };

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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-surface-900">Pedidos</h1>
          {profile && teamId && (
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
              icon={<Plus className="h-4 w-4" />}
            >
              Nuevo pedido
            </Button>
          )}
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-200 bg-white py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100 mb-4">
            <ShoppingCart className="h-8 w-8 text-surface-400" />
          </div>
          <h3 className="text-base font-semibold text-surface-700 mb-1">Sin pedidos aun</h3>
          <p className="text-sm text-surface-500 max-w-sm">
            Los pedidos aparecerán aquí cuando el agente de IA los cree durante las conversaciones con clientes, o cuando los crees manualmente desde este panel.
          </p>
          {profile && teamId && (
            <Button
              className="mt-6"
              size="md"
              onClick={() => setShowCreateModal(true)}
              icon={<Plus className="h-4 w-4" />}
            >
              Crear primer pedido
            </Button>
          )}
        </div>

        {profile && teamId && (
          <CreateOrderModal
            isOpen={showCreateModal}
            teamId={teamId}
            sellerId={profile.id}
            sellerName={profile.full_name}
            onClose={() => setShowCreateModal(false)}
            onCreated={loadOrders}
          />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-surface-900">Pedidos</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-surface-500 hidden sm:inline">
            {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''}
          </span>
          {profile && teamId && (
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
              icon={<Plus className="h-4 w-4" />}
            >
              Nuevo pedido
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Search + date row */}
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

          {/* Date filters */}
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-surface-400 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              title="Desde"
            />
            <span className="text-sm text-surface-400">a</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              title="Hasta"
            />
          </div>

          {/* Clear all filters */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-500 hover:bg-surface-50 hover:text-surface-700 transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Status filter buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
              filterStatus === 'all'
                ? 'bg-surface-800 text-white border-surface-800'
                : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'
            }`}
          >
            Todos
          </button>
          {ORDER_STATUSES.map((s) => (
            <button
              key={s.id}
              onClick={() => setFilterStatus(filterStatus === s.id ? 'all' : s.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                filterStatus === s.id
                  ? s.color + ' border-current'
                  : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
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
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge size="sm" className={getStatusColor(order.status)}>
                        {getStatusLabel(order.status)}
                      </Badge>
                      {order.delivery_method && (
                        <Badge size="sm" className="bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {DELIVERY_METHOD_LABELS[order.delivery_method]}
                        </Badge>
                      )}
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
                        {editingOrder?.id === order.id ? (
                          /* ---- EDIT MODE ---- */
                          <div className="px-5 py-4 bg-surface-50 border-t border-surface-100 space-y-4">
                            {/* Edit header */}
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-surface-800">Editando pedido #{order.id.slice(0, 8)}</h4>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={cancelEditing}
                                  disabled={saving}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm text-surface-600 hover:bg-surface-50 transition-colors disabled:opacity-50"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Cancelar
                                </button>
                                <button
                                  onClick={saveOrder}
                                  disabled={saving}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 transition-colors disabled:opacity-50"
                                >
                                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                  {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                              </div>
                            </div>

                            {/* Edit items table */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                                  Productos
                                </h4>
                                <button
                                  onClick={addEditingItem}
                                  className="inline-flex items-center gap-1 rounded-md bg-white border border-surface-200 px-2 py-1 text-xs font-medium text-surface-600 hover:bg-surface-50 transition-colors"
                                >
                                  <Plus className="h-3 w-3" />
                                  Agregar producto
                                </button>
                              </div>
                              <div className="rounded-lg border border-surface-200 bg-white overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-surface-50 text-xs text-surface-500 uppercase">
                                      <th className="text-left px-3 py-2">Producto</th>
                                      <th className="text-left px-3 py-2">SKU</th>
                                      <th className="text-right px-3 py-2 w-20">Cant.</th>
                                      <th className="text-right px-3 py-2 w-28">P. Unit.</th>
                                      <th className="text-right px-3 py-2 w-28">Subtotal</th>
                                      <th className="px-2 py-2 w-10"></th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-surface-100">
                                    {editingOrder.items.map((item, idx) => (
                                      <tr key={item.id}>
                                        <td className="px-3 py-1.5">
                                          <input
                                            type="text"
                                            value={item.product_name}
                                            onChange={(e) => updateEditingItem(idx, 'product_name', e.target.value)}
                                            placeholder="Nombre del producto"
                                            className="w-full rounded border border-surface-200 px-2 py-1 text-sm text-surface-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                          />
                                        </td>
                                        <td className="px-3 py-1.5">
                                          <input
                                            type="text"
                                            value={item.sku}
                                            onChange={(e) => updateEditingItem(idx, 'sku', e.target.value)}
                                            placeholder="SKU"
                                            className="w-full rounded border border-surface-200 px-2 py-1 text-sm font-mono text-surface-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                          />
                                        </td>
                                        <td className="px-3 py-1.5">
                                          <input
                                            type="number"
                                            min={1}
                                            value={item.quantity}
                                            onChange={(e) => updateEditingItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                            className="w-full rounded border border-surface-200 px-2 py-1 text-sm text-right text-surface-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                          />
                                        </td>
                                        <td className="px-3 py-1.5">
                                          <input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            value={item.unit_price}
                                            onChange={(e) => updateEditingItem(idx, 'unit_price', Math.max(0, parseFloat(e.target.value) || 0))}
                                            className="w-full rounded border border-surface-200 px-2 py-1 text-sm text-right text-surface-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                          />
                                        </td>
                                        <td className="px-3 py-1.5 text-right text-sm font-medium text-surface-800">
                                          {formatCurrency(item.quantity * item.unit_price)}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                          <button
                                            onClick={() => removeEditingItem(idx)}
                                            className="rounded p-1 text-surface-400 hover:bg-danger-50 hover:text-danger-500 transition-colors"
                                            title="Eliminar producto"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                    {editingOrder.items.length === 0 && (
                                      <tr>
                                        <td colSpan={6} className="px-3 py-4 text-center text-sm text-surface-400">
                                          Sin productos. Haz clic en "Agregar producto" para anadir uno.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                  <tfoot>
                                    <tr className="border-t border-surface-200 bg-surface-50">
                                      <td colSpan={4} className="px-3 py-2 text-right text-sm font-semibold text-surface-600">
                                        Total:
                                      </td>
                                      <td className="px-3 py-2 text-right text-sm font-bold text-surface-900">
                                        {formatCurrency(getEditingTotal())}
                                      </td>
                                      <td></td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>

                            {/* Edit notes */}
                            <div>
                              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">
                                Notas
                              </h4>
                              <textarea
                                value={editingOrder.notes}
                                onChange={(e) => setEditingOrder((prev) => prev ? { ...prev, notes: e.target.value } : prev)}
                                rows={3}
                                placeholder="Notas opcionales sobre el pedido..."
                                className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
                              />
                            </div>
                          </div>
                        ) : (
                          /* ---- VIEW MODE ---- */
                          <div className="px-5 py-4 bg-surface-50 border-t border-surface-100 space-y-4">
                            {/* Order items */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                                  Productos
                                </h4>
                                <button
                                  onClick={(e) => { e.stopPropagation(); startEditing(order); }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50 hover:text-primary-600 transition-colors"
                                >
                                  <Pencil className="h-3 w-3" />
                                  Editar pedido
                                </button>
                              </div>
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
                              {/* Seller */}
                              {order.seller?.full_name && (
                                <div>
                                  <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">
                                    Vendedor
                                  </h4>
                                  <p className="text-sm text-surface-700">{order.seller.full_name}</p>
                                </div>
                              )}

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

                              {/* Delivery method */}
                              <div>
                                <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">
                                  Tipo de entrega
                                </h4>
                                <select
                                  value={order.delivery_method ?? ''}
                                  onChange={(e) => updateOrderDeliveryMethod(order.id, (e.target.value || null) as DeliveryMethod | null)}
                                  className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                >
                                  {DELIVERY_METHOD_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                        )}
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

      {profile && teamId && (
        <CreateOrderModal
          isOpen={showCreateModal}
          teamId={teamId}
          sellerId={profile.id}
          sellerName={profile.full_name}
          onClose={() => setShowCreateModal(false)}
          onCreated={loadOrders}
        />
      )}
    </div>
  );
}

export default OrdersPage;
