'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Customer, ChannelType, Profile, ConversationStatus } from '@/types';
import { motion } from 'framer-motion';
import { UserPlus, FileSpreadsheet, Upload, Download, AlertCircle, MessageSquare } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useCustomerStore } from '@/stores/customerStore';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { CustomerTable } from '@/components/customers/CustomerTable';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { TemplateDownloader } from '@/components/excel/TemplateDownloader';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/config';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const CUSTOMER_TEMPLATE_COLUMNS = [
  { name: 'RFC', example: 'XAXX010101000' },
  { name: 'NOMBRE CONTACTO', example: 'Juan Pérez García' },
  { name: 'NOMBRE DE NEGOCIO', example: 'Refacciones El Rey' },
  { name: 'ES TALLER', example: 'Sí' },
  { name: 'ES DISTRIBUIDOR', example: 'No' },
  { name: 'DIRECCIÓN', example: 'Av. Reforma 123, Col. Centro, CDMX' },
  { name: 'CELULAR', example: '+52 55 1234 5678' },
  { name: 'CORREO ELECTRÓNICO', example: 'juan.perez@negocio.com' },
  { name: 'CANAL ORIGEN', example: 'Instagram' },
  { name: 'USUARIO INSTA / MESSENGER', example: '@juanperez_refacciones' },
  { name: 'NOTAS', example: 'Cliente frecuente, prefiere pago en efectivo' },
];

export default function CustomersPage() {
  const { team } = useAuthStore();
  const {
    customers,
    loading: storeLoading,
    fetchCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    setCustomers,
  } = useCustomerStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Vendor assignment state
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [vendorTarget, setVendorTarget] = useState<Customer | null>(null);
  const [vendors, setVendors] = useState<Profile[]>([]);

  // Start conversation state
  const [convModalOpen, setConvModalOpen] = useState(false);
  const [convTarget, setConvTarget] = useState<Customer | null>(null);
  const [convMessage, setConvMessage] = useState('');
  const [convSending, setConvSending] = useState(false);

  const navigate = useNavigate();

  // Fetch customers from Supabase when the team is available
  useEffect(() => {
    if (team?.id) {
      fetchCustomers(team.id);
    }
  }, [team?.id, fetchCustomers]);

  // Load vendors
  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured || !team?.id) {
        setVendors([
          { id: 'p1', email: 'carlos@empresa.com', full_name: 'Carlos Mendez', role: 'vendedor', is_active: true, created_at: '' },
          { id: 'p2', email: 'ana@empresa.com', full_name: 'Ana Torres', role: 'vendedor', is_active: true, created_at: '' },
        ]);
        return;
      }
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('team_id', team.id)
          .in('role', ['vendedor', 'gerente'])
          .eq('is_active', true)
          .order('full_name');
        if (data) setVendors(data as Profile[]);
      } catch (err) {
        console.error('Error loading vendors:', err);
      }
    }
    load();
  }, [team?.id]);

  // Open form for new customer
  function handleNewCustomer() {
    setEditingCustomer(null);
    setFormModalOpen(true);
  }

  // Open form for editing
  function handleEdit(customer: Customer) {
    setEditingCustomer(customer);
    setFormModalOpen(true);
  }

  // Open delete confirmation
  function handleDeleteClick(customer: Customer) {
    setDeletingCustomer(customer);
    setDeleteModalOpen(true);
  }

  // Confirm delete
  async function handleDeleteConfirm() {
    if (!deletingCustomer) return;
    await deleteCustomer(deletingCustomer.id);
    setDeleteModalOpen(false);
    setDeletingCustomer(null);
  }

  // Handle form submit (create / edit)
  async function handleFormSubmit(data: {
    name: string;
    email: string;
    phone: string;
    channel: ChannelType;
    rfc: string;
    delivery_address: string;
    discount_percentage: number;
    notes: string;
  }) {
    if (!team?.id) return;
    setFormLoading(true);

    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, {
          name: data.name,
          email: data.email || undefined,
          phone: data.phone || undefined,
          channel: data.channel,
          rfc: data.rfc || undefined,
          delivery_address: data.delivery_address || undefined,
          discount_percentage: data.discount_percentage,
          notes: data.notes || undefined,
        });
      } else {
        await addCustomer({
          team_id: team.id,
          name: data.name,
          email: data.email || undefined,
          phone: data.phone || undefined,
          channel: data.channel,
          rfc: data.rfc || undefined,
          delivery_address: data.delivery_address || undefined,
          discount_percentage: data.discount_percentage,
          notes: data.notes || undefined,
        });
      }

      setFormModalOpen(false);
      setEditingCustomer(null);
    } catch (err) {
      console.error('Error saving customer:', err);
    } finally {
      setFormLoading(false);
    }
  }

  // --- Vendor assignment handlers ---
  function handleOpenAssignVendor(customer: Customer) {
    setVendorTarget(customer);
    setVendorModalOpen(true);
  }

  const handleConfirmAssignVendor = useCallback(
    async (vendorId: string) => {
      if (!vendorTarget || !team?.id) return;

      const vendor = vendors.find((v) => v.id === vendorId) ?? null;

      if (isSupabaseConfigured) {
        try {
          // Assign vendor directly to the customer
          await supabase
            .from('customers')
            .update({ assigned_to: vendorId || null })
            .eq('id', vendorTarget.id);

          // Also assign to any open conversations for this customer
          await supabase
            .from('conversations')
            .update({ assigned_to: vendorId || null })
            .eq('team_id', team.id)
            .eq('customer_id', vendorTarget.id)
            .not('status', 'eq', 'closed');
        } catch (err) {
          console.error('Error assigning vendor:', err);
        }
      }

      // Update local state
      setCustomers(
        customers.map((c) =>
          c.id === vendorTarget.id
            ? { ...c, assigned_to: vendorId || undefined, assigned_profile: vendor ?? undefined }
            : c
        )
      );

      setVendorModalOpen(false);
      setVendorTarget(null);
    },
    [vendorTarget, team?.id, vendors, customers, setCustomers]
  );

  // --- Start conversation handler ---
  function handleOpenStartConversation(customer: Customer) {
    setConvTarget(customer);
    setConvMessage('');
    setConvModalOpen(true);
  }

  async function handleStartConversation() {
    if (!convTarget || !convMessage.trim() || !team?.id) return;
    setConvSending(true);

    try {
      if (isSupabaseConfigured) {
        const { data: newConv, error: convErr } = await supabase
          .from('conversations')
          .insert({
            team_id: team.id,
            customer_id: convTarget.id,
            channel: convTarget.channel,
            channel_contact_id: convTarget.channel_id ?? convTarget.phone ?? convTarget.id,
            status: 'nuevo' as ConversationStatus,
            is_ai_enabled: false,
            last_message: convMessage.trim(),
            last_message_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (convErr) throw convErr;

        await supabase.from('messages').insert({
          conversation_id: newConv.id,
          sender_type: 'agent',
          content: convMessage.trim(),
        });
      }

      setConvModalOpen(false);
      setConvTarget(null);
      setConvMessage('');
      // Navigate to conversations page
      navigate('/conversations');
    } catch (err) {
      console.error('Error creating conversation:', err);
    } finally {
      setConvSending(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Clientes</h1>
          <p className="text-sm text-surface-500 mt-1">
            Gestiona tu base de clientes y su información de contacto
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            icon={<FileSpreadsheet className="h-4 w-4" />}
            onClick={() => setImportModalOpen(true)}
          >
            Importar Excel
          </Button>
          <Button
            icon={<UserPlus className="h-4 w-4" />}
            onClick={handleNewCustomer}
          >
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {storeLoading && customers.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      )}

      {/* Table */}
      <CustomerTable
        customers={customers}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onAssignVendor={handleOpenAssignVendor}
        onStartConversation={handleOpenStartConversation}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingCustomer(null);
        }}
        title={editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
      >
        <CustomerForm
          customer={editingCustomer}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setFormModalOpen(false);
            setEditingCustomer(null);
          }}
          loading={formLoading}
        />
      </Modal>

      {/* Import Excel Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Importar Clientes desde Excel"
        size="md"
      >
        <div className="space-y-5">
          {/* Template download */}
          <div className="rounded-xl bg-surface-50 border border-surface-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-primary-500" />
              <p className="text-sm font-semibold text-surface-800">Paso 1: Descarga la plantilla</p>
            </div>
            <p className="text-xs text-surface-500 leading-relaxed">
              La plantilla incluye las columnas necesarias: RFC, nombre del contacto, negocio, tipo (taller o distribuidor), dirección, celular, correo, canal de origen e usuario de redes sociales.
            </p>
            <TemplateDownloader
              templateName="Plantilla_Clientes_Orkesta"
              columns={CUSTOMER_TEMPLATE_COLUMNS}
            />
          </div>

          {/* Column preview */}
          <div className="rounded-xl bg-surface-50 border border-surface-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-surface-600 uppercase tracking-wide">Columnas incluidas</p>
            <div className="flex flex-wrap gap-1.5">
              {CUSTOMER_TEMPLATE_COLUMNS.map((col) => (
                <span key={col.name} className="inline-flex items-center rounded-md bg-white border border-surface-200 px-2 py-0.5 text-xs text-surface-600 font-medium">
                  {col.name}
                </span>
              ))}
            </div>
          </div>

          {/* Upload area */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary-500" />
              <p className="text-sm font-semibold text-surface-800">Paso 2: Sube tu archivo</p>
            </div>
            <label className="flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed border-surface-200 bg-surface-50 px-6 py-10 cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-colors">
              <FileSpreadsheet className="h-10 w-10 text-surface-300 mb-3" />
              <p className="text-sm text-surface-500 text-center">
                Arrastra tu archivo aquí o{' '}
                <span className="font-medium text-primary-500">selecciona un archivo</span>
              </p>
              <p className="text-xs text-surface-400 mt-1">Excel (.xlsx) o CSV — máx. 5MB</p>
              <input type="file" accept=".xlsx,.csv" className="hidden" />
            </label>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Usa exactamente los nombres de columna de la plantilla para que la importación funcione correctamente.
            </p>
          </div>
        </div>
      </Modal>

      {/* Vendor Assignment Modal */}
      <Modal
        isOpen={vendorModalOpen}
        onClose={() => { setVendorModalOpen(false); setVendorTarget(null); }}
        title={`Asignar vendedor a ${vendorTarget?.name ?? ''}`}
        size="sm"
      >
        <div className="space-y-3">
          {vendorTarget?.assigned_profile && (
            <div className="flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-200 px-3 py-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-violet-700">
                {vendorTarget.assigned_profile.full_name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-violet-600">Asignado actualmente a</p>
                <p className="text-sm font-medium text-violet-800">{vendorTarget.assigned_profile.full_name}</p>
              </div>
            </div>
          )}
          <p className="text-sm text-surface-500">
            Selecciona un vendedor para asignar a este cliente
          </p>
          {vendors.length === 0 ? (
            <p className="text-center text-sm text-surface-400 py-6">No hay vendedores disponibles</p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-surface-200 divide-y divide-surface-100">
              {vendors.map((vendor) => {
                const isAssigned = vendorTarget?.assigned_to === vendor.id;
                return (
                  <button
                    key={vendor.id}
                    type="button"
                    onClick={() => handleConfirmAssignVendor(vendor.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-50',
                      isAssigned ? 'bg-primary-50' : 'bg-white'
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600">
                      {vendor.full_name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-surface-900 truncate">{vendor.full_name}</p>
                      <p className="text-xs text-surface-400 truncate">{vendor.email}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-100 text-surface-500 capitalize">
                      {vendor.role}
                    </span>
                    {isAssigned && (
                      <span className="shrink-0 text-[10px] font-medium text-primary-500">Asignado</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {vendorTarget?.assigned_to && (
            <button
              type="button"
              onClick={() => handleConfirmAssignVendor('')}
              className="w-full text-sm text-danger-500 hover:text-danger-600 font-medium py-2"
            >
              Quitar asignación
            </button>
          )}
        </div>
      </Modal>

      {/* Start Conversation Modal */}
      <Modal
        isOpen={convModalOpen}
        onClose={() => { setConvModalOpen(false); setConvTarget(null); }}
        title={`Conversación con ${convTarget?.name ?? ''}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-surface-50 border border-surface-200 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600">
              {convTarget?.name?.charAt(0) ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-surface-900">{convTarget?.name}</p>
              <p className="text-xs text-surface-400">{convTarget?.phone ?? convTarget?.email ?? convTarget?.channel}</p>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 block mb-1.5">Mensaje inicial</label>
            <textarea
              rows={3}
              placeholder="Escribe el primer mensaje para este cliente..."
              value={convMessage}
              onChange={(e) => setConvMessage(e.target.value)}
              className={cn(
                'w-full rounded-lg border border-surface-200 px-3.5 py-2.5 text-sm text-surface-900',
                'placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none'
              )}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setConvModalOpen(false); setConvTarget(null); }}>
              Cancelar
            </Button>
            <Button
              disabled={!convMessage.trim()}
              loading={convSending}
              icon={<MessageSquare className="h-4 w-4" />}
              onClick={handleStartConversation}
            >
              Iniciar conversación
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingCustomer(null);
        }}
        title="Eliminar Cliente"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-600">
            ¿Estás seguro de que deseas eliminar a{' '}
            <span className="font-semibold text-surface-900">
              {deletingCustomer?.name}
            </span>
            ? Esta acción no se puede deshacer.
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteModalOpen(false);
                setDeletingCustomer(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
