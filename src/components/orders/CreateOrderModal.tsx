'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Plus, Save, Trash2, User, ShoppingCart, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/config';
import { ORDER_STATUSES } from '@/config/modules';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { Customer, OrderStatus, Profile } from '@/types';

interface CreateOrderModalProps {
  isOpen: boolean;
  teamId: string;
  sellerId: string;
  sellerName: string;
  onClose: () => void;
  onCreated: () => void;
}

interface DraftItem {
  tmpId: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function emptyItem(): DraftItem {
  return {
    tmpId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    product_name: '',
    sku: '',
    quantity: 1,
    unit_price: 0,
  };
}

export function CreateOrderModal({
  isOpen,
  teamId,
  sellerId,
  sellerName,
  onClose,
  onCreated,
}: CreateOrderModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Profile[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [chosenSellerId, setChosenSellerId] = useState<string>(sellerId);
  const [status, setStatus] = useState<OrderStatus>('cotizando');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    if (!isSupabaseConfigured || !teamId) return;
    setLoading(true);
    try {
      const [customersRes, sellersRes] = await Promise.all([
        supabase
          .from('customers')
          .select('id, team_id, name, email, phone, channel, channel_id, rfc, delivery_address, notes, assigned_to, created_at, updated_at')
          .eq('team_id', teamId)
          .order('name', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url, role, team_id, is_active, created_at')
          .eq('team_id', teamId)
          .eq('is_active', true)
          .in('role', ['gerente', 'vendedor']),
      ]);
      if (customersRes.data) setCustomers(customersRes.data as Customer[]);
      if (sellersRes.data) setSellers(sellersRes.data as Profile[]);
    } catch (err) {
      console.error('Error loading create-order data:', err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      setCustomerId('');
      setCustomerSearch('');
      setChosenSellerId(sellerId);
      setStatus('cotizando');
      setNotes('');
      setItems([emptyItem()]);
      setError(null);
    }
  }, [isOpen, sellerId, loadInitialData]);

  const total = useMemo(
    () => items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0),
    [items]
  );

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.trim().toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const updateItem = (tmpId: string, field: keyof DraftItem, value: string | number) => {
    setItems((prev) =>
      prev.map((it) => (it.tmpId === tmpId ? { ...it, [field]: value } : it))
    );
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (tmpId: string) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.tmpId !== tmpId) : prev));

  const handleSubmit = async () => {
    setError(null);
    if (!customerId) {
      setError('Selecciona un cliente para el pedido.');
      return;
    }
    if (!chosenSellerId) {
      setError('Selecciona el vendedor responsable del pedido.');
      return;
    }
    const validItems = items.filter((it) => it.product_name.trim() && it.quantity > 0);
    if (validItems.length === 0) {
      setError('Agrega al menos un producto con nombre y cantidad.');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Conecta Supabase para crear pedidos.');
      return;
    }

    setSaving(true);
    try {
      const { data: inserted, error: orderErr } = await supabase
        .from('orders')
        .insert({
          team_id: teamId,
          customer_id: customerId,
          seller_id: chosenSellerId,
          status,
          total,
          notes: notes.trim() || null,
        })
        .select('id')
        .single();

      if (orderErr) throw orderErr;
      const orderId = (inserted as { id: string }).id;

      const { error: itemsErr } = await supabase.from('order_items').insert(
        validItems.map((it) => ({
          order_id: orderId,
          product_name: it.product_name.trim(),
          sku: it.sku.trim() || null,
          quantity: it.quantity,
          unit_price: it.unit_price,
          subtotal: it.quantity * it.unit_price,
        }))
      );
      if (itemsErr) throw itemsErr;

      onCreated();
      onClose();
    } catch (err) {
      console.error('Error creating order:', err);
      setError(err instanceof Error ? err.message : 'Error al crear el pedido');
    } finally {
      setSaving(false);
    }
  };

  const sellerOptions = sellers.length
    ? sellers.map((s) => ({ value: s.id, label: `${s.full_name} (${s.role})` }))
    : [{ value: sellerId, label: `${sellerName} (yo)` }];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nuevo pedido" size="lg">
      <div className="space-y-5">
        {/* Customer picker */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-surface-700">Cliente</label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono o email..."
              className="block w-full rounded-lg border border-surface-200 bg-white pl-10 pr-3 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-surface-200 bg-white divide-y divide-surface-100">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm text-surface-400">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cargando clientes...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-surface-400">
                No se encontraron clientes. Crea uno primero en la sección Clientes.
              </div>
            ) : (
              filteredCustomers.slice(0, 50).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCustomerId(c.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface-50 transition-colors ${
                    customerId === c.id ? 'bg-primary-50' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-800 truncate">{c.name}</p>
                    <p className="text-xs text-surface-500 truncate">
                      {c.phone ?? c.email ?? c.channel_id ?? '—'}
                    </p>
                  </div>
                  {customerId === c.id && (
                    <span className="shrink-0 rounded-full bg-primary-500 text-white text-[10px] px-2 py-0.5">
                      Seleccionado
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Seller + status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Vendedor"
            value={chosenSellerId}
            onChange={(e) => setChosenSellerId(e.target.value)}
            options={sellerOptions}
          />
          <Select
            label="Estado inicial"
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatus)}
            options={ORDER_STATUSES.map((s) => ({ value: s.id, label: s.label }))}
          />
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-surface-700 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-surface-400" />
              Productos
            </label>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1 rounded-md border border-surface-200 bg-white px-2 py-1 text-xs font-medium text-surface-600 hover:bg-surface-50"
            >
              <Plus className="h-3 w-3" />
              Agregar
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
                {items.map((item) => (
                  <tr key={item.tmpId}>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={item.product_name}
                        onChange={(e) => updateItem(item.tmpId, 'product_name', e.target.value)}
                        placeholder="Nombre del producto"
                        className="w-full rounded border border-surface-200 px-2 py-1 text-sm text-surface-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={item.sku}
                        onChange={(e) => updateItem(item.tmpId, 'sku', e.target.value)}
                        placeholder="SKU"
                        className="w-full rounded border border-surface-200 px-2 py-1 text-sm font-mono text-surface-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(item.tmpId, 'quantity', Math.max(1, parseInt(e.target.value) || 1))
                        }
                        className="w-full rounded border border-surface-200 px-2 py-1 text-sm text-right text-surface-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.unit_price}
                        onChange={(e) =>
                          updateItem(item.tmpId, 'unit_price', Math.max(0, parseFloat(e.target.value) || 0))
                        }
                        className="w-full rounded border border-surface-200 px-2 py-1 text-sm text-right text-surface-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right text-sm font-medium text-surface-800">
                      {formatCurrency(item.quantity * item.unit_price)}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item.tmpId)}
                        disabled={items.length === 1}
                        className="rounded p-1 text-surface-400 hover:bg-danger-50 hover:text-danger-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-surface-200 bg-surface-50">
                  <td colSpan={4} className="px-3 py-2 text-right text-sm font-semibold text-surface-600">
                    Total:
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-surface-900">
                    {formatCurrency(total)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">Notas</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notas opcionales (dirección, instrucciones, referencias...)"
            className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
            <X className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-100">
          <Button variant="ghost" size="md" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            loading={saving}
            icon={<Save className="h-4 w-4" />}
          >
            Crear pedido
          </Button>
        </div>
      </div>
    </Modal>
  );
}
