'use client';

import { useState } from 'react';
import {
  Bot,
  MessageCircle,
  Settings,
  Plus,
  Sparkles,
  Building2,
  Globe,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AIAgent, ChannelAssignment, ChannelType } from '@/types';
import { AI_PROVIDERS } from '@/config/modules';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Toggle';
import { AIAgentConfig } from '@/components/settings/AIAgentConfig';
import { ChannelConfig } from '@/components/settings/ChannelConfig';
import { cn } from '@/lib/utils';
import { useDemoStore } from '@/stores/demoStore';

// ---------------------------------------------------------------------------
// Mock data
// TODO: Replace with Supabase operations when connected
// ---------------------------------------------------------------------------

const MOCK_AGENTS: AIAgent[] = [
  {
    id: 'agent-1',
    team_id: 'team-1',
    name: 'Asistente de Ventas',
    provider: 'openai',
    model: 'gpt-4o',
    api_key_encrypted: 'sk-••••••••••••••••',
    system_prompt:
      'Eres el asistente virtual de ventas. Ayuda a los clientes a conocer nuestros productos, generar cotizaciones y cerrar ventas. Consulta la base de conocimiento para precios actualizados.',
    is_active: true,
    created_at: '2026-02-15T10:00:00Z',
  },
  {
    id: 'agent-2',
    team_id: 'team-1',
    name: 'Soporte Técnico',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    api_key_encrypted: 'sk-ant-••••••••••••••••',
    system_prompt:
      'Eres el agente de soporte técnico. Resuelve dudas sobre productos, garantías y procesos de devolución. Escala al equipo humano cuando sea necesario.',
    is_active: false,
    created_at: '2026-03-01T14:30:00Z',
  },
];

const MOCK_ASSIGNMENTS: ChannelAssignment[] = [
  {
    id: 'assign-1',
    team_id: 'team-1',
    agent_id: 'agent-1',
    agent: MOCK_AGENTS[0],
    channel: 'whatsapp',
    channel_identifier: '+52 55 1234 5678',
    label: 'Ventas',
    created_at: '2026-02-20T09:00:00Z',
  },
  {
    id: 'assign-2',
    team_id: 'team-1',
    agent_id: 'agent-1',
    agent: MOCK_AGENTS[0],
    channel: 'instagram',
    channel_identifier: '@mi_tienda_oficial',
    label: 'Seguimiento',
    created_at: '2026-02-22T11:00:00Z',
  },
  {
    id: 'assign-3',
    team_id: 'team-1',
    agent_id: 'agent-2',
    agent: MOCK_AGENTS[1],
    channel: 'messenger',
    channel_identifier: 'Mi Tienda - Página',
    label: 'Soporte',
    created_at: '2026-03-05T16:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type TabId = 'agents' | 'channels' | 'general';

const TABS: { id: TabId; label: string; icon: typeof Bot }[] = [
  { id: 'agents', label: 'Agentes de IA', icon: Bot },
  { id: 'channels', label: 'Canales', icon: MessageCircle },
  { id: 'general', label: 'General', icon: Settings },
];

// ---------------------------------------------------------------------------
// Timezone options (subset for brevity)
// ---------------------------------------------------------------------------

const TIMEZONE_OPTIONS = [
  { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
  { value: 'America/Monterrey', label: 'Monterrey (GMT-6)' },
  { value: 'America/Cancun', label: 'Cancún (GMT-5)' },
  { value: 'America/Tijuana', label: 'Tijuana (GMT-8)' },
  { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
  { value: 'America/Lima', label: 'Lima (GMT-5)' },
  { value: 'America/Santiago', label: 'Santiago (GMT-4)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SettingsPage() {
  const { isDemoMode } = useDemoStore();
  const [activeTab, setActiveTab] = useState<TabId>('agents');
  const [agents, setAgents] = useState<AIAgent[]>(isDemoMode ? MOCK_AGENTS : []);
  const [assignments, setAssignments] = useState<ChannelAssignment[]>(
    isDemoMode ? MOCK_ASSIGNMENTS : []
  );
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [showAgentModal, setShowAgentModal] = useState(false);

  // General settings state
  const [companyName, setCompanyName] = useState('Mi Empresa S.A. de C.V.');
  const [businessType] = useState('retailer');
  const [timezone, setTimezone] = useState('America/Mexico_City');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(true);

  // ---------------------------------------------------------------------------
  // Handlers
  // TODO: Replace with Supabase operations when connected
  // ---------------------------------------------------------------------------

  const handleAgentSubmit = (
    data: Omit<AIAgent, 'id' | 'team_id' | 'created_at'>
  ) => {
    if (editingAgent) {
      setAgents((prev) =>
        prev.map((a) => (a.id === editingAgent.id ? { ...a, ...data } : a))
      );
    } else {
      const newAgent: AIAgent = {
        ...data,
        id: `agent-${Date.now()}`,
        team_id: 'team-1',
        created_at: new Date().toISOString(),
      };
      setAgents((prev) => [...prev, newAgent]);
    }
    setShowAgentModal(false);
    setEditingAgent(null);
  };

  const handleAgentCancel = () => {
    setShowAgentModal(false);
    setEditingAgent(null);
  };

  const handleAddAssignment = (data: {
    channel: ChannelType;
    channel_identifier: string;
    label: string;
    agent_id: string;
  }) => {
    const agent = agents.find((a) => a.id === data.agent_id);
    const newAssignment: ChannelAssignment = {
      id: `assign-${Date.now()}`,
      team_id: 'team-1',
      agent_id: data.agent_id,
      agent,
      channel: data.channel,
      channel_identifier: data.channel_identifier,
      label: data.label || undefined,
      created_at: new Date().toISOString(),
    };
    setAssignments((prev) => [...prev, newAssignment]);
  };

  const handleDeleteAssignment = (id: string) => {
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  };

  const openEditAgent = (agent: AIAgent) => {
    setEditingAgent(agent);
    setShowAgentModal(true);
  };

  const openNewAgent = () => {
    setEditingAgent(null);
    setShowAgentModal(true);
  };

  // ---------------------------------------------------------------------------
  // Provider helper
  // ---------------------------------------------------------------------------

  const getProviderName = (providerId: string) =>
    AI_PROVIDERS.find((p) => p.id === providerId)?.name ?? providerId;

  const getModelName = (providerId: string, modelId: string) => {
    const prov = AI_PROVIDERS.find((p) => p.id === providerId);
    return prov?.models.find((m) => m.id === modelId)?.name ?? modelId;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-surface-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-surface-900">
            Configuración
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Administra tus agentes de IA, canales de comunicación y
            preferencias generales.
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 rounded-xl bg-surface-100 p-1">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg flex-1 justify-center transition-colors duration-200',
                  isActive
                    ? 'text-surface-900'
                    : 'text-surface-500 hover:text-surface-700'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="settings-tab-bg"
                    className="absolute inset-0 rounded-lg bg-white shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <TabIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* ---- Agents Tab ---- */}
            {activeTab === 'agents' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-surface-900">
                    Agentes de IA
                  </h2>
                  <Button
                    size="sm"
                    onClick={openNewAgent}
                    icon={<Plus className="h-4 w-4" />}
                  >
                    Nuevo Agente
                  </Button>
                </div>

                <div className="space-y-3">
                  {agents.map((agent) => (
                    <Card
                      key={agent.id}
                      hover
                      onClick={() => openEditAgent(agent)}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-50">
                          <Bot className="h-5 w-5 text-primary-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-surface-900 truncate">
                              {agent.name}
                            </span>
                            <Badge
                              variant={agent.is_active ? 'success' : 'neutral'}
                              size="sm"
                            >
                              {agent.is_active ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-surface-500">
                              {getProviderName(agent.provider)}
                            </span>
                            <span className="text-surface-300">&middot;</span>
                            <span className="text-xs text-surface-500">
                              {getModelName(agent.provider, agent.model)}
                            </span>
                            {AI_PROVIDERS.find((p) => p.id === agent.provider)
                              ?.models.find((m) => m.id === agent.model)
                              ?.recommended && (
                              <Sparkles className="h-3 w-3 text-accent-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}

                  {agents.length === 0 && (
                    <div className="text-center py-16 text-surface-400">
                      <Bot className="h-12 w-12 mx-auto mb-3 opacity-40" />
                      <p className="text-sm font-medium">
                        No hay agentes configurados
                      </p>
                      <p className="text-xs mt-1">
                        Crea tu primer agente de IA para comenzar a automatizar
                        tus conversaciones.
                      </p>
                    </div>
                  )}
                </div>

                {/* Agent modal */}
                <Modal
                  isOpen={showAgentModal}
                  onClose={handleAgentCancel}
                  title={editingAgent ? 'Editar Agente' : 'Nuevo Agente de IA'}
                  size="lg"
                >
                  <AIAgentConfig
                    agent={editingAgent}
                    onSubmit={handleAgentSubmit}
                    onCancel={handleAgentCancel}
                  />
                </Modal>
              </div>
            )}

            {/* ---- Channels Tab ---- */}
            {activeTab === 'channels' && (
              <ChannelConfig
                assignments={assignments}
                agents={agents}
                onAdd={handleAddAssignment}
                onDelete={handleDeleteAssignment}
              />
            )}

            {/* ---- General Tab ---- */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <Card>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-50">
                      <Building2 className="h-5 w-5 text-primary-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-surface-900">
                        Información de la Empresa
                      </h3>
                      <p className="text-sm text-surface-500">
                        Datos generales de tu negocio
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Input
                      label="Nombre de la empresa"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      icon={Building2}
                    />

                    <div className="w-full space-y-1.5">
                      <label className="block text-sm font-medium text-surface-700">
                        Tipo de negocio
                      </label>
                      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-surface-200 bg-surface-50 text-sm text-surface-600">
                        {businessType === 'retailer'
                          ? 'Comercio / Retail'
                          : 'Servicios'}
                        <Badge variant="info" size="sm">
                          Configurado en registro
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-50">
                      <Globe className="h-5 w-5 text-primary-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-surface-900">
                        Preferencias
                      </h3>
                      <p className="text-sm text-surface-500">
                        Zona horaria y configuración general
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <Select
                      label="Zona horaria"
                      options={TIMEZONE_OPTIONS}
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                    />

                    <Toggle
                      enabled={notificationsEnabled}
                      onChange={setNotificationsEnabled}
                      label="Notificaciones"
                      description="Recibe alertas cuando una conversación requiera atención humana"
                    />

                    <Toggle
                      enabled={autoAssignEnabled}
                      onChange={setAutoAssignEnabled}
                      label="Auto-asignación de conversaciones"
                      description="Asigna automáticamente conversaciones nuevas al vendedor disponible"
                    />
                  </div>
                </Card>

                <div className="flex justify-end">
                  <Button icon={<Settings className="h-4 w-4" />}>
                    Guardar preferencias
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default SettingsPage;
