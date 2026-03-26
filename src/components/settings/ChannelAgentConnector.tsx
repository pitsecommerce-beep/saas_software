import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, MessagesSquare, Bot, Trash2, Link2, Unlink, Zap } from 'lucide-react';
import type { ChannelAssignment, AIAgent, ChannelType } from '@/types';
import { Badge } from '@/components/ui/Badge';

interface ChannelAgentConnectorProps {
  assignments: ChannelAssignment[];
  agents: AIAgent[];
  onUpdateAssignment: (assignmentId: string, agentId: string) => void;
  onDeleteAssignment: (assignmentId: string) => void;
}

const channelMeta: Record<ChannelType, { label: string; color: string; bg: string; border: string; accent: string; icon: typeof MessageCircle }> = {
  whatsapp: {
    label: 'WhatsApp',
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-300',
    accent: '#22c55e',
    icon: MessageCircle,
  },
  instagram: {
    label: 'Instagram',
    color: 'text-pink-600',
    bg: 'bg-pink-50',
    border: 'border-pink-300',
    accent: '#ec4899',
    icon: MessageCircle,
  },
  messenger: {
    label: 'Messenger',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    accent: '#3b82f6',
    icon: MessagesSquare,
  },
};

// ── Animated SVG cable ──────────────────────────────────────────────
interface CableProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  active: boolean;
  selecting: boolean;
}

function Cable({ from, to, color, active, selecting }: CableProps) {
  const dx = to.x - from.x;
  const cp = dx * 0.5; // control-point offset for a smooth S-curve

  const d = `M ${from.x} ${from.y} C ${from.x + cp} ${from.y}, ${to.x - cp} ${to.y}, ${to.x} ${to.y}`;

  return (
    <g>
      {/* Glow behind the cable */}
      {active && (
        <motion.path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.2 }}
          style={{ filter: 'blur(4px)' }}
        />
      )}

      {/* Cable line */}
      <motion.path
        d={d}
        fill="none"
        stroke={active ? color : '#d1d5db'}
        strokeWidth={active ? 2.5 : 1.5}
        strokeLinecap="round"
        strokeDasharray={selecting ? '6 4' : 'none'}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: 1,
          opacity: 1,
          strokeDashoffset: selecting ? [0, -20] : 0,
        }}
        transition={
          selecting
            ? { strokeDashoffset: { repeat: Infinity, duration: 0.6, ease: 'linear' }, pathLength: { duration: 0.5 } }
            : { pathLength: { duration: 0.5, ease: 'easeOut' } }
        }
      />

      {/* Animated dot traveling along the cable */}
      {active && !selecting && (
        <motion.circle
          r={3}
          fill={color}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <animateMotion dur="2s" repeatCount="indefinite" path={d} />
        </motion.circle>
      )}

      {/* Endpoint dots */}
      <motion.circle
        cx={from.x}
        cy={from.y}
        r={active ? 4 : 3}
        fill={active ? color : '#d1d5db'}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
      />
      <motion.circle
        cx={to.x}
        cy={to.y}
        r={active ? 4 : 3}
        fill={active ? color : '#d1d5db'}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.4, type: 'spring', stiffness: 300 }}
      />
    </g>
  );
}

// ── Main Component ──────────────────────────────────────────────────
export function ChannelAgentConnector({
  assignments,
  agents,
  onUpdateAssignment,
  onDeleteAssignment,
}: ChannelAgentConnectorProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);

  // Refs for measuring positions
  const containerRef = useRef<HTMLDivElement>(null);
  const channelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const agentRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [cables, setCables] = useState<Array<{
    id: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
    color: string;
    active: boolean;
    selecting: boolean;
  }>>([]);

  // ── Calculate cable positions ────────────────────────────────────
  const recalcCables = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const newCables: typeof cables = [];

    assignments.forEach((assignment) => {
      const chEl = channelRefs.current[assignment.id];
      const agEl = assignment.agent_id ? agentRefs.current[assignment.agent_id] : null;
      const meta = channelMeta[assignment.channel];

      if (!chEl) return;

      const chRect = chEl.getBoundingClientRect();
      const fromX = chRect.right - rect.left;
      const fromY = chRect.top + chRect.height / 2 - rect.top;

      if (agEl) {
        const agRect = agEl.getBoundingClientRect();
        const toX = agRect.left - rect.left;
        const toY = agRect.top + agRect.height / 2 - rect.top;

        newCables.push({
          id: assignment.id,
          from: { x: fromX, y: fromY },
          to: { x: toX, y: toY },
          color: meta.accent,
          active: true,
          selecting: selectedChannelId === assignment.id,
        });
      } else if (selectedChannelId === assignment.id && hoveredAgentId) {
        // Show a preview cable to the hovered agent
        const hovEl = agentRefs.current[hoveredAgentId];
        if (hovEl) {
          const hovRect = hovEl.getBoundingClientRect();
          newCables.push({
            id: assignment.id + '-preview',
            from: { x: fromX, y: fromY },
            to: { x: hovRect.left - rect.left, y: hovRect.top + hovRect.height / 2 - rect.top },
            color: meta.accent,
            active: false,
            selecting: true,
          });
        }
      }
    });

    setCables(newCables);
  }, [assignments, selectedChannelId, hoveredAgentId]);

  useEffect(() => {
    // Use rAF to avoid synchronous setState inside the effect body (eslint react-hooks/set-state-in-effect)
    const id = requestAnimationFrame(recalcCables);
    window.addEventListener('resize', recalcCables);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', recalcCables);
    };
  }, [recalcCables]);

  // Recalc on layout shift (small delay for framer-motion animations)
  useEffect(() => {
    const t = setTimeout(recalcCables, 100);
    return () => clearTimeout(t);
  }, [assignments, agents, selectedChannelId, hoveredAgentId, recalcCables]);

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
        <div className="flex items-center gap-6 mb-5 opacity-40">
          <MessageCircle className="h-12 w-12" />
          <svg width="80" height="2" className="text-surface-300">
            <line x1="0" y1="1" x2="80" y2="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
          </svg>
          <Bot className="h-12 w-12" />
        </div>
        <p className="text-sm font-medium">Sin canales ni agentes</p>
        <p className="text-xs mt-1">Primero crea canales y agentes en las pestañas anteriores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Instructions */}
      <motion.div
        layout
        className="rounded-xl bg-gradient-to-r from-primary-50 to-accent-50 border border-primary-100 px-4 py-3"
      >
        <p className="text-sm text-primary-700 flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary-500 shrink-0" />
          <span>
            {selectedChannelId
              ? 'Ahora selecciona el agente que quieres asignar a este canal.'
              : 'Selecciona un canal y luego el agente que lo atenderá.'}
          </span>
        </p>
      </motion.div>

      {/* Connector layout */}
      <div ref={containerRef} className="relative grid grid-cols-[1fr_1fr] gap-16 items-start min-h-[200px]">
        {/* SVG cables overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ overflow: 'visible' }}>
          <AnimatePresence>
            {cables.map((cable) => (
              <Cable
                key={cable.id}
                from={cable.from}
                to={cable.to}
                color={cable.color}
                active={cable.active}
                selecting={cable.selecting}
              />
            ))}
          </AnimatePresence>
        </svg>

        {/* Channels column */}
        <div className="space-y-3 relative z-20">
          <div className="flex items-center gap-2 px-1 mb-1">
            <MessageCircle className="h-3.5 w-3.5 text-surface-400" />
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
              Canales
            </p>
          </div>
          <AnimatePresence mode="popLayout">
            {assignments.map((assignment, i) => {
              const meta = channelMeta[assignment.channel];
              const Icon = meta.icon;
              const isSelected = selectedChannelId === assignment.id;
              const currentAgent = getAgentForAssignment(assignment);

              return (
                <motion.button
                  key={assignment.id}
                  ref={(el) => { channelRefs.current[assignment.id] = el; }}
                  layout
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.95 }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
                  onClick={() => handleChannelClick(assignment.id)}
                  className={`w-full text-left rounded-2xl border-2 p-3.5 transition-all duration-300 group ${
                    isSelected
                      ? `${meta.border} ${meta.bg} shadow-lg shadow-${assignment.channel === 'whatsapp' ? 'green' : assignment.channel === 'instagram' ? 'pink' : 'blue'}-100 ring-2 ring-${assignment.channel === 'whatsapp' ? 'green' : assignment.channel === 'instagram' ? 'pink' : 'blue'}-200/50`
                      : 'border-surface-200 bg-white hover:border-surface-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`relative flex items-center justify-center w-10 h-10 rounded-xl ${meta.bg} transition-transform duration-200 group-hover:scale-110`}>
                      <Icon className={`h-5 w-5 ${meta.color}`} />
                      {isSelected && (
                        <motion.div
                          className="absolute inset-0 rounded-xl border-2"
                          style={{ borderColor: meta.accent }}
                          animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-surface-900 truncate block">
                        {assignment.channel_identifier}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="neutral" size="sm">{meta.label}</Badge>
                        {assignment.label && (
                          <Badge variant="info" size="sm">{assignment.label}</Badge>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <motion.div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: meta.accent }}
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      />
                    )}
                  </div>

                  {/* Current connection */}
                  {currentAgent && !isSelected && (
                    <div className="mt-2.5 pt-2 border-t border-surface-100 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-500" />
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
                      className="mt-2 flex items-center gap-1 text-xs text-surface-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                      Desconectar
                    </button>
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>

          {assignments.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-surface-200 p-8 text-center text-surface-400">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">Agrega canales en la pestaña "Canales"</p>
            </div>
          )}
        </div>

        {/* Agents column */}
        <div className="space-y-3 relative z-20">
          <div className="flex items-center gap-2 px-1 mb-1">
            <Bot className="h-3.5 w-3.5 text-surface-400" />
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
              Agentes de IA
            </p>
          </div>
          {agents.map((agent, i) => {
            const assignedChannels = assignments.filter((a) => a.agent_id === agent.id);
            const isTargeted =
              selectedChannelId !== null &&
              (hoveredAgentId === agent.id ||
                assignments.find((a) => a.id === selectedChannelId)?.agent_id === agent.id);

            return (
              <motion.button
                key={agent.id}
                ref={(el) => { agentRefs.current[agent.id] = el; }}
                layout
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
                onClick={() => handleAgentClick(agent.id)}
                onMouseEnter={() => selectedChannelId && setHoveredAgentId(agent.id)}
                onMouseLeave={() => setHoveredAgentId(null)}
                disabled={!selectedChannelId}
                className={`w-full text-left rounded-2xl border-2 p-3.5 transition-all duration-300 group ${
                  isTargeted
                    ? 'border-primary-400 bg-primary-50 shadow-lg shadow-primary-100 ring-2 ring-primary-200/50'
                    : selectedChannelId
                    ? 'border-surface-200 bg-white hover:border-primary-300 hover:bg-primary-50/50 hover:shadow-md cursor-pointer'
                    : 'border-surface-200 bg-white'
                } ${!agent.is_active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`relative flex items-center justify-center w-10 h-10 rounded-xl bg-primary-50 transition-transform duration-200 ${selectedChannelId ? 'group-hover:scale-110' : ''}`}>
                    <Bot className="h-5 w-5 text-primary-500" />
                    {isTargeted && (
                      <motion.div
                        className="absolute inset-0 rounded-xl border-2 border-primary-400"
                        animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-surface-900 truncate block">
                      {agent.name}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant={agent.is_active ? 'success' : 'neutral'} size="sm">
                        {agent.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {assignedChannels.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-surface-100 flex items-center gap-2 flex-wrap">
                    {assignedChannels.map((ac) => {
                      const m = channelMeta[ac.channel];
                      return (
                        <span
                          key={ac.id}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${m.bg} ${m.color}`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.accent }} />
                          {m.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </motion.button>
            );
          })}

          {agents.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-surface-200 p-8 text-center text-surface-400">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">Agrega agentes en la pestaña "Agentes de IA"</p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 pt-2 text-xs text-surface-400 flex-wrap justify-center">
        <div className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 text-accent-500" />
          <span>Conectado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Unlink className="h-3.5 w-3.5 text-surface-300" />
          <span>Sin agente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.div
            className="w-2 h-2 rounded-full bg-primary-500"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
          <span>Seleccionando...</span>
        </div>
      </div>
    </div>
  );
}
