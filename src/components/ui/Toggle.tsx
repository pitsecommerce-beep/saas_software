'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  description?: string;
  className?: string;
}

function Toggle({ enabled, onChange, label, description, className }: ToggleProps) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full',
          'transition-colors duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2',
          enabled ? 'bg-primary-500' : 'bg-surface-200'
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow-sm',
            enabled ? 'ml-[1.375rem]' : 'ml-1'
          )}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className="text-sm font-medium text-surface-800">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-surface-500 mt-0.5">
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export { Toggle };
export type { ToggleProps };
