'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/Card';

interface ConversationChartProps {
  data: { date: string; count: number }[];
}

function ConversationChart({ data }: ConversationChartProps) {
  return (
    <Card className="h-full">
      <h3 className="mb-4 text-base font-semibold text-surface-800">
        Conversaciones (últimos 30 días)
      </h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height={288}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tickMargin={8}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                fontSize: '13px',
              }}
              labelStyle={{ color: '#334155', fontWeight: 600 }}
              itemStyle={{ color: '#3b82f6' }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, fill: '#fff', stroke: '#3b82f6' }}
              name="Conversaciones"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export { ConversationChart };
export type { ConversationChartProps };
