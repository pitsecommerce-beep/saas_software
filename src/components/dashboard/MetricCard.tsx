'use client';

import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  delay?: number;
}

const changeStyles = {
  positive: 'bg-accent-50 text-accent-700',
  negative: 'bg-red-50 text-red-600',
  neutral: 'bg-surface-100 text-surface-600',
};

function MetricCard({ title, value, change, changeType, icon: Icon, delay = 0 }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    >
      <Card className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-500">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-surface-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-surface-900">{value}</p>
          <span
            className={cn(
              'mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              changeStyles[changeType]
            )}
          >
            {change}
          </span>
        </div>
      </Card>
    </motion.div>
  );
}

export { MetricCard };
export type { MetricCardProps };
