import React from 'react';
import { LeadStatus } from '../../types/lead';
import { STATUS_LABELS } from '../../utils/formatters';
import { Badge, BadgeVariant } from './Badge';

interface StatusBadgeProps {
  status: LeadStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  dotOnly?: boolean;
}

export const getStatusVariant = (status: LeadStatus): BadgeVariant => {
  switch (status) {
    case 'new':
      return 'blue';
    case 'contacted':
      return 'indigo';
    case 'followup':
      return 'amber';
    case 'won':
    case 'confirmed':
      return 'green';
    case 'pending':
      return 'amber';
    default:
      return 'gray';
  }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
  dotOnly = false,
}) => {
  const variant = getStatusVariant(status);
  const label = STATUS_LABELS[status] || status;

  if (dotOnly) {
    return (
      <span
        className={`inline-block rounded-full ${
          variant === 'green'
            ? 'bg-[var(--badge-green-text)]'
            : variant === 'amber'
            ? 'bg-[var(--badge-amber-text)]'
            : variant === 'blue'
            ? 'bg-[var(--badge-blue-text)]'
            : variant === 'indigo'
            ? 'bg-[var(--badge-indigo-text)]'
            : 'bg-[var(--badge-gray-text)]'
        } ${size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'} ${className}`}
        title={label}
      />
    );
  }

  const dotIcon = (
    <span
      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
        variant === 'green'
          ? 'bg-[var(--badge-green-text)]'
          : variant === 'amber'
          ? 'bg-[var(--badge-amber-text)]'
          : variant === 'blue'
          ? 'bg-[var(--badge-blue-text)]'
          : variant === 'indigo'
          ? 'bg-[var(--badge-indigo-text)]'
          : 'bg-[var(--badge-gray-text)]'
      }`}
    />
  );

  return (
    <Badge variant={variant} icon={dotIcon} className={className}>
      {label}
    </Badge>
  );
};
