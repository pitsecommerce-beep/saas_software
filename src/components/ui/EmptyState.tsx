import type { ReactNode, ElementType } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className
      )}
    >
      {Icon && (
        <div className="mb-4 rounded-2xl bg-surface-100 p-4">
          <Icon className="h-8 w-8 text-surface-400" />
        </div>
      )}
      <h3 className="text-base font-semibold text-surface-800">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-surface-500">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
