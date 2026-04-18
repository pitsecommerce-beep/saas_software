'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Users, Clock, ThumbsUp, BarChart2, FlaskConical, ShoppingCart, DollarSign } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ConversationChart } from '@/components/dashboard/ConversationChart';
import { ChannelDistribution } from '@/components/dashboard/ChannelDistribution';
import { VendorPerformance } from '@/components/dashboard/VendorPerformance';
import { useDemoStore } from '@/stores/demoStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/config';

// ---------------------------------------------------------------------------
// Mock data (fallback for demo mode)
// ---------------------------------------------------------------------------

const mockMetrics = [
  { title: 'Total Conversaciones', value: '2,847', change: '+12.5%', changeType: 'positive' as const, icon: MessageSquare },
  { title: 'Clientes Activos', value: '1,024', change: '+8.2%', changeType: 'positive' as const, icon: Users },
  { title: 'Tiempo Resp. Promedio', value: '4.2 min', change: '-18%', changeType: 'positive' as const, icon: Clock },
  { title: 'Satisfacción', value: '94%', change: '-1.3%', changeType: 'negative' as const, icon: ThumbsUp },
];

function generateMockConversationData(): { date: string; count: number }[] {
  const data: { date: string; count: number }[] = [];
  const base = 60;
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = `${d.getDate()}/${d.getMonth() + 1}`;
    const trend = ((30 - i) / 30) * 40;
    const noise = Math.round((Math.random() - 0.5) * 20);
    data.push({ date: label, count: Math.max(10, Math.round(base + trend + noise)) });
  }
  return data;
}

const mockConversationData = generateMockConversationData();

const mockChannelData = [
  { channel: 'WhatsApp', count: 1708 },
  { channel: 'Instagram', count: 712 },
  { channel: 'Messenger', count: 427 },
];

const mockVendorData = [
  { name: 'María García', conversations: 342, avgResponseTime: 3, resolved: 318 },
  { name: 'Carlos López', conversations: 289, avgResponseTime: 5, resolved: 251 },
  { name: 'Ana Martínez', conversations: 276, avgResponseTime: 4, resolved: 260 },
  { name: 'Diego Hernández', conversations: 198, avgResponseTime: 7, resolved: 170 },
];

// ---------------------------------------------------------------------------
// Real data interfaces
// ---------------------------------------------------------------------------

interface MetricData {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: typeof MessageSquare;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function DashboardPage() {
  const { isDemoMode, setDemoMode } = useDemoStore();
  const { profile } = useAuthStore();
  const teamId = profile?.team_id;

  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [conversationData, setConversationData] = useState<{ date: string; count: number }[]>([]);
  const [channelData, setChannelData] = useState<{ channel: string; count: number }[]>([]);
  const [vendorData, setVendorData] = useState<{ name: string; conversations: number; avgResponseTime: number; resolved: number }[]>([]);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recentConversations, setRecentConversations] = useState<{ customer_name: string; last_message: string; channel: string; last_message_at: string; status: string }[]>([]);
  const [orderMetrics, setOrderMetrics] = useState<{ ordersThisMonth: number; totalSold: number }>({ ordersThisMonth: 0, totalSold: 0 });

  const loadDashboardData = useCallback(async () => {
    if (!isSupabaseConfigured || !teamId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all conversations for this team
      const { data: conversations, error: convErr } = await supabase
        .from('conversations')
        .select('id, channel, status, assigned_to, is_ai_enabled, last_message, last_message_at, created_at, customer:customers(name)')
        .eq('team_id', teamId);

      if (convErr) throw convErr;

      const convs = conversations ?? [];
      const totalConversations = convs.length;

      if (totalConversations === 0) {
        setLoading(false);
        return;
      }

      setHasData(true);

      // Active conversations
      const activeConvs = convs.filter((c) => c.status !== 'closed').length;

      // Fetch independent queries in parallel
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [customerResult, messagesResult, profilesResult, ordersResult] = await Promise.all([
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', teamId),
        supabase
          .from('messages')
          .select('conversation_id, sender_type, created_at')
          .in('conversation_id', convs.map((c) => c.id))
          .order('created_at', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('team_id', teamId)
          .in('role', ['vendedor', 'gerente']),
        supabase
          .from('orders')
          .select('id, total, status')
          .eq('team_id', teamId)
          .gte('created_at', monthStart),
      ]);

      const { count: customerCount } = customerResult;
      const { data: msgData } = messagesResult;
      const { data: teamProfiles } = profilesResult;
      const { data: monthOrders } = ordersResult;

      // Calculate average response time (time between customer message and next AI/agent response)
      let totalResponseTime = 0;
      let responseCount = 0;
      if (msgData) {
        const msgsByConv: Record<string, typeof msgData> = {};
        for (const msg of msgData) {
          if (!msgsByConv[msg.conversation_id]) msgsByConv[msg.conversation_id] = [];
          msgsByConv[msg.conversation_id].push(msg);
        }
        for (const msgs of Object.values(msgsByConv)) {
          for (let i = 0; i < msgs.length - 1; i++) {
            if (msgs[i].sender_type === 'customer' && (msgs[i + 1].sender_type === 'ai' || msgs[i + 1].sender_type === 'agent')) {
              const diff = new Date(msgs[i + 1].created_at).getTime() - new Date(msgs[i].created_at).getTime();
              totalResponseTime += diff;
              responseCount++;
            }
          }
        }
      }
      const avgResponseMin = responseCount > 0 ? Math.round(totalResponseTime / responseCount / 60000) : 0;

      // Build metrics
      const resolvedConvs = convs.filter((c) => c.status === 'closed').length;
      const satisfactionPct = totalConversations > 0 ? Math.round((resolvedConvs / totalConversations) * 100) : 0;

      setMetrics([
        {
          title: 'Total Conversaciones',
          value: totalConversations.toLocaleString(),
          change: `${activeConvs} activas`,
          changeType: 'positive',
          icon: MessageSquare,
        },
        {
          title: 'Clientes',
          value: (customerCount ?? 0).toLocaleString(),
          change: `${activeConvs} con conv. activa`,
          changeType: 'positive',
          icon: Users,
        },
        {
          title: 'Tiempo Resp. Promedio',
          value: avgResponseMin > 0 ? `${avgResponseMin} min` : 'N/A',
          change: responseCount > 0 ? `${responseCount} respuestas` : 'Sin datos',
          changeType: avgResponseMin <= 5 ? 'positive' : avgResponseMin <= 15 ? 'neutral' : 'negative',
          icon: Clock,
        },
        {
          title: 'Resolución',
          value: `${satisfactionPct}%`,
          change: `${resolvedConvs} resueltas`,
          changeType: satisfactionPct >= 70 ? 'positive' : satisfactionPct >= 40 ? 'neutral' : 'negative',
          icon: ThumbsUp,
        },
      ]);

      // Conversation data by day (last 30 days)
      const last30 = new Date();
      last30.setDate(last30.getDate() - 30);
      const dailyData: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = `${d.getDate()}/${d.getMonth() + 1}`;
        dailyData[key] = 0;
      }
      for (const conv of convs) {
        const created = new Date(conv.created_at);
        if (created >= last30) {
          const key = `${created.getDate()}/${created.getMonth() + 1}`;
          if (key in dailyData) dailyData[key]++;
        }
      }
      setConversationData(Object.entries(dailyData).map(([date, count]) => ({ date, count })));

      // Channel distribution
      const channelCounts: Record<string, number> = {};
      for (const conv of convs) {
        const ch = conv.channel === 'whatsapp' ? 'WhatsApp' : conv.channel === 'instagram' ? 'Instagram' : 'Messenger';
        channelCounts[ch] = (channelCounts[ch] ?? 0) + 1;
      }
      setChannelData(Object.entries(channelCounts).map(([channel, count]) => ({ channel, count })));

      // Vendor performance
      if (teamProfiles) {
        const vendorStats = teamProfiles.map((p) => {
          const assigned = convs.filter((c) => c.assigned_to === p.id);
          const resolved = assigned.filter((c) => c.status === 'closed').length;
          return {
            name: p.full_name,
            conversations: assigned.length,
            avgResponseTime: 0, // Would need per-vendor message analysis
            resolved,
          };
        }).filter((v) => v.conversations > 0);
        setVendorData(vendorStats);
      }

      // Order metrics for current month
      const ordersThisMonth = monthOrders?.length ?? 0;
      const totalSold = (monthOrders ?? [])
        .filter((o) => o.status !== 'cancelado')
        .reduce((sum, o) => sum + (parseFloat(String(o.total)) || 0), 0);

      setOrderMetrics({ ordersThisMonth, totalSold });

      // Recent conversations for the summary section
      const recent = convs
        .filter((c) => c.last_message)
        .sort((a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime())
        .slice(0, 5)
        .map((c) => ({
          customer_name: (c.customer as { name?: string } | null)?.name ?? 'Cliente pendiente',
          last_message: c.last_message ?? '',
          channel: c.channel,
          last_message_at: c.last_message_at ?? '',
          status: c.status,
        }));
      setRecentConversations(recent);

    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // ---------------------------------------------------------------------------
  // Render: No data state
  // ---------------------------------------------------------------------------

  if (!isDemoMode && !hasData && !loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-200 bg-white py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100 mb-4">
            <BarChart2 className="h-8 w-8 text-surface-400" />
          </div>
          <h3 className="text-base font-semibold text-surface-700 mb-1">Sin datos aún</h3>
          <p className="text-sm text-surface-500 max-w-sm mb-6">
            Conecta tus canales y agrega clientes para ver estadísticas de conversaciones aquí.
          </p>
          <button
            onClick={() => setDemoMode(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-200 transition-colors"
          >
            <FlaskConical className="h-4 w-4" />
            Ver datos de ejemplo
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Use demo data if in demo mode
  // ---------------------------------------------------------------------------

  const displayMetrics = isDemoMode && !hasData ? mockMetrics : metrics;
  const displayConvData = isDemoMode && !hasData ? mockConversationData : conversationData;
  const displayChannelData = isDemoMode && !hasData ? mockChannelData : channelData;
  const displayVendorData = isDemoMode && !hasData ? mockVendorData : vendorData;

  // ---------------------------------------------------------------------------
  // Render: Dashboard with data
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
        {isDemoMode && !hasData && (
          <button
            onClick={() => setDemoMode(false)}
            className="text-xs text-surface-400 hover:text-surface-600 transition-colors"
          >
            Ocultar datos de ejemplo
          </button>
        )}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {displayMetrics.map((m, i) => (
          <MetricCard key={m.title} {...m} delay={i * 0.08} />
        ))}
      </div>

      {/* Order metrics */}
      {(orderMetrics.ordersThisMonth > 0 || orderMetrics.totalSold > 0) && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <MetricCard
            title="Pedidos del mes"
            value={orderMetrics.ordersThisMonth.toLocaleString()}
            change="Este mes"
            changeType="positive"
            icon={ShoppingCart}
            delay={0.32}
          />
          <MetricCard
            title="Total vendido"
            value={`$${orderMetrics.totalSold.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            change="Este mes"
            changeType="positive"
            icon={DollarSign}
            delay={0.4}
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ConversationChart data={displayConvData} />
        </div>
        <div>
          <ChannelDistribution data={displayChannelData} />
        </div>
      </div>

      {/* Recent conversations */}
      {recentConversations.length > 0 && (
        <div className="rounded-2xl border border-surface-200 bg-white p-5">
          <h3 className="text-base font-semibold text-surface-800 mb-4">
            Conversaciones Recientes
          </h3>
          <div className="space-y-3">
            {recentConversations.map((conv, i) => {
              const channelLabel = conv.channel === 'whatsapp' ? 'WhatsApp' : conv.channel === 'instagram' ? 'Instagram' : 'Messenger';
              const channelColor = conv.channel === 'whatsapp' ? 'bg-green-50 text-green-700' : conv.channel === 'instagram' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700';
              const statusColorMap: Record<string, string> = {
                nuevo: 'bg-blue-50 text-blue-700',
                saludo_inicial: 'bg-sky-50 text-sky-700',
                cotizando: 'bg-violet-50 text-violet-700',
                ai_attended: 'bg-sky-50 text-sky-700',
                payment_pending: 'bg-amber-50 text-amber-700',
                immediate_attention: 'bg-danger-50 text-danger-700',
                closed: 'bg-surface-100 text-surface-500',
              };
              const statusLabelMap: Record<string, string> = {
                nuevo: 'Nuevo',
                saludo_inicial: 'Saludo Inicial',
                cotizando: 'Cotizando',
                ai_attended: 'Saludo Inicial',
                payment_pending: 'Pago Pendiente',
                immediate_attention: 'Atención Inmediata',
                closed: 'Cerrada',
              };
              const statusColor = statusColorMap[conv.status] ?? 'bg-surface-100 text-surface-500';
              const statusLabel = statusLabelMap[conv.status] ?? conv.status;
              const timeAgo = conv.last_message_at ? formatTimeAgo(conv.last_message_at) : '';

              return (
                <div key={i} className="flex items-start gap-3 rounded-xl bg-surface-50 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-200 text-xs font-bold text-surface-600">
                    {conv.customer_name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-surface-800 truncate">
                        {conv.customer_name}
                      </span>
                      <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${channelColor}`}>
                        {channelLabel}
                      </span>
                      <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">
                      {conv.last_message}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-surface-400 pt-1">
                    {timeAgo}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vendor performance */}
      {displayVendorData.length > 0 && (
        <VendorPerformance data={displayVendorData} />
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default DashboardPage;
