import React from 'react';
import { Flag } from 'lucide-react';
import { Badge } from './Badge';

interface PageBadgeProps {
  pageName?: string | null;
  pageId?: string | null;
  size?: 'sm' | 'md';
  className?: string;
  showIcon?: boolean;
}

export const PageBadge: React.FC<PageBadgeProps> = ({
  pageName,
  pageId,
  className = '',
  showIcon = true,
}) => {
  const displayName = pageName?.trim() || (pageId ? `Page (${pageId})` : '');

  if (!displayName) {
    return null;
  }

  return (
    <Badge
      variant="gray"
      icon={showIcon ? <Flag className="h-3 w-3" /> : undefined}
      title={pageId ? `পেজের নাম: ${displayName} (ID: ${pageId})` : `পেজের নাম: ${displayName}`}
      className={className}
    >
      <span className="truncate max-w-[140px] sm:max-w-[200px]">{displayName}</span>
    </Badge>
  );
};
