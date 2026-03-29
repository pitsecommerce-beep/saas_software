'use client';

import { useState, useEffect } from 'react';
import type { Customer, ChannelType } from '@/types';
import { motion } from 'framer-motion';
import { UserPlus, FileSpreadsheet, Upload, Download, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useCustomerStore } from '@/stores/customerStore';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { CustomerTable } from '@/components/customers/CustomerTable';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { TemplateDownloader } from '@/components/excel/TemplateDownloader';

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
  } = useCustomerStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Fetch customers from Supabase when the team is available
  useEffect(() => {
    if (team?.id) {
      fetchCustomers(team.id);
    }
  }, [team?.id, fetchCustomers]);

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
          notes: data.notes || undefined,
        });
      } else {
        await addCustomer({
          team_id: team.id,
          name: data.name,
          email: data.email || undefined,
          phone: data.phone || undefined,
          channel: data.channel,
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
