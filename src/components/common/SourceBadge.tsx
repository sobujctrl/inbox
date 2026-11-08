import React from 'react';
import { Globe } from 'lucide-react';
import { LeadSource } from '../../types/lead';
import { SOURCE_LABELS } from '../../utils/formatters';
import { Badge, BadgeVariant } from './Badge';

interface SourceBadgeProps {
  source: LeadSource;
  sources?: LeadSource[];
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const FacebookIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export const MessengerIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.914 1.454 5.518 3.735 7.197V22l3.418-1.877c.905.251 1.86.388 2.847.388 5.523 0 10-4.145 10-9.253C22 6.145 17.523 2 12 2zm1.002 12.441l-2.56-2.73-5 2.73 5.497-5.835 2.623 2.73 4.937-2.73-5.497 5.835z" />
  </svg>
);

export const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);

export const WebsiteIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <Globe className={className} />
);

export const ManualIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const getSourceIcon = (source: LeadSource, className?: string) => {
  switch (source) {
    case 'facebook':
      return <FacebookIcon className={className || 'w-3 h-3'} />;
    case 'messenger':
      return <MessengerIcon className={className || 'w-3 h-3'} />;
    case 'whatsapp':
      return <WhatsAppIcon className={className || 'w-3 h-3'} />;
    case 'website':
      return <WebsiteIcon className={className || 'w-3 h-3'} />;
    case 'manual':
    default:
      return <ManualIcon className={className || 'w-3 h-3'} />;
  }
};

/**
 * Central Source Color Map as requested in Step 1:
 * facebook -> teal
 * messenger -> teal
 * website -> pink
 * whatsapp -> green
 * manual -> gray
 * unknown/other -> gray
 */
export const SOURCE_COLORS: Record<string, BadgeVariant> = {
  facebook: 'teal',
  messenger: 'teal',
  website: 'pink',
  whatsapp: 'green',
  manual: 'gray',
  other: 'gray',
};

export const getSourceVariant = (source: LeadSource): BadgeVariant => {
  return SOURCE_COLORS[source] || 'gray';
};

export const SourceBadge: React.FC<SourceBadgeProps> = ({
  source,
  sources,
  showLabel = true,
  className = '',
}) => {
  const displaySources = sources && sources.length > 0 ? sources : [source];
  const isMultiSource = displaySources.length > 1;

  if (isMultiSource) {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        {displaySources.map((s) => (
          <Badge
            key={s}
            variant={getSourceVariant(s)}
            icon={getSourceIcon(s)}
            title={SOURCE_LABELS[s] || s}
          >
            {showLabel ? SOURCE_LABELS[s] || s : ''}
          </Badge>
        ))}
      </div>
    );
  }

  const variant = getSourceVariant(source);

  return (
    <Badge
      variant={variant}
      icon={getSourceIcon(source)}
      className={className}
    >
      {showLabel ? SOURCE_LABELS[source] || source : ''}
    </Badge>
  );
};
