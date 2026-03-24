'use client';

import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';

interface VendorData {
  name: string;
  conversations: number;
  avgResponseTime: number;
  resolved: number;
}

interface VendorPerformanceProps {
  data: VendorData[];
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function VendorPerformance({ data }: VendorPerformanceProps) {
  return (
    <Card>
      <h3 className="mb-4 text-base font-semibold text-surface-800">
        Rendimiento de Vendedores
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-100 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
              <th className="pb-3 pr-4">Nombre</th>
              <th className="pb-3 pr-4 text-right">Conversaciones</th>
              <th className="pb-3 pr-4 text-right">Tiempo Resp. Promedio</th>
              <th className="pb-3 text-right">Resueltas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {data.map((vendor) => {
              const resolvedPct =
                vendor.conversations > 0
                  ? ((vendor.resolved / vendor.conversations) * 100).toFixed(0)
                  : '0';
              return (
                <tr key={vendor.name} className="transition-colors hover:bg-surface-50">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={vendor.name} size="sm" />
                      <span className="font-medium text-surface-800">{vendor.name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right text-surface-700">
                    {vendor.conversations}
                  </td>
                  <td className="py-3 pr-4 text-right text-surface-700">
                    {formatTime(vendor.avgResponseTime)}
                  </td>
                  <td className="py-3 text-right">
                    <span className="font-medium text-surface-800">{vendor.resolved}</span>
                    <span className="ml-1 text-xs text-surface-400">({resolvedPct}%)</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export { VendorPerformance };
export type { VendorPerformanceProps, VendorData };
