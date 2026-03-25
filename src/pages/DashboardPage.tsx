'use client';

import { MessageSquare, Users, Clock, ThumbsUp, BarChart2, FlaskConical } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ConversationChart } from '@/components/dashboard/ConversationChart';
import { ChannelDistribution } from '@/components/dashboard/ChannelDistribution';
import { VendorPerformance } from '@/components/dashboard/VendorPerformance';
import { useDemoStore } from '@/stores/demoStore';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const metrics = [
  {
    title: 'Total Conversaciones',
    value: '2,847',
    change: '+12.5%',
    changeType: 'positive' as const,
    icon: MessageSquare,
  },
  {
    title: 'Clientes Activos',
    value: '1,024',
    change: '+8.2%',
    changeType: 'positive' as const,
    icon: Users,
  },
  {
    title: 'Tiempo Resp. Promedio',
    value: '4.2 min',
    change: '-18%',
    changeType: 'positive' as const,
    icon: Clock,
  },
  {
    title: 'Satisfacción',
    value: '94%',
    change: '-1.3%',
    changeType: 'negative' as const,
    icon: ThumbsUp,
  },
];

function generateConversationData(): { date: string; count: number }[] {
  const data: { date: string; count: number }[] = [];
  const base = 60;
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = `${d.getDate()}/${d.getMonth() + 1}`;
    // Upward trend with some noise
    const trend = ((30 - i) / 30) * 40;
    const noise = Math.round((Math.random() - 0.5) * 20);
    data.push({ date: label, count: Math.max(10, Math.round(base + trend + noise)) });
  }
  return data;
}

const conversationData = generateConversationData();

const channelData = [
  { channel: 'WhatsApp', count: 1708 },
  { channel: 'Instagram', count: 712 },
  { channel: 'Messenger', count: 427 },
];

const vendorData = [
  { name: 'María García', conversations: 342, avgResponseTime: 3, resolved: 318 },
  { name: 'Carlos López', conversations: 289, avgResponseTime: 5, resolved: 251 },
  { name: 'Ana Martínez', conversations: 276, avgResponseTime: 4, resolved: 260 },
  { name: 'Diego Hernández', conversations: 198, avgResponseTime: 7, resolved: 170 },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function DashboardPage() {
  const { isDemoMode, setDemoMode } = useDemoStore();

  if (!isDemoMode) {
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

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m, i) => (
          <MetricCard key={m.title} {...m} delay={i * 0.08} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ConversationChart data={conversationData} />
        </div>
        <div>
          <ChannelDistribution data={channelData} />
        </div>
      </div>

      {/* Vendor performance */}
      <VendorPerformance data={vendorData} />
    </div>
  );
}

export default DashboardPage;
