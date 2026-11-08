import React from 'react';

export type BadgeVariant = 'green' | 'amber' | 'red' | 'blue' | 'indigo' | 'teal' | 'pink' | 'gray';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  title?: string;
  onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; border: string; text: string }> = {
  green: {
    bg: 'bg-[var(--badge-green-bg)]',
    border: 'border-[var(--badge-green-border)]',
    text: 'text-[var(--badge-green-text)]',
  },
  amber: {
    bg: 'bg-[var(--badge-amber-bg)]',
    border: 'border-[var(--badge-amber-border)]',
    text: 'text-[var(--badge-amber-text)]',
  },
  red: {
    bg: 'bg-[var(--badge-red-bg)]',
    border: 'border-[var(--badge-red-border)]',
    text: 'text-[var(--badge-red-text)]',
  },
  blue: {
    bg: 'bg-[var(--badge-blue-bg)]',
    border: 'border-[var(--badge-blue-border)]',
    text: 'text-[var(--badge-blue-text)]',
  },
  indigo: {
    bg: 'bg-[var(--badge-indigo-bg)]',
    border: 'border-[var(--badge-indigo-border)]',
    text: 'text-[var(--badge-indigo-text)]',
  },
  teal: {
    bg: 'bg-[var(--badge-teal-bg)]',
    border: 'border-[var(--badge-teal-border)]',
    text: 'text-[var(--badge-teal-text)]',
  },
  pink: {
    bg: 'bg-[var(--badge-pink-bg)]',
    border: 'border-[var(--badge-pink-border)]',
    text: 'text-[var(--badge-pink-text)]',
  },
  gray: {
    bg: 'bg-[var(--badge-gray-bg)]',
    border: 'border-[var(--badge-gray-border)]',
    text: 'text-[var(--badge-gray-text)]',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'gray',
  children,
  icon,
  className = '',
  title,
  onClick,
}) => {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.gray;

  return (
    <span
      title={title}
      onClick={onClick}
      className={`inline-flex h-[22px] items-center justify-center gap-1 rounded-full border px-2 text-xs font-medium tracking-tight whitespace-nowrap transition-colors select-none ${styles.bg} ${styles.border} ${styles.text} ${className}`}
    >
      {icon && <span className="flex items-center justify-center shrink-0 [&>svg]:h-3 [&>svg]:w-3">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
};
