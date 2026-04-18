'use client';

import type { ReactNode } from 'react';
import type { Customer } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

const channelLabels: Record<Customer['channel'], string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
};

interface CustomerDetailsProps {
  customer: Customer;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-surface-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-sm text-surface-900 break-words">
        {value || <span className="text-surface-300">—</span>}
      </p>
    </div>
  );
}

function CustomerDetails({ customer }: CustomerDetailsProps) {
  const createdAt = customer.created_at
    ? new Date(customer.created_at).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar name={customer.name} size="md" />
        <div className="min-w-0">
          <p className="text-base font-semibold text-surface-900">{customer.name}</p>
          <Badge variant="info" size="sm">
            {channelLabels[customer.channel]}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Correo electrónico" value={customer.email} />
        <Field label="Teléfono" value={customer.phone} />
        <Field label="RFC" value={customer.rfc} />
        <Field
          label="Descuento"
          value={
            customer.discount_percentage != null
              ? `${customer.discount_percentage}%`
              : ''
          }
        />
        <Field
          label="Vendedor asignado"
          value={customer.assigned_profile?.full_name}
        />
        <Field label="Fecha de alta" value={createdAt} />
      </div>

      <Field label="Dirección de entrega" value={customer.delivery_address} />
      <Field label="Notas" value={customer.notes} />
    </div>
  );
}

export { CustomerDetails };
export type { CustomerDetailsProps };
