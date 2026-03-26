import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, MessagesSquare, Bot, Trash2, Link2, Unlink, ArrowRight } from 'lucide-react';
import type { ChannelAssignment, AIAgent, ChannelType } from '@/types';
import { Badge } from '@/components/ui/Badge';

interface ChannelAgentConnectorProps {
  assignments: ChannelAssignment[];
  agents: AIAgent[];
  onUpdateAssignment: (assignmentId: string, agentId: string) => void;
  onDeleteAssignment: (assignmentId: string) => void;
}

const channelMeta: Record<ChannelType, { label: string; color: string; bg: string; border: string; icon: typeof MessageCircle }> = {
  whatsapp: {
    label: 'WhatsApp',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: MessageCircle,
  },
  instagram: {
    label: 'Instagram',
    color: 'text-pink-700',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    icon: MessageCircle,
  },
  messenger: {
    label: 'Messenger',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: MessagesSquare,
  },
};

export function ChannelAgentConnector({
  assignments,
  agents,
  onUpdateAssignment,
  onDeleteAssignment,
}: ChannelAgentConnectorProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);

  const selectedAssignment = assignments.find((a) => a.id === selectedChannelId);

  const handleChannelClick = (id: string) => {
    setSelectedChannelId((prev) => (prev === id ? null : id));
  };

  const handleAgentClick = (agentId: string) => {
    if (!selectedChannelId) return;
    onUpdateAssignment(selectedChannelId, agentId);
    setSelectedChannelId(null);
  };

  const getAgentForAssignment = (assignment: ChannelAssignment) =>
    agents.find((a) => a.id === assignment.agent_id);

  if (assignments.length === 0 && agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-surface-400">
        <div className="flex items-center gap-4 mb-4 opacity-40">
          <MessageCircle className="h-10 w-10" />
          <div className="flex items-center gap-1">
            <div className="w-8 h-0.5 bg-surface-300" />
            <div className="w-2 h-2 rounded-full bg-surface-300" />
            <div className="w-8 h-0.5 bg-surface-300" />
          </div>
          <Bot className="h-10 w-10" />
        </div>
        <p className="text-sm font-medium">Sin canales ni agentes</p>
        <p className="text-xs mt-1">Primero crea canales y agentes en las pestañas anteriores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="rounded-xl bg-primary-50 border border-primary-100 px-4 py-3">
        <p className="text-sm text-primary-700">
          <strong>Conecta canales con agentes:</strong>{' '}
          {selectedChannelId
            ? 'Ahora selecciona el agente que quieres asignar a este canal.'
            : 'Selecciona un canal de la izquierda y luego el agente que lo atenderá.'}
        </p>
      </div>

      {/* Connector layout */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
        {/* Channels column */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider px-1">
            Canales
          </p>
          <AnimatePresence mode="popLayout">
            {assignments.map((assignment) => {
              const meta = channelMeta[assignment.channel];
              const Icon = meta.icon;
              const isSelected = selectedChannelId === assignment.id;
              const currentAgent = getAgentForAssignment(assignment);

              return (
                <motion.button
                  key={assignment.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  onClick={() => handleChannelClick(assignment.id)}
                  className={`w-full text-left rounded-xl border-2 p-3 transition-all duration-200 ${
                    isSelected
                      ? `${meta.border} ${meta.bg} shadow-sm`
                      : 'border-surface-200 bg-white hover:border-surface-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${meta.bg}`}>
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-surface-900 truncate">
                          {assignment.channel_identifier}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge variant="neutral" size="sm">{meta.label}</Badge>
                        {assignment.label && (
                          <Badge variant="info" size="sm">{assignment.label}</Badge>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0 animate-pulse" />
                    )}
                  </div>

                  {/* Current connection display */}
                  {currentAgent && !isSelected && (
                    <div className="mt-2 pt-2 border-t border-surface-100 flex items-center gap-1.5">
                      <Link2 className="h-3 w-3 text-surface-400" />
                      <span className="text-xs text-surface-500 truncate">{currentAgent.name}</span>
                    </div>
                  )}

                  {/* Disconnect button */}
                  {assignment.agent_id && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAssignment(assignment.id);
                        if (selectedChannelId === assignment.id) setSelectedChannelId(null);
                      }}
                      className="mt-2 flex items-center gap-1 text-xs text-surface-400 hover:text-danger-500 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                      Eliminar
                    </button>
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>

          {assignments.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-surface-200 p-6 text-center text-surface-400">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">Agrega canales en la pestaña "Canales"</p>
            </div>
          )}
        </div>

        {/* Center connector arrows */}
        <div className="flex flex-col items-center gap-3 pt-8">
          {assignments.map((assignment) => {
            const isSelected = selectedChannelId === assignment.id;
            const hasAgent = Boolean(assignment.agent_id);
            return (
              <div
                key={assignment.id}
                className="h-[76px] flex items-center justify-center"
              >
                <div className={`flex items-center gap-1 transition-all duration-300 ${
                  isSelected
                    ? 'text-primary-500 scale-110'
                    : hasAgent
                    ? 'text-accent-500'
                    : 'text-surface-300'
                }`}>
                  <div className={`w-4 h-0.5 ${isSelected ? 'bg-primary-400' : hasAgent ? 'bg-accent-400' : 'bg-surface-200'}`} />
                  {isSelected ? (
                    <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 0.8 }}>
                      <ArrowRight className="h-4 w-4" />
                    </motion.div>
                  ) : hasAgent ? (
                    <Link2 className="h-3.5 w-3.5" />
                  ) : (
                    <Unlink className="h-3.5 w-3.5 opacity-50" />
                  )}
                  <div className={`w-4 h-0.5 ${isSelected ? 'bg-primary-400' : hasAgent ? 'bg-accent-400' : 'bg-surface-200'}`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Agents column */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider px-1">
            Agentes de IA
          </p>
          {agents.map((agent) => {
            const assignedChannels = assignments.filter((a) => a.agent_id === agent.id);
            const isTargeted =
              selectedChannelId !== null &&
              (hoveredAgentId === agent.id ||
                assignments.find((a) => a.id === selectedChannelId)?.agent_id === agent.id);

            return (
              <motion.button
                key={agent.id}
                layout
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => handleAgentClick(agent.id)}
                onMouseEnter={() => selectedChannelId && setHoveredAgentId(agent.id)}
                onMouseLeave={() => setHoveredAgentId(null)}
                disabled={!selectedChannelId}
                className={`w-full text-left rounded-xl border-2 p-3 transition-all duration-200 ${
                  isTargeted
                    ? 'border-primary-400 bg-primary-50 shadow-sm'
                    : selectedChannelId
                    ? 'border-surface-200 bg-white hover:border-primary-300 hover:bg-primary-50/50 cursor-pointer'
                    : 'border-surface-200 bg-white'
                } ${!agent.is_active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50">
                    <Bot className="h-4 w-4 text-primary-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-surface-900 truncate block">
                      {agent.name}
                    </span>
                    <Badge variant={agent.is_active ? 'success' : 'neutral'} size="sm">
                      {agent.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>

                {assignedChannels.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-surface-100 flex items-center gap-1.5 flex-wrap">
                    <Link2 className="h-3 w-3 text-surface-400 shrink-0" />
                    <span className="text-xs text-surface-500">
                      {assignedChannels.length} canal{assignedChannels.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                )}
              </motion.button>
            );
          })}

          {agents.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-surface-200 p-6 text-center text-surface-400">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">Agrega agentes en la pestaña "Agentes de IA"</p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 pt-2 text-xs text-surface-400 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 text-accent-500" />
          <span>Canal conectado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Unlink className="h-3.5 w-3.5 text-surface-300" />
          <span>Sin agente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
          <span>Seleccionando...</span>
        </div>
      </div>
    </div>
  );
}
