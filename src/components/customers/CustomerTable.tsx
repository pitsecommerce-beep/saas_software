'use client';

import type { Customer } from '@/types';
import { motion } from 'framer-motion';
import { Search, Pencil, Trash2, Users, MessageSquare, UserCheck } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';


const channelConfig: Record<
  Customer['channel'],
  { label: string; variant: 'success' | 'danger' | 'info'; className?: string }
> = {
  whatsapp: { label: 'WhatsApp', variant: 'success' },
  instagram: {
    label: 'Instagram',
    variant: 'danger',
    className: 'bg-pink-50 text-pink-700 border-pink-200',
  },
  messenger: { label: 'Messenger', variant: 'info' },
};

interface CustomerTableProps {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  onAssignVendor?: (customer: Customer) => void;
  onStartConversation?: (customer: Customer) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

function CustomerTable({
  customers,
  onEdit,
  onDelete,
  onAssignVendor,
  onStartConversation,
  searchQuery,
  onSearchChange,
}: CustomerTableProps) {
  const filtered = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email?.toLowerCase().includes(q) ?? false) ||
      (c.phone?.includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="max-w-sm">
        <Input
          icon={Search}
          placeholder="Buscar por nombre, email o teléfono..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-100 mb-4">
            <Users className="h-8 w-8 text-surface-400" />
          </div>
          <p className="text-surface-600 font-medium">No se encontraron clientes</p>
          <p className="text-sm text-surface-400 mt-1">
            {searchQuery
              ? 'Intenta con otro término de búsqueda'
              : 'Agrega tu primer cliente para comenzar'}
          </p>
        </motion.div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 bg-surface-50">
                <th className="px-4 py-3 text-left font-semibold text-surface-600">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left font-semibold text-surface-600 hidden sm:table-cell">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-semibold text-surface-600 hidden md:table-cell">
                  Teléfono
                </th>
                <th className="px-4 py-3 text-left font-semibold text-surface-600">
                  Canal
                </th>
                <th className="px-4 py-3 text-left font-semibold text-surface-600 hidden lg:table-cell">
                  Fecha de Alta
                </th>
                <th className="px-4 py-3 text-right font-semibold text-surface-600">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer, index) => {
                const channel = channelConfig[customer.channel];
                return (
                  <motion.tr
                    key={customer.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`border-b border-surface-50 transition-colors duration-150 hover:bg-primary-50/40 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-surface-50/50'
                    }`}
                  >
                    {/* Nombre */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={customer.name} size="sm" />
                        <span className="font-medium text-surface-900">
                          {customer.name}
                        </span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-surface-600 hidden sm:table-cell">
                      {customer.email || <span className="text-surface-300">—</span>}
                    </td>

                    {/* Teléfono */}
                    <td className="px-4 py-3 text-surface-600 hidden md:table-cell">
                      {customer.phone || <span className="text-surface-300">—</span>}
                    </td>

                    {/* Canal */}
                    <td className="px-4 py-3">
                      <Badge
                        variant={channel.variant}
                        size="sm"
                        className={channel.className}
                      >
                        {channel.label}
                      </Badge>
                    </td>

                    {/* Fecha de Alta */}
                    <td className="px-4 py-3 text-surface-500 hidden lg:table-cell">
                      {new Date(customer.created_at).toLocaleDateString('es-MX', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {onStartConversation && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<MessageSquare className="h-4 w-4 text-primary-500" />}
                            onClick={() => onStartConversation(customer)}
                            aria-label={`Iniciar conversación con ${customer.name}`}
                            title="Iniciar conversación"
                          />
                        )}
                        {onAssignVendor && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<UserCheck className="h-4 w-4 text-violet-500" />}
                            onClick={() => onAssignVendor(customer)}
                            aria-label={`Asignar vendedor a ${customer.name}`}
                            title="Asignar vendedor"
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil className="h-4 w-4" />}
                          onClick={() => onEdit(customer)}
                          aria-label={`Editar ${customer.name}`}
                          title="Editar"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="h-4 w-4 text-danger-500" />}
                          onClick={() => onDelete(customer)}
                          aria-label={`Eliminar ${customer.name}`}
                          title="Eliminar"
                        />
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export { CustomerTable };
export type { CustomerTableProps };
