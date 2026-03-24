'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  MessageCircle,
  MessagesSquare,
  Plus,
  Trash2,
  Hash,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChannelAssignment, AIAgent, ChannelType } from '@/types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface ChannelConfigProps {
  assignments: ChannelAssignment[];
  agents: AIAgent[];
  onAdd: (data: {
    channel: ChannelType;
    channel_identifier: string;
    label: string;
    agent_id: string;
  }) => void;
  onDelete: (id: string) => void;
}

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'messenger', label: 'Messenger' },
];

const channelMeta: Record<
  ChannelType,
  { icon: typeof MessageCircle; color: string; bg: string }
> = {
  whatsapp: {
    icon: MessageCircle,
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  instagram: {
    icon: MessageCircle,
    color: 'text-pink-600',
    bg: 'bg-pink-50',
  },
  messenger: {
    icon: MessagesSquare,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
};

function ChannelConfig({ assignments, agents, onAdd, onDelete }: ChannelConfigProps) {
  const [showForm, setShowForm] = useState(false);
  const [channel, setChannel] = useState<ChannelType>('whatsapp');
  const [identifier, setIdentifier] = useState('');
  const [label, setLabel] = useState('');
  const [agentId, setAgentId] = useState('');

  const agentOptions = agents
    .filter((a) => a.is_active)
    .map((a) => ({ value: a.id, label: a.name }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onAdd({ channel, channel_identifier: identifier, label, agent_id: agentId });
    setChannel('whatsapp');
    setIdentifier('');
    setLabel('');
    setAgentId('');
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-surface-900">
            Asignación de Canales
          </h3>
          <p className="text-sm text-surface-500 mt-0.5">
            Define qué agente de IA responde en cada canal y número
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          icon={<Plus className="h-4 w-4" />}
        >
          Nueva asignación
        </Button>
      </div>

      {/* Inline form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <Card className="border-primary-200 bg-primary-50/30">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Canal"
                    options={CHANNEL_OPTIONS}
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as ChannelType)}
                  />
                  <Input
                    label="Identificador"
                    placeholder="Ej: +52 55 1234 5678, @mi_pagina"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    icon={Hash}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Etiqueta"
                    placeholder='Ej: "Ventas", "Soporte", "Seguimiento"'
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                  <Select
                    label="Agente asignado"
                    options={agentOptions}
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    placeholder="Selecciona un agente"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowForm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm">
                    Agregar asignación
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assignments list */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {assignments.map((assignment) => {
            const meta = channelMeta[assignment.channel];
            const ChannelIcon = meta.icon;
            const agentName =
              assignment.agent?.name ??
              agents.find((a) => a.id === assignment.agent_id)?.name ??
              'Sin agente';

            return (
              <motion.div
                key={assignment.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-xl ${meta.bg}`}
                    >
                      <ChannelIcon className={`h-5 w-5 ${meta.color}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-surface-900 truncate">
                          {assignment.channel_identifier}
                        </span>
                        {assignment.label && (
                          <Badge variant="info" size="sm">
                            {assignment.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {assignment.channel.charAt(0).toUpperCase() +
                          assignment.channel.slice(1)}{' '}
                        &middot; Agente: {agentName}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDelete(assignment.id)}
                    className="shrink-0 rounded-lg p-2 text-surface-400 hover:text-danger-500 hover:bg-danger-50 transition-colors duration-150"
                    title="Eliminar asignación"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {assignments.length === 0 && (
          <div className="text-center py-12 text-surface-400">
            <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No hay canales configurados aún.</p>
            <p className="text-xs mt-1">
              Haz clic en &quot;Nueva asignación&quot; para comenzar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export { ChannelConfig };
