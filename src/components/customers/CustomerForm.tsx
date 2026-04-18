'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Customer, ChannelType } from '@/types';
import { DEFAULT_CUSTOMER_DISCOUNT } from '@/types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';

const channelOptions = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'messenger', label: 'Messenger' },
];

interface CustomerFormProps {
  customer: Customer | null;
  onSubmit: (data: {
    name: string;
    email: string;
    phone: string;
    channel: ChannelType;
    rfc: string;
    delivery_address: string;
    discount_percentage: number;
    notes: string;
  }) => void;
  onCancel: () => void;
  loading: boolean;
}

function CustomerForm({ customer, onSubmit, onCancel, loading }: CustomerFormProps) {
  const [name, setName] = useState(customer?.name ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [channel, setChannel] = useState<ChannelType>(customer?.channel ?? 'whatsapp');
  const [rfc, setRfc] = useState(customer?.rfc ?? '');
  const [deliveryAddress, setDeliveryAddress] = useState(customer?.delivery_address ?? '');
  const [discountPercentage, setDiscountPercentage] = useState<string>(
    customer?.discount_percentage != null
      ? String(customer.discount_percentage)
      : String(DEFAULT_CUSTOMER_DISCOUNT)
  );
  const [notes, setNotes] = useState(customer?.notes ?? '');

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!name.trim()) {
      errs.name = 'El nombre es obligatorio';
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Formato de email inválido';
    }

    const parsedDiscount = parseFloat(discountPercentage);
    if (Number.isNaN(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100) {
      errs.discount_percentage = 'Ingresa un porcentaje entre 0 y 100';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      channel,
      rfc: rfc.trim(),
      delivery_address: deliveryAddress.trim(),
      discount_percentage: parseFloat(discountPercentage),
      notes: notes.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Nombre"
        placeholder="Nombre completo"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        required
      />

      <Input
        label="Email"
        type="email"
        placeholder="correo@ejemplo.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />

      <Input
        label="Teléfono"
        type="tel"
        placeholder="+52 55 1234 5678"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      <Select
        label="Canal"
        options={channelOptions}
        value={channel}
        onChange={(e) => setChannel(e.target.value as ChannelType)}
      />

      <Input
        label="RFC"
        placeholder="XAXX010101000"
        value={rfc}
        onChange={(e) => setRfc(e.target.value)}
      />

      <Textarea
        label="Dirección de entrega"
        placeholder="Calle, número, colonia, ciudad, estado, CP"
        value={deliveryAddress}
        onChange={(e) => setDeliveryAddress(e.target.value)}
        rows={2}
      />

      <div>
        <Input
          label={`Descuento sobre precio de lista (%) — default ${DEFAULT_CUSTOMER_DISCOUNT}%`}
          type="number"
          min={0}
          max={100}
          step={0.5}
          placeholder={String(DEFAULT_CUSTOMER_DISCOUNT)}
          value={discountPercentage}
          onChange={(e) => setDiscountPercentage(e.target.value)}
          error={errors.discount_percentage}
        />
        <p className="mt-1 text-xs text-surface-500">
          Se aplica al precio de venta (lista) en cada pedido del cliente. Se puede modificar manualmente.
        </p>
      </div>

      <Textarea
        label="Notas"
        placeholder="Notas adicionales sobre el cliente..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
      />

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          {customer ? 'Guardar Cambios' : 'Crear Cliente'}
        </Button>
      </div>
    </form>
  );
}

export { CustomerForm };
export type { CustomerFormProps };
