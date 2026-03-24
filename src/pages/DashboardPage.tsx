'use client';

import { MessageSquare, Users, Clock, ThumbsUp } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ConversationChart } from '@/components/dashboard/ConversationChart';
import { ChannelDistribution } from '@/components/dashboard/ChannelDistribution';
import { VendorPerformance } from '@/components/dashboard/VendorPerformance';

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
