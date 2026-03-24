'use client';

import type { ReactNode, HTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
}

function Card({ children, className, onClick, hover = false }: CardProps) {
  const Component = hover || onClick ? motion.div : 'div';

  const motionProps =
    hover || onClick
      ? {
          whileHover: { y: -2, boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)' },
          transition: { duration: 0.2, ease: 'easeOut' as const },
        }
      : {};

  return (
    <Component
      className={cn(
        'rounded-2xl border border-surface-100 bg-white p-5',
        'shadow-sm',
        (hover || onClick) && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      {...motionProps}
    >
      {children}
    </Component>
  );
}

export { Card };
export type { CardProps };
