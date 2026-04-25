import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  TrendingUp,
  MessageSquare,
  DollarSign,
  Bot,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Zap,
  BarChart3,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/config';
import { calculateCostUsd } from '@/lib/modelPricing';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenUsageRow {
  agent_id: string | null;
  agent_name: string | null;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  conversation_id: string | null;
  created_at: string;
}

interface AgentStats {
  agentId: string | null;
  agentName: string;
  provider: string;
  model: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  callCount: number;
}

interface HarmonyCreditsData {
  balance_usd: number;
  total_recharged_usd: number;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('es-MX');
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

function providerColor(provider: string): string {
  switch (provider) {
    case 'openai': return 'from-emerald-500 to-teal-600';
    case 'anthropic': return 'from-orange-500 to-amber-600';
    case 'google': return 'from-blue-500 to-indigo-600';
    default: return 'from-primary-500 to-primary-700';
  }
}

function providerLabel(provider: string): string {
  switch (provider) {
    case 'openai': return 'OpenAI';
    case 'anthropic': return 'Anthropic';
    case 'google': return 'Google';
    default: return provider;
  }
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  gradient: string;
  delay?: number;
}

function MetricCard({ icon, label, value, sub, gradient, delay = 0 }: MetricCardProps) {
  const valueSize =
    value.length > 10 ? 'text-lg' :
    value.length > 7  ? 'text-xl' :
                        'text-2xl';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className="relative overflow-hidden h-full">
        {/* Fondo decorativo */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.04] pointer-events-none`} />
        <div className="flex items-start gap-3">
          <div className={`flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br ${gradient} shrink-0`}>
            <span className="text-white">{icon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wide leading-tight">{label}</p>
            <p className={`${valueSize} font-bold text-surface-900 mt-0.5 leading-tight break-all`}>{value}</p>
            {sub && <p className="text-xs text-surface-400 mt-1">{sub}</p>}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Credit gauge
// ---------------------------------------------------------------------------

function CreditGauge({ balanceUsd, totalRecharged }: { balanceUsd: number; totalRecharged: number }) {
  const pct = totalRecharged > 0 ? Math.max(0, Math.min(100, (balanceUsd / totalRecharged) * 100)) : 0;
  const strokeDash = 2 * Math.PI * 42; // circumference r=42
  const strokeOffset = strokeDash * (1 - pct / 100);

  const color =
    pct > 50 ? '#10b981' :
    pct > 20 ? '#f59e0b' :
    '#ef4444';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-28 h-28">
        <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
          {/* Track */}
          <circle cx="56" cy="56" r="42" fill="none" stroke="#e5e7eb" strokeWidth="10" />
          {/* Progress */}
          <circle
            cx="56" cy="56" r="42"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={strokeDash}
            strokeDashoffset={strokeOffset}
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-surface-900">{Math.round(pct)}%</span>
          <span className="text-[10px] text-surface-400 font-medium">restante</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-surface-700">{formatUsd(balanceUsd)}</p>
        <p className="text-xs text-surface-400">de {formatUsd(totalRecharged)} recargados</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function HarmonyCredits() {
  const { profile } = useAuthStore();
  const teamId = profile?.team_id;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TokenUsageRow[]>([]);
  const [credits, setCredits] = useState<HarmonyCreditsData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !teamId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [usageRes, creditsRes] = await Promise.all([
        supabase
          .from('token_usage')
          .select('agent_id, agent_name, provider, model, input_tokens, output_tokens, conversation_id, created_at')
          .eq('team_id', teamId)
          .order('created_at', { ascending: false }),
        supabase
          .from('harmony_credits')
          .select('balance_usd, total_recharged_usd, updated_at')
          .eq('team_id', teamId)
          .single(),
      ]);

      if (usageRes.data) setRows(usageRes.data as TokenUsageRow[]);
      if (creditsRes.data) setCredits(creditsRes.data as HarmonyCreditsData);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  // ---------------------------------------------------------------------------
  // Derived metrics
  // ---------------------------------------------------------------------------

  const totalInputTokens = rows.reduce((s, r) => s + (r.input_tokens ?? 0), 0);
  const totalOutputTokens = rows.reduce((s, r) => s + (r.output_tokens ?? 0), 0);
  const totalTokens = totalInputTokens + totalOutputTokens;

  // Costo total consumido
  const totalCostUsd = rows.reduce((s, r) => s + calculateCostUsd(r.model, r.input_tokens, r.output_tokens), 0);

  // Conversaciones únicas que tuvieron al menos una llamada IA
  const uniqueConversations = new Set(rows.map((r) => r.conversation_id).filter(Boolean)).size;

  // Media de tokens por conversación (solo contando las que tuvieron llamada IA)
  const avgTokensPerConv = uniqueConversations > 0 ? Math.round(totalTokens / uniqueConversations) : 0;

  // Costo promedio por conversación
  const avgCostPerConv = uniqueConversations > 0 ? totalCostUsd / uniqueConversations : 0;

  // Conversaciones restantes estimadas
  const balance = credits?.balance_usd ?? 0;
  const remainingConvs = avgCostPerConv > 0 ? Math.floor(balance / avgCostPerConv) : null;

  // Estadísticas por agente
  const agentMap = new Map<string, AgentStats>();
  for (const row of rows) {
    const key = row.agent_id ?? row.agent_name ?? 'unknown';
    const existing = agentMap.get(key);
    const cost = calculateCostUsd(row.model, row.input_tokens, row.output_tokens);
    if (existing) {
      existing.totalInputTokens += row.input_tokens;
      existing.totalOutputTokens += row.output_tokens;
      existing.totalCostUsd += cost;
      existing.callCount += 1;
    } else {
      agentMap.set(key, {
        agentId: row.agent_id,
        agentName: row.agent_name ?? 'Agente desconocido',
        provider: row.provider,
        model: row.model,
        totalInputTokens: row.input_tokens,
        totalOutputTokens: row.output_tokens,
        totalCostUsd: cost,
        callCount: 1,
      });
    }
  }
  const agentStats = Array.from(agentMap.values()).sort((a, b) => b.totalCostUsd - a.totalCostUsd);

  // ---------------------------------------------------------------------------
  // No data state
  // ---------------------------------------------------------------------------

  if (!loading && rows.length === 0 && !credits) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-surface-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary-500" />
              Harmony Credits
            </h2>
            <p className="text-sm text-surface-500 mt-0.5">
              Monitoreo de consumo de IA en tiempo real
            </p>
          </div>
        </div>

        <Card className="text-center py-14">
          <Sparkles className="h-12 w-12 mx-auto text-surface-200 mb-3" />
          <p className="text-sm font-medium text-surface-700">Sin datos de consumo aún</p>
          <p className="text-xs text-surface-400 mt-1 max-w-xs mx-auto">
            Los tokens se registrarán automáticamente con cada respuesta que generen tus agentes de IA.
          </p>
          {!isSupabaseConfigured && (
            <p className="text-xs text-amber-600 mt-3 inline-flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Conecta Supabase para activar el seguimiento
            </p>
          )}
        </Card>
      </motion.div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-surface-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-500" />
            Harmony Credits
          </h2>
          <p className="text-sm text-surface-500 mt-0.5">
            Consumo acumulado · {rows.length} llamadas IA registradas
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-surface-500 hover:text-surface-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Cargando…' : `Actualizado ${lastRefresh.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`}
        </button>
      </div>

      {/* Credit gauge + balance section */}
      {credits && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="relative overflow-hidden">
            {/* Gradient bg decoration */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-accent-500/5 pointer-events-none" />
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <CreditGauge
                balanceUsd={credits.balance_usd}
                totalRecharged={credits.total_recharged_usd}
              />
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-surface-400 mb-1">
                    Saldo disponible
                  </p>
                  <p className="text-4xl font-extrabold text-surface-900 tracking-tight">
                    {formatUsd(credits.balance_usd)}
                  </p>
                  <p className="text-sm text-surface-500 mt-1">
                    Gastado: {formatUsd(totalCostUsd)} · Total recargado: {formatUsd(credits.total_recharged_usd)}
                  </p>
                </div>
                {remainingConvs !== null && (
                  <div className="flex items-center gap-2 rounded-xl bg-primary-50 border border-primary-100 px-4 py-3">
                    <MessageSquare className="h-4 w-4 text-primary-500 shrink-0" />
                    <p className="text-sm text-primary-700">
                      Aproximadamente{' '}
                      <span className="font-bold">
                        {remainingConvs.toLocaleString('es-MX')} conversaciones
                      </span>{' '}
                      restantes con el saldo actual
                    </p>
                  </div>
                )}
                {credits.updated_at && (
                  <p className="text-xs text-surface-400">
                    Última recarga:{' '}
                    {new Date(credits.updated_at).toLocaleDateString('es-MX', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={<Zap className="h-5 w-5" />}
          label="Tokens consumidos"
          value={formatNumber(totalTokens)}
          sub={`${formatNumber(totalInputTokens)} entrada · ${formatNumber(totalOutputTokens)} salida`}
          gradient="from-primary-500 to-primary-700"
          delay={0.05}
        />
        <MetricCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Media por conversación"
          value={formatNumber(avgTokensPerConv)}
          sub={`${uniqueConversations} conversaciones únicas`}
          gradient="from-violet-500 to-purple-700"
          delay={0.1}
        />
        <MetricCard
          icon={<MessageSquare className="h-5 w-5" />}
          label="Convs. restantes"
          value={remainingConvs !== null ? formatNumber(remainingConvs) : '—'}
          sub={avgCostPerConv > 0 ? `~${formatUsd(avgCostPerConv)} por conv.` : 'Sin historial suficiente'}
          gradient="from-emerald-500 to-teal-600"
          delay={0.15}
        />
        <MetricCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Costo total IA"
          value={formatUsd(totalCostUsd)}
          sub={`${rows.length} llamadas al API`}
          gradient="from-orange-500 to-amber-600"
          delay={0.2}
        />
      </div>

      {/* Per-agent breakdown */}
      {agentStats.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary-50">
                <BarChart3 className="h-4 w-4 text-primary-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-surface-900">Consumo por agente</h3>
                <p className="text-xs text-surface-400">Tokens y costo acumulado desde el inicio</p>
              </div>
            </div>

            <div className="space-y-3">
              {agentStats.map((agent, i) => {
                const pct = totalCostUsd > 0 ? (agent.totalCostUsd / totalCostUsd) * 100 : 0;
                return (
                  <motion.div
                    key={agent.agentId ?? agent.agentName}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.05 }}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${providerColor(agent.provider)} shrink-0`}>
                          <Bot className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-surface-900 truncate">{agent.agentName}</p>
                          <p className="text-xs text-surface-400">
                            {providerLabel(agent.provider)} · {agent.model}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-surface-900">{formatUsd(agent.totalCostUsd)}</p>
                        <p className="text-xs text-surface-400">
                          {formatNumber(agent.totalInputTokens + agent.totalOutputTokens)} tokens
                        </p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full bg-gradient-to-r ${providerColor(agent.provider)}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.3 + i * 0.05, ease: 'easeOut' }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Info note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-start gap-2.5 rounded-xl bg-surface-50 border border-surface-200 px-4 py-3"
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
        <p className="text-xs text-surface-500 leading-relaxed">
          Los datos de consumo se registran de forma permanente e independiente de las conversaciones.
          Aunque se eliminen conversaciones, el historial de tokens consumidos se conserva aquí.
          Las recargas son gestionadas por el administrador de la plataforma.
        </p>
      </motion.div>
    </motion.div>
  );
}
