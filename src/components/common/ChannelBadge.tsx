import React from 'react';
import { Badge } from './Badge';

export type MessageChannelType = 'comment' | 'messenger' | 'whatsapp' | string;

interface ChannelBadgeProps {
  channel?: MessageChannelType | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const resolveMessageChannel = (
  channel?: string | null,
  fallback?: {
    lastChannel?: string;
    [key: string]: any;
  }
): 'comment' | 'messenger' | 'whatsapp' | null => {
  const raw = (channel || fallback?.lastChannel || '').toString().trim().toLowerCase();
  if (!raw) return null;

  if (raw === 'comment' || raw === 'facebook_comment' || raw.includes('comment') || raw.includes('কমেন্ট')) {
    return 'comment';
  }
  if (raw === 'messenger' || raw === 'facebook_messenger' || raw.includes('messenger') || raw.includes('মেসেঞ্জার')) {
    return 'messenger';
  }
  if (raw === 'whatsapp' || raw.includes('whatsapp') || raw.includes('হোয়াটসঅ্যাপ')) {
    return 'whatsapp';
  }

  return null;
};

export const ChannelBadge: React.FC<ChannelBadgeProps> = ({
  channel,
  className = '',
}) => {
  if (!channel) return null;

  const isComment = channel === 'comment' || channel.includes('comment') || channel.includes('কমেন্ট');
  const isMessenger = channel === 'messenger' || channel.includes('messenger') || channel.includes('মেসেঞ্জার');
  const isWhatsApp = channel === 'whatsapp' || channel.includes('whatsapp') || channel.includes('হোয়াটসঅ্যাপ');

  if (!isComment && !isMessenger && !isWhatsApp) return null;

  if (isComment) {
    return (
      <Badge variant="amber" title="Facebook কমেন্ট থেকে প্রাপ্ত বার্তা" className={className}>
        💬 কমেন্ট
      </Badge>
    );
  }

  if (isMessenger) {
    return (
      <Badge variant="teal" title="Messenger ইনবক্স থেকে প্রাপ্ত বার্তা" className={className}>
        ✉️ মেসেঞ্জার
      </Badge>
    );
  }

  return (
    <Badge variant="green" title="WhatsApp থেকে প্রাপ্ত বার্তা" className={className}>
      🟢 WhatsApp
    </Badge>
  );
};
