import { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  MessageCircle,
  Settings,
  Plus,
  Sparkles,
  Building2,
  Globe,
  Zap,
  Key,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Network,
  Trash2,
  CreditCard,
  Palette,
  Upload,
  X,
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
import { ChannelAgentConnector } from '@/components/settings/ChannelAgentConnector';
import { cn } from '@/lib/utils';
import { useDemoStore } from '@/stores/demoStore';
import { useAuthStore } from '@/stores/authStore';
import { useBrandingStore, DEFAULT_APP_NAME } from '@/stores/brandingStore';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/config';

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

type TabId = 'agents' | 'channels' | 'connector' | 'ycloud' | 'payments' | 'general';

const TABS: { id: TabId; label: string; icon: typeof Bot }[] = [
  { id: 'agents', label: 'Agentes de IA', icon: Bot },
  { id: 'channels', label: 'Canales', icon: MessageCircle },
  { id: 'connector', label: 'Conexiones', icon: Network },
  { id: 'ycloud', label: 'yCloud', icon: Zap },
  { id: 'payments', label: 'Pagos', icon: CreditCard },
  { id: 'general', label: 'General', icon: Settings },
];

// ---------------------------------------------------------------------------
// Timezone options
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
// yCloud integration status helper
// ---------------------------------------------------------------------------

function YCloudStatusBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Conectado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-500">
      <AlertCircle className="h-3.5 w-3.5" />
      Sin configurar
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SettingsPage() {
  const { isDemoMode } = useDemoStore();
  const { team, profile } = useAuthStore();
  const isManager = profile?.role === 'gerente';
  const teamId = profile?.team_id ?? team?.id;

  const [activeTab, setActiveTab] = useState<TabId>('agents');
  const [agents, setAgents] = useState<AIAgent[]>(isDemoMode && !isSupabaseConfigured ? MOCK_AGENTS : []);
  const [assignments, setAssignments] = useState<ChannelAssignment[]>(
    isDemoMode && !isSupabaseConfigured ? MOCK_ASSIGNMENTS : []
  );
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // General settings state — seeded from auth store team data
  const [companyName, setCompanyName] = useState(team?.name ?? '');
  const [timezone, setTimezone] = useState('America/Mexico_City');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(true);

  // Branding settings — persisted locally via brandingStore and optionally
  // synced to Supabase (branding_settings table) when connected.
  const branding = useBrandingStore();
  const [brandName, setBrandName] = useState(branding.appName);
  const [brandLogo, setBrandLogo] = useState<string | null>(branding.logoUrl);
  const [brandFavicon, setBrandFavicon] = useState<string | null>(branding.faviconUrl);
  const [brandingSaved, setBrandingSaved] = useState(false);

  // yCloud settings
  const [yCloudApiKey, setYCloudApiKey] = useState('');
  const [yCloudPhoneNumberId, setYCloudPhoneNumberId] = useState('');
  const [yCloudWebhookToken, setYCloudWebhookToken] = useState('');
  const [yCloudWebhookUrl, setYCloudWebhookUrl] = useState('');
  const [showYCloudKey, setShowYCloudKey] = useState(false);
  const [yCloudSaved, setYCloudSaved] = useState(false);
  const isYCloudConnected = yCloudApiKey.length > 0 && yCloudPhoneNumberId.length > 0;

  // Payment settings
  const [paymentProvider, setPaymentProvider] = useState<'mercadopago' | 'stripe'>('mercadopago');
  const [paymentApiKey, setPaymentApiKey] = useState('');
  const [showPaymentKey, setShowPaymentKey] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [paymentActive, setPaymentActive] = useState(true);
  const isPaymentConnected = paymentApiKey.length > 0;

  const handleSaveYCloud = async () => {
    if (!isSupabaseConfigured || !teamId) return;
    try {
      const payload = {
        team_id: teamId,
        api_key_encrypted: yCloudApiKey,
        phone_number_id: yCloudPhoneNumberId,
        webhook_token: yCloudWebhookToken || null,
        webhook_url: yCloudWebhookUrl || null,
      };
      // Upsert — insert if no row for this team, otherwise update
      const { error } = await supabase
        .from('ycloud_settings')
        .upsert(payload, { onConflict: 'team_id' });
      if (error) {
        console.error('Error saving yCloud settings:', error);
        return;
      }
      setYCloudSaved(true);
      setTimeout(() => setYCloudSaved(false), 2500);
    } catch (err) {
      console.error('Error saving yCloud settings:', err);
    }
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleBrandLogoUpload = async (file: File | null) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert('El logo debe pesar menos de 1 MB.');
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setBrandLogo(dataUrl);
  };

  const handleBrandFaviconUpload = async (file: File | null) => {
    if (!file) return;
    if (file.size > 512 * 1024) {
      alert('El favicon debe pesar menos de 512 KB.');
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setBrandFavicon(dataUrl);
  };

  const handleSaveBranding = async () => {
    const appName = brandName.trim() || DEFAULT_APP_NAME;
    // Apply immediately to the UI + localStorage
    branding.setBranding({
      appName,
      logoUrl: brandLogo,
      faviconUrl: brandFavicon,
    });

    // Best-effort sync to Supabase (table may not exist yet if migration
    // hasn't been applied — silently ignore so branding still persists locally)
    if (isSupabaseConfigured && teamId) {
      try {
        await supabase
          .from('branding_settings')
          .upsert(
            {
              team_id: teamId,
              app_name: appName,
              logo_url: brandLogo,
              favicon_url: brandFavicon,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'team_id' }
          );
      } catch (err) {
        console.warn('Branding: Supabase sync skipped', err);
      }
    }

    setBrandingSaved(true);
    setTimeout(() => setBrandingSaved(false), 2500);
  };

  const handleResetBranding = () => {
    setBrandName(DEFAULT_APP_NAME);
    setBrandLogo(null);
    setBrandFavicon(null);
    branding.reset();
  };

  const handleSavePayment = async () => {
    if (!isSupabaseConfigured || !teamId) return;
    try {
      const payload = {
        team_id: teamId,
        provider: paymentProvider,
        api_key_encrypted: paymentApiKey,
        is_active: paymentActive,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('payment_settings')
        .upsert(payload, { onConflict: 'team_id' });
      if (error) {
        console.error('Error saving payment settings:', error);
        return;
      }
      setPaymentSaved(true);
      setTimeout(() => setPaymentSaved(false), 2500);
    } catch (err) {
      console.error('Error saving payment settings:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Supabase data fetching
  // ---------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured || !teamId) {
      setDataLoaded(true);
      return;
    }
    try {
      const [agentsRes, assignRes, yCloudRes, paymentRes, brandingRes] = await Promise.all([
        supabase.from('ai_agents').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
        supabase.from('channel_assignments').select('*, agent:ai_agents(*)').eq('team_id', teamId).order('created_at', { ascending: false }),
        supabase.from('ycloud_settings').select('*').eq('team_id', teamId).maybeSingle(),
        supabase.from('payment_settings').select('*').eq('team_id', teamId).maybeSingle(),
        supabase.from('branding_settings').select('*').eq('team_id', teamId).maybeSingle(),
      ]);
      if (agentsRes.data) setAgents(agentsRes.data as AIAgent[]);
      if (assignRes.data) setAssignments(assignRes.data as ChannelAssignment[]);
      if (yCloudRes.data) {
        setYCloudApiKey(yCloudRes.data.api_key_encrypted ?? '');
        setYCloudPhoneNumberId(yCloudRes.data.phone_number_id ?? '');
        setYCloudWebhookToken(yCloudRes.data.webhook_token ?? '');
        setYCloudWebhookUrl(yCloudRes.data.webhook_url ?? '');
      }
      if (paymentRes.data) {
        setPaymentProvider(paymentRes.data.provider ?? 'mercadopago');
        setPaymentApiKey(paymentRes.data.api_key_encrypted ?? '');
        setPaymentActive(paymentRes.data.is_active ?? true);
      }
      // Branding table is optional — it may not exist yet if the migration
      // hasn't been applied. Swallow errors silently in that case.
      if (!brandingRes.error && brandingRes.data) {
        const remoteName = brandingRes.data.app_name ?? DEFAULT_APP_NAME;
        const remoteLogo = brandingRes.data.logo_url ?? null;
        const remoteFavicon = brandingRes.data.favicon_url ?? null;
        setBrandName(remoteName);
        setBrandLogo(remoteLogo);
        setBrandFavicon(remoteFavicon);
        branding.setBranding({
          appName: remoteName,
          logoUrl: remoteLogo,
          faviconUrl: remoteFavicon,
        });
      }
    } catch (err) {
      console.error('Failed to load settings data:', err);
    } finally {
      setDataLoaded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, [loadData, dataLoaded]);

  // ---------------------------------------------------------------------------
  // Handlers with Supabase persistence
  // ---------------------------------------------------------------------------

  const handleAgentSubmit = async (
    data: Omit<AIAgent, 'id' | 'team_id' | 'created_at'>
  ) => {
    if (editingAgent) {
      // Update existing agent
      if (isSupabaseConfigured && teamId) {
        const { error } = await supabase
          .from('ai_agents')
          .update(data)
          .eq('id', editingAgent.id)
          .eq('team_id', teamId);
        if (error) { console.error('Error updating agent:', error); return; }
      }
      setAgents((prev) =>
        prev.map((a) => (a.id === editingAgent.id ? { ...a, ...data } : a))
      );
    } else {
      // Create new agent
      if (isSupabaseConfigured && teamId) {
        const { data: inserted, error } = await supabase
          .from('ai_agents')
          .insert({ ...data, team_id: teamId })
          .select()
          .single();
        if (error) { console.error('Error creating agent:', error); return; }
        setAgents((prev) => [inserted as AIAgent, ...prev]);
      } else {
        const newAgent: AIAgent = {
          ...data,
          id: `agent-${Date.now()}`,
          team_id: teamId ?? 'team-1',
          created_at: new Date().toISOString(),
        };
        setAgents((prev) => [newAgent, ...prev]);
      }
    }
    setShowAgentModal(false);
    setEditingAgent(null);
  };

  const handleAgentCancel = () => {
    setShowAgentModal(false);
    setEditingAgent(null);
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (isSupabaseConfigured && teamId) {
      const { error } = await supabase
        .from('ai_agents')
        .delete()
        .eq('id', agentId)
        .eq('team_id', teamId);
      if (error) { console.error('Error deleting agent:', error); return; }
    }
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
    // Also remove any assignments pointing to this agent
    setAssignments((prev) => prev.filter((a) => a.agent_id !== agentId));
  };

  const handleAddAssignment = async (data: {
    channel: ChannelType;
    channel_identifier: string;
    label: string;
    agent_id: string;
  }) => {
    const agent = agents.find((a) => a.id === data.agent_id);

    if (isSupabaseConfigured && teamId) {
      const { data: inserted, error } = await supabase
        .from('channel_assignments')
        .insert({
          team_id: teamId,
          agent_id: data.agent_id,
          channel: data.channel,
          channel_identifier: data.channel_identifier,
          label: data.label || null,
        })
        .select('*, agent:ai_agents(*)')
        .single();
      if (error) { console.error('Error creating assignment:', error); return; }
      setAssignments((prev) => [inserted as ChannelAssignment, ...prev]);
    } else {
      const newAssignment: ChannelAssignment = {
        id: `assign-${Date.now()}`,
        team_id: teamId ?? 'team-1',
        agent_id: data.agent_id,
        agent,
        channel: data.channel,
        channel_identifier: data.channel_identifier,
        label: data.label || undefined,
        created_at: new Date().toISOString(),
      };
      setAssignments((prev) => [newAssignment, ...prev]);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (isSupabaseConfigured && teamId) {
      const { error } = await supabase
        .from('channel_assignments')
        .delete()
        .eq('id', id)
        .eq('team_id', teamId);
      if (error) { console.error('Error deleting assignment:', error); return; }
    }
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleUpdateAssignment = async (id: string, agentId: string) => {
    if (isSupabaseConfigured && teamId) {
      const { error } = await supabase
        .from('channel_assignments')
        .update({ agent_id: agentId })
        .eq('id', id)
        .eq('team_id', teamId);
      if (error) { console.error('Error updating assignment:', error); return; }
    }
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, agent_id: agentId, agent: agents.find((ag) => ag.id === agentId) }
          : a
      )
    );
  };

  const openEditAgent = (agent: AIAgent) => {
    setEditingAgent(agent);
    setShowAgentModal(true);
  };

  const openNewAgent = () => {
    setEditingAgent(null);
    setShowAgentModal(true);
  };

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
          <h1 className="text-2xl font-bold text-surface-900">Configuración</h1>
          <p className="text-sm text-surface-500 mt-1">
            Administra tus agentes de IA, canales de comunicación y preferencias generales.
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 rounded-xl bg-surface-100 p-1 overflow-x-auto">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg flex-shrink-0 flex-1 justify-center transition-colors duration-200 min-w-0',
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
                <span className="relative z-10 flex items-center gap-2 whitespace-nowrap">
                  <TabIcon className="h-4 w-4 shrink-0" />
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
                  <h2 className="text-lg font-semibold text-surface-900">Agentes de IA</h2>
                  <Button size="sm" onClick={openNewAgent} icon={<Plus className="h-4 w-4" />}>
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
                            <Badge variant={agent.is_active ? 'success' : 'neutral'} size="sm">
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
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteAgent(agent.id); }}
                        className="shrink-0 p-2 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Eliminar agente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Card>
                  ))}

                  {agents.length === 0 && (
                    <div className="text-center py-16 text-surface-400">
                      <Bot className="h-12 w-12 mx-auto mb-3 opacity-40" />
                      <p className="text-sm font-medium">No hay agentes configurados</p>
                      <p className="text-xs mt-1">
                        Crea tu primer agente de IA para comenzar a automatizar tus conversaciones.
                      </p>
                    </div>
                  )}
                </div>

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

            {/* ---- Connector Tab ---- */}
            {activeTab === 'connector' && (
              <ChannelAgentConnector
                assignments={assignments}
                agents={agents}
                onUpdateAssignment={handleUpdateAssignment}
                onDeleteAssignment={handleDeleteAssignment}
              />
            )}

            {/* ---- yCloud Tab ---- */}
            {activeTab === 'ycloud' && (
              <div className="space-y-6">
                {/* Header card */}
                <Card>
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shrink-0">
                      <Zap className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-surface-900">yCloud</h3>
                        <YCloudStatusBadge connected={isYCloudConnected} />
                      </div>
                      <p className="text-sm text-surface-500 mt-1">
                        Conecta yCloud para enviar y recibir mensajes de WhatsApp Business mediante la API oficial de Meta.
                      </p>
                    </div>
                  </div>
                </Card>

                {!isManager && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-700">
                      Solo el gerente puede configurar la integración de yCloud.
                    </p>
                  </div>
                )}

                <Card>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary-50">
                      <Key className="h-4 w-4 text-primary-500" />
                    </div>
                    <h4 className="text-base font-semibold text-surface-900">Credenciales de API</h4>
                  </div>

                  <div className="space-y-4">
                    {/* API Key */}
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-surface-700">
                        API Key de yCloud
                      </label>
                      <div className="relative">
                        <input
                          type={showYCloudKey ? 'text' : 'password'}
                          disabled={!isManager}
                          placeholder="ycloud_api_key_..."
                          value={yCloudApiKey}
                          onChange={(e) => setYCloudApiKey(e.target.value)}
                          className="block w-full rounded-lg border border-surface-200 bg-white px-3.5 py-2.5 pr-12 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 disabled:bg-surface-50 disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={() => setShowYCloudKey((v) => !v)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-surface-400 hover:text-surface-600 transition-colors"
                        >
                          {showYCloudKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-surface-400">
                        Encuéntrala en el panel de yCloud → Configuración → API.
                      </p>
                    </div>

                    {/* Phone Number ID */}
                    <Input
                      label="Phone Number ID"
                      placeholder="1234567890"
                      value={yCloudPhoneNumberId}
                      onChange={(e) => setYCloudPhoneNumberId(e.target.value)}
                      disabled={!isManager}
                    />

                    {/* Webhook token */}
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-surface-700">
                        Token de verificación del Webhook
                      </label>
                      <Input
                        placeholder="mi_token_secreto"
                        value={yCloudWebhookToken}
                        onChange={(e) => setYCloudWebhookToken(e.target.value)}
                        disabled={!isManager}
                      />
                      <p className="text-xs text-surface-400">
                        Token personalizado que usarás al configurar el webhook en yCloud.
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Webhook URL info */}
                <Card>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary-50">
                      <Globe className="h-4 w-4 text-primary-500" />
                    </div>
                    <h4 className="text-base font-semibold text-surface-900">URL del Webhook</h4>
                  </div>
                  <p className="text-sm text-surface-500 mb-3">
                    Ingresa la URL de tu servidor backend (Railway) y configúrala en el panel de yCloud para recibir mensajes entrantes:
                  </p>
                  <div className="space-y-3">
                    <Input
                      label="URL del servidor backend"
                      placeholder="https://tu-servicio.up.railway.app"
                      value={yCloudWebhookUrl}
                      onChange={(e) => setYCloudWebhookUrl(e.target.value)}
                      disabled={!isManager}
                    />
                    <div className="flex items-center gap-2 rounded-lg bg-surface-50 border border-surface-200 px-4 py-3">
                      <code className="text-xs font-mono text-surface-700 break-all flex-1">
                        {yCloudWebhookUrl
                          ? `${yCloudWebhookUrl.replace(/\/$/, '')}/api/webhooks/ycloud`
                          : 'https://tu-servicio.up.railway.app/api/webhooks/ycloud'}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(
                          yCloudWebhookUrl
                            ? `${yCloudWebhookUrl.replace(/\/$/, '')}/api/webhooks/ycloud`
                            : ''
                        )}
                        disabled={!yCloudWebhookUrl}
                        className="shrink-0 text-xs text-primary-500 hover:text-primary-600 font-medium disabled:text-surface-300"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                </Card>

                {isManager && (
                  <div className="flex justify-end gap-3">
                    <Button
                      onClick={handleSaveYCloud}
                      disabled={!yCloudApiKey || !yCloudPhoneNumberId}
                      icon={yCloudSaved ? <CheckCircle2 className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                    >
                      {yCloudSaved ? '¡Guardado!' : 'Guardar configuración'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ---- Payments Tab ---- */}
            {activeTab === 'payments' && (
              <div className="space-y-6">
                <Card>
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-green-700 shrink-0">
                      <CreditCard className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-surface-900">Proveedor de Pagos</h3>
                        {isPaymentConnected ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Conectado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-500">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Sin configurar
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-surface-500 mt-1">
                        Conecta Mercado Pago o Stripe para que el agente de IA pueda generar links de pago y enviarlos a tus clientes.
                      </p>
                    </div>
                  </div>
                </Card>

                {!isManager && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-700">
                      Solo el gerente puede configurar el proveedor de pagos.
                    </p>
                  </div>
                )}

                <Card>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-green-50">
                      <Key className="h-4 w-4 text-green-600" />
                    </div>
                    <h4 className="text-base font-semibold text-surface-900">Configuración</h4>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-surface-700">Proveedor</label>
                      <div className="flex gap-2">
                        {(['mercadopago', 'stripe'] as const).map((prov) => (
                          <button
                            key={prov}
                            type="button"
                            disabled={!isManager}
                            onClick={() => setPaymentProvider(prov)}
                            className={cn(
                              'flex-1 rounded-xl border-2 py-3 px-4 text-sm font-medium transition-all text-center',
                              paymentProvider === prov
                                ? 'border-primary-500 bg-primary-50 text-primary-700'
                                : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300',
                              !isManager && 'opacity-60 cursor-not-allowed'
                            )}
                          >
                            {prov === 'mercadopago' ? 'Mercado Pago' : 'Stripe'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-surface-700">
                        {paymentProvider === 'mercadopago' ? 'Access Token de Mercado Pago' : 'Secret Key de Stripe'}
                      </label>
                      <div className="relative">
                        <input
                          type={showPaymentKey ? 'text' : 'password'}
                          disabled={!isManager}
                          placeholder={paymentProvider === 'mercadopago' ? 'APP_USR-...' : 'sk_live_...'}
                          value={paymentApiKey}
                          onChange={(e) => setPaymentApiKey(e.target.value)}
                          className="block w-full rounded-lg border border-surface-200 bg-white px-3.5 py-2.5 pr-12 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 disabled:bg-surface-50 disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPaymentKey((v) => !v)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-surface-400 hover:text-surface-600 transition-colors"
                        >
                          {showPaymentKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-surface-400">
                        {paymentProvider === 'mercadopago'
                          ? 'Encuéntralo en Mercado Pago → Tus integraciones → Credenciales de producción → Access Token.'
                          : 'Encuéntralo en Stripe Dashboard → Developers → API keys → Secret key.'}
                      </p>
                    </div>

                    <Toggle
                      enabled={paymentActive}
                      onChange={setPaymentActive}
                      label="Activo"
                      description="Cuando está activo, el agente de IA puede generar links de pago"
                    />
                  </div>
                </Card>

                {isManager && (
                  <div className="flex justify-end gap-3">
                    <Button
                      onClick={handleSavePayment}
                      disabled={!paymentApiKey}
                      icon={paymentSaved ? <CheckCircle2 className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                    >
                      {paymentSaved ? '¡Guardado!' : 'Guardar configuración'}
                    </Button>
                  </div>
                )}
              </div>
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
                      <p className="text-sm text-surface-500">Datos generales de tu negocio</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Input
                      label="Nombre de la empresa"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      icon={Building2}
                      disabled={!isManager}
                    />

                    <div className="w-full space-y-1.5">
                      <label className="block text-sm font-medium text-surface-700">
                        Tipo de negocio
                      </label>
                      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-surface-200 bg-surface-50 text-sm text-surface-600">
                        {team?.business_type === 'retailer' ? 'Comercio / Retail' : 'Servicios'}
                        <Badge variant="info" size="sm">
                          Configurado en registro
                        </Badge>
                      </div>
                    </div>

                    {team?.invite_code && (
                      <div className="w-full space-y-1.5">
                        <label className="block text-sm font-medium text-surface-700">
                          Código de invitación del equipo
                        </label>
                        <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-surface-200 bg-surface-50">
                          <span className="font-mono font-bold text-surface-900 tracking-widest">
                            {team.invite_code}
                          </span>
                          <button
                            onClick={() => navigator.clipboard.writeText(team.invite_code)}
                            className="text-xs text-primary-500 hover:text-primary-600 font-medium ml-auto"
                          >
                            Copiar
                          </button>
                        </div>
                        <p className="text-xs text-surface-400">
                          Comparte este código con tu equipo para que se unan.
                        </p>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Branding card — lets the manager customize app name, logo and favicon */}
                <Card>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-50">
                      <Palette className="h-5 w-5 text-primary-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-surface-900">Branding</h3>
                      <p className="text-sm text-surface-500">
                        Personaliza el nombre y el logo que verá tu equipo.
                      </p>
                    </div>
                  </div>

                  {!isManager && (
                    <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <p className="text-sm text-amber-700">
                        Solo el gerente puede cambiar el branding.
                      </p>
                    </div>
                  )}

                  <div className="space-y-5">
                    <Input
                      label="Nombre del software"
                      placeholder="Ej: Mi Empresa CRM"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      icon={Building2}
                      disabled={!isManager}
                    />
                    <p className="-mt-3 text-xs text-surface-400">
                      Reemplaza &ldquo;{DEFAULT_APP_NAME}&rdquo; en la barra lateral y en el título de la pestaña.
                    </p>

                    {/* Logo uploader */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-surface-700">
                        Logo (barra lateral)
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-surface-200 bg-surface-50 overflow-hidden">
                          {brandLogo ? (
                            <img src={brandLogo} alt="Logo" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xl font-bold text-surface-400">
                              {(brandName.trim().charAt(0) || 'O').toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <label
                            className={cn(
                              'inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-medium text-surface-700 cursor-pointer hover:bg-surface-50 transition-colors',
                              !isManager && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <Upload className="h-4 w-4" />
                            Subir logo
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/svg+xml,image/webp"
                              className="hidden"
                              disabled={!isManager}
                              onChange={(e) => handleBrandLogoUpload(e.target.files?.[0] ?? null)}
                            />
                          </label>
                          {brandLogo && isManager && (
                            <button
                              type="button"
                              onClick={() => setBrandLogo(null)}
                              className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                            >
                              <X className="h-3 w-3" />
                              Quitar logo
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-surface-400">PNG, JPG, SVG o WEBP. Máx. 1 MB.</p>
                    </div>

                    {/* Favicon uploader */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-surface-700">
                        Ícono de la pestaña (favicon)
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-surface-200 bg-surface-50 overflow-hidden">
                          {brandFavicon ? (
                            <img src={brandFavicon} alt="Favicon" className="h-full w-full object-contain" />
                          ) : (
                            <Globe className="h-5 w-5 text-surface-400" />
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <label
                            className={cn(
                              'inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-medium text-surface-700 cursor-pointer hover:bg-surface-50 transition-colors',
                              !isManager && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <Upload className="h-4 w-4" />
                            Subir favicon
                            <input
                              type="file"
                              accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,image/webp"
                              className="hidden"
                              disabled={!isManager}
                              onChange={(e) => handleBrandFaviconUpload(e.target.files?.[0] ?? null)}
                            />
                          </label>
                          {brandFavicon && isManager && (
                            <button
                              type="button"
                              onClick={() => setBrandFavicon(null)}
                              className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                            >
                              <X className="h-3 w-3" />
                              Quitar favicon
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-surface-400">
                        Se recomienda PNG o SVG cuadrado. Máx. 512 KB.
                      </p>
                    </div>

                    {isManager && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-100">
                        <Button variant="ghost" size="sm" onClick={handleResetBranding}>
                          Restablecer
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveBranding}
                          icon={
                            brandingSaved ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <Palette className="h-4 w-4" />
                            )
                          }
                        >
                          {brandingSaved ? '¡Guardado!' : 'Guardar branding'}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>

                <Card>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-50">
                      <Globe className="h-5 w-5 text-primary-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-surface-900">Preferencias</h3>
                      <p className="text-sm text-surface-500">Zona horaria y configuración general</p>
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

                {isManager && (
                  <div className="flex justify-end">
                    <Button icon={<Settings className="h-4 w-4" />}>
                      Guardar preferencias
                    </Button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default SettingsPage;
