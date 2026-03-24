'use client';

import { useState } from 'react';
import { cn, getInitials } from '@/lib/utils';

const sizeStyles = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
};

const bgColors = [
  'bg-primary-500',
  'bg-accent-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-indigo-500',
];

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return bgColors[Math.abs(hash) % bgColors.length];
}

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const showInitials = !src || imgError;

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full shrink-0',
        'font-semibold text-white select-none',
        'ring-2 ring-white',
        sizeStyles[size],
        showInitials && getColorFromName(name),
        className
      )}
    >
      {showInitials ? (
        <span>{getInitials(name)}</span>
      ) : (
        <img
          src={src!}
          alt={name}
          onError={() => setImgError(true)}
          className="h-full w-full rounded-full object-cover"
        />
      )}
    </div>
  );
}

export { Avatar };
export type { AvatarProps };
