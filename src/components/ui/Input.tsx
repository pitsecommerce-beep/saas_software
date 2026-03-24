'use client';

import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ElementType } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ElementType;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon: Icon, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-surface-700"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Icon className="h-4 w-4 text-surface-400" />
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-surface-900',
              'placeholder:text-surface-400',
              'transition-all duration-200 ease-in-out',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              Icon && 'pl-10',
              error
                ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20'
                : 'border-surface-200 focus:border-primary-500 focus:ring-primary-500/20',
              'disabled:bg-surface-50 disabled:text-surface-400 disabled:cursor-not-allowed',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-danger-500 mt-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
export type { InputProps };
