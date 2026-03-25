'use client';

import { useState, useEffect } from 'react';
import type { Customer, ChannelType } from '@/types';
import { motion } from 'framer-motion';
import { UserPlus, FileSpreadsheet } from 'lucide-react';
import { useDemoStore } from '@/stores/demoStore';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { CustomerTable } from '@/components/customers/CustomerTable';
import { CustomerForm } from '@/components/customers/CustomerForm';

// TODO: Replace with useCustomerStore when Supabase is connected
const initialCustomers: Customer[] = [
  {
    id: '1',
    team_id: 'team-1',
    name: 'María González López',
    email: 'maria.gonzalez@gmail.com',
    phone: '+52 55 1234 5678',
    channel: 'whatsapp',
    notes: 'Cliente frecuente, prefiere pago con tarjeta',
    created_at: '2025-11-15T10:30:00Z',
    updated_at: '2026-01-20T14:00:00Z',
  },
  {
    id: '2',
    team_id: 'team-1',
    name: 'Carlos Hernández Ruiz',
    email: 'carlos.hdz@hotmail.com',
    phone: '+52 33 9876 5432',
    channel: 'instagram',
    created_at: '2025-12-03T08:15:00Z',
    updated_at: '2026-02-10T09:30:00Z',
  },
  {
    id: '3',
    team_id: 'team-1',
    name: 'Ana Sofía Martínez',
    email: 'ansofi.mtz@outlook.com',
    phone: '+52 81 5555 1234',
    channel: 'whatsapp',
    notes: 'Interesada en paquetes mayoreo',
    created_at: '2025-12-20T16:45:00Z',
    updated_at: '2026-03-01T11:20:00Z',
  },
  {
    id: '4',
    team_id: 'team-1',
    name: 'Roberto Díaz Vargas',
    phone: '+52 55 8765 4321',
    channel: 'messenger',
    created_at: '2026-01-05T12:00:00Z',
    updated_at: '2026-01-05T12:00:00Z',
  },
  {
    id: '5',
    team_id: 'team-1',
    name: 'Fernanda Ramírez Castro',
    email: 'fer.ramirez@yahoo.com',
    phone: '+52 222 333 4455',
    channel: 'instagram',
    notes: 'Referida por María González',
    created_at: '2026-01-18T09:00:00Z',
    updated_at: '2026-02-28T15:45:00Z',
  },
  {
    id: '6',
    team_id: 'team-1',
    name: 'José Luis Morales',
    email: 'jlmorales@empresa.mx',
    phone: '+52 55 6677 8899',
    channel: 'whatsapp',
    created_at: '2026-02-01T14:30:00Z',
    updated_at: '2026-03-15T10:00:00Z',
  },
  {
    id: '7',
    team_id: 'team-1',
    name: 'Guadalupe Torres Medina',
    email: 'lupe.torres@gmail.com',
    channel: 'messenger',
    notes: 'Solicita factura en cada compra',
    created_at: '2026-02-14T11:00:00Z',
    updated_at: '2026-03-10T16:30:00Z',
  },
  {
    id: '8',
    team_id: 'team-1',
    name: 'Miguel Ángel Sánchez',
    phone: '+52 664 123 4567',
    channel: 'whatsapp',
    created_at: '2026-02-28T17:20:00Z',
    updated_at: '2026-02-28T17:20:00Z',
  },
  {
    id: '9',
    team_id: 'team-1',
    name: 'Patricia Flores Olvera',
    email: 'patty.flores@live.com',
    phone: '+52 55 2233 4455',
    channel: 'instagram',
    notes: 'Compra regalos corporativos',
    created_at: '2026-03-05T08:45:00Z',
    updated_at: '2026-03-20T13:15:00Z',
  },
  {
    id: '10',
    team_id: 'team-1',
    name: 'Alejandro Vega Núñez',
    email: 'alex.vega@protonmail.com',
    phone: '+52 442 987 6543',
    channel: 'whatsapp',
    created_at: '2026-03-12T10:10:00Z',
    updated_at: '2026-03-22T09:00:00Z',
  },
];

export default function CustomersPage() {
  const { isDemoMode } = useDemoStore();
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    setCustomers(isDemoMode ? initialCustomers : []);
  }, [isDemoMode]);
  const [searchQuery, setSearchQuery] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [formLoading, setFormLoading] = useState(false);

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
  function handleDeleteConfirm() {
    if (!deletingCustomer) return;
    setCustomers((prev) => prev.filter((c) => c.id !== deletingCustomer.id));
    setDeleteModalOpen(false);
    setDeletingCustomer(null);
  }

  // Handle form submit (create / edit)
  function handleFormSubmit(data: {
    name: string;
    email: string;
    phone: string;
    channel: ChannelType;
    notes: string;
  }) {
    setFormLoading(true);

    // Simulate async operation
    setTimeout(() => {
      if (editingCustomer) {
        // Update
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === editingCustomer.id
              ? {
                  ...c,
                  ...data,
                  email: data.email || undefined,
                  phone: data.phone || undefined,
                  notes: data.notes || undefined,
                  updated_at: new Date().toISOString(),
                }
              : c
          )
        );
      } else {
        // Create
        const newCustomer: Customer = {
          id: crypto.randomUUID(),
          team_id: 'team-1',
          name: data.name,
          email: data.email || undefined,
          phone: data.phone || undefined,
          channel: data.channel,
          notes: data.notes || undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setCustomers((prev) => [newCustomer, ...prev]);
      }

      setFormLoading(false);
      setFormModalOpen(false);
      setEditingCustomer(null);
    }, 500);
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
      >
        {/* TODO: Replace with ExcelUploader component */}
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileSpreadsheet className="h-12 w-12 text-surface-300 mb-4" />
          <p className="text-surface-500 font-medium">
            Componente de carga Excel
          </p>
          <p className="text-sm text-surface-400 mt-1">
            Arrastra un archivo .xlsx o .csv para importar clientes
          </p>
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
