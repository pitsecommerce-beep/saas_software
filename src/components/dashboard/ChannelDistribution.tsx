'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/Card';

interface ChannelDistributionProps {
  data: { channel: string; count: number }[];
}

const CHANNEL_COLORS: Record<string, string> = {
  WhatsApp: '#22c55e',
  Instagram: '#ec4899',
  Messenger: '#3b82f6',
};

const DEFAULT_COLORS = ['#22c55e', '#ec4899', '#3b82f6', '#f59e0b', '#8b5cf6'];

function ChannelDistribution({ data }: ChannelDistributionProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className="h-full">
      <h3 className="mb-4 text-base font-semibold text-surface-800">
        Distribución por Canal
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="channel"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={3}
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.channel}
                  fill={CHANNEL_COLORS[entry.channel] ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                fontSize: '13px',
              }}
              formatter={(value) => [String(value), 'Conversaciones']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 space-y-2">
        {data.map((entry, index) => {
          const color = CHANNEL_COLORS[entry.channel] ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];
          const pct = total > 0 ? ((entry.count / total) * 100).toFixed(0) : '0';
          return (
            <div key={entry.channel} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-surface-700">{entry.channel}</span>
              </div>
              <span className="font-medium text-surface-800">{pct}%</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export { ChannelDistribution };
export type { ChannelDistributionProps };
