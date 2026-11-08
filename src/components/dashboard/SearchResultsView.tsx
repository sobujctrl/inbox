import React from 'react';
import { Search, X, Star, Calendar } from 'lucide-react';
import { Lead } from '../../types/lead';
import { SourceBadge } from '../common/SourceBadge';
import { PageBadge } from '../common/PageBadge';
import { ChannelBadge, resolveMessageChannel } from '../common/ChannelBadge';
import {
 toBengaliNumerals,
 formatBanglaFollowUpDateTime,
 formatFullBanglaDateTimeWithRelative,
 formatBanglaRelativeTime,
 getFollowUpStatusInfo,
 getLeadCommentAndMessageInfo,
} from '../../utils/formatters';
import { formatBdPhoneNumber } from '../../utils/phone';

interface SearchResultsViewProps {
 searchQuery: string;
 matchingLeads: Lead[];
 onSelectLead: (lead: Lead) => void;
 onClearSearch: () => void;
 onToggleStar: (leadId: string) => void;
}

const stripUrlsFromText = (text?: string | null): string => {
 if (!text) return '';
 return text
 .replace(/\s*\((?:কমেন্ট|পোস্ট|লিংক|link)?\s*:?\s*https?:\/\/[^\s)]+\)/gi, '')
 .replace(/https?:\/\/[^\s)"]+/gi, '')
 .replace(/\(\s*\)/g, '')
 .replace(/\s{2,}/g, ' ')
 .trim();
};

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
 searchQuery,
 matchingLeads,
 onSelectLead,
 onClearSearch,
 onToggleStar,
}) => {
 return (
 <div className="space-y-3 animate-in fade-in duration-150">
 {/* Header bar of search results */}
 <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)]/80 bg-[var(--accent-soft)]/50 px-3.5 py-2.5">
 <div className="flex items-center gap-2 min-w-0">
 <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[var(--accent)]">
 <Search className="h-4 w-4" />
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
 খোঁজার ফলাফল:
 </span>
 <span className="inline-flex items-center rounded-md bg-[var(--bg-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--accent)] border border-[var(--border)]">
 "{searchQuery}"
 </span>
 <span className="text-xs font-bold text-[var(--text-secondary)]">
 ({toBengaliNumerals(matchingLeads.length)}টি লিড পাওয়া গেছে)
 </span>
 </div>
 </div>
 </div>

 <button
 type="button"
 onClick={onClearSearch}
 className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-page)] transition cursor-pointer shrink-0"
 title="সার্চ সাফ করুন"
 >
 <X className="h-3.5 w-3.5 text-[var(--text-muted)]" />
 <span>সার্চ সাফ করুন</span>
 </button>
 </div>

 {/* Results content */}
 <div className="rounded-xl border border-[var(--border)]/80 bg-[var(--bg-surface)] shadow-2xs overflow-hidden">
 {matchingLeads.length === 0 ? (
 <div className="flex flex-col items-center justify-center p-10 text-center">
 <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-muted)] mb-2.5">
 <Search className="h-5 w-5" />
 </div>
 <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
 কোনো লিড পাওয়া যায়নি
 </h3>
 <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-sm">
 "{searchQuery}"-এর সাথে মিলে এমন কোনো লিড তালিকায় নেই। নাম, ফোন নম্বর বা ইমেইল সঠিক কিনা পরীক্ষা করুন।
 </p>
 <button
 type="button"
 onClick={onClearSearch}
 className="mt-3.5 rounded-xl bg-[var(--accent)] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition cursor-pointer"
 >
 সার্চ সাফ করুন
 </button>
 </div>
 ) : (
 <>
 {/* Desktop / Tablet Table View */}
 <div className="hidden sm:block overflow-x-auto">
 <table className="w-full min-w-[700px] border-collapse text-left">
 <thead className="sticky top-0 z-20 bg-[var(--bg-subtle)] border-b border-[var(--border)] shadow-2xs">
 <tr className="text-xs font-bold text-[var(--text-secondary)]">
 <th className="py-2.5 pl-3.5 pr-1 w-9 shrink-0">★</th>
 <th className="py-2.5 px-3 w-[24%] min-w-[190px] whitespace-nowrap">নাম ও যোগাযোগ</th>
 <th className="py-2.5 px-3 w-[15%] min-w-[130px] whitespace-nowrap">সোর্স ও পেজ</th>
 <th className="py-2.5 px-3 w-[15%] min-w-[130px] whitespace-nowrap">ফলো-আপ</th>
 <th className="py-2.5 pr-3.5 pl-3 min-w-[260px]">সর্বশেষ বার্তা / কমেন্ট</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {matchingLeads.map((lead) => {
 const channel = resolveMessageChannel(lead.lastChannel, lead);
 const rawFollowUp = lead.followUpDate || lead.nextFollowUpDate;
 const statusInfo = getFollowUpStatusInfo(rawFollowUp, lead.status);
 const commentInfo = getLeadCommentAndMessageInfo(lead);
 const rawMsg =
 commentInfo.messageText ||
 commentInfo.commentText ||
 lead.lastMessage ||
 lead.message ||
 '';
 const cleanMsg = stripUrlsFromText(rawMsg);

 return (
 <tr
 key={lead.id}
 onClick={() => onSelectLead(lead)}
 className="group cursor-pointer transition-colors hover:bg-[var(--accent-soft)]/50 active:bg-blue-100/40"
 >
 {/* Star */}
 <td
 className="py-2.5 pl-3.5 pr-1 w-9 shrink-0 align-top"
 onClick={(e) => {
 e.stopPropagation();
 onToggleStar(lead.id);
 }}
 >
 <button
 className={`p-1 rounded-md hover:bg-[var(--bg-elevated)] transition ${
 lead.isStarred
 ? 'text-amber-500 hover:text-amber-600'
 : 'text-slate-300 hover:text-[var(--text-secondary)]'
 }`}
 title={lead.isStarred ? 'তারকা চিহ্নিত' : 'তারকা চিহ্নিত করুন'}
 >
 <Star className={`h-4 w-4 ${lead.isStarred ? 'fill-current' : ''}`} />
 </button>
 </td>

 {/* Name & Contact */}
 <td className="py-2.5 px-3 min-w-[190px] align-top">
 <div className="text-[15px] font-bold text-[var(--text-primary)] leading-tight truncate max-w-[200px]" title={lead.name}>
 {lead.name}
 </div>
 {lead.phone && lead.phone.trim() ? (
 <div className="text-[13px] font-mono font-bold text-[var(--text-primary)] tabular-nums mt-0.5">
 {formatBdPhoneNumber(lead.phone)}
 </div>
 ) : null}
 {lead.email && lead.email.trim() ? (
 <div className="text-[11.5px] font-medium text-[var(--text-secondary)] truncate max-w-[200px] mt-0.5">
 {lead.email}
 </div>
 ) : null}
 <div className="text-[11.5px] font-medium text-[var(--text-muted)] mt-0.5">
 {formatFullBanglaDateTimeWithRelative(lead.createdAt)}
 </div>
 </td>

 {/* Source & Page */}
 <td className="py-2.5 px-3 min-w-[130px] whitespace-nowrap align-top">
 <div className="flex flex-col items-start gap-1">
 <SourceBadge source={lead.source} sources={lead.sources} size="sm" />
 {(lead.pageName || lead.pageId) && (
 <PageBadge pageName={lead.pageName} pageId={lead.pageId} size="sm" />
 )}
 </div>
 </td>

 {/* Follow-up */}
 <td className="py-2.5 px-3 min-w-[130px] whitespace-nowrap align-top">
 {rawFollowUp ? (
 <div className="flex flex-col items-start gap-1">
 <div className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--text-primary)]">
 <Calendar className="h-3.5 w-3.5 text-blue-500 shrink-0" />
 <span>{formatBanglaFollowUpDateTime(rawFollowUp)}</span>
 </div>
 {statusInfo.type !== 'none' && (
 <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${statusInfo.badgeClass}`}>
 {statusInfo.label}
 </span>
 )}
 </div>
 ) : (
 <span className="text-xs text-[var(--text-muted)]">
 তারিখ সেট নেই
 </span>
 )}
 </td>

 {/* Excerpt */}
 <td className="py-2.5 pr-3.5 pl-3 min-w-[260px] align-top">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 {channel && <ChannelBadge channel={channel} size="sm" />}
 {(lead.lastMessageAt || lead.createdAt) && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)]">
 {formatBanglaRelativeTime(lead.lastMessageAt || lead.createdAt)}
 </span>
 )}
 </div>
 <div
 className="text-[13.5px] leading-[1.4] font-normal text-[var(--text-primary)] line-clamp-2 break-words"
 title={cleanMsg || '—'}
 >
 {cleanMsg || '—'}
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>

 {/* Mobile View */}
 <div className="block sm:hidden divide-y divide-slate-100">
 {matchingLeads.map((lead) => {
 const channel = resolveMessageChannel(lead.lastChannel, lead);
 const rawFollowUp = lead.followUpDate || lead.nextFollowUpDate;
 const statusInfo = getFollowUpStatusInfo(rawFollowUp, lead.status);
 const commentInfo = getLeadCommentAndMessageInfo(lead);
 const rawMsg =
 commentInfo.messageText ||
 commentInfo.commentText ||
 lead.lastMessage ||
 lead.message ||
 '';
 const cleanMsg = stripUrlsFromText(rawMsg);

 return (
 <div
 key={lead.id}
 onClick={() => onSelectLead(lead)}
 className="p-3 transition-colors hover:bg-[var(--accent-soft)]/50 active:bg-blue-100/40 cursor-pointer space-y-2"
 >
 <div className="flex items-start justify-between gap-2">
 <div className="flex items-start gap-1.5 min-w-0 flex-1">
 <button
 onClick={(e) => {
 e.stopPropagation();
 onToggleStar(lead.id);
 }}
 className={`p-1 -ml-1 rounded-md hover:bg-[var(--bg-elevated)] transition ${
 lead.isStarred
 ? 'text-amber-500 hover:text-amber-600'
 : 'text-slate-300 hover:text-[var(--text-secondary)]'
 }`}
 >
 <Star className={`h-4 w-4 ${lead.isStarred ? 'fill-current' : ''}`} />
 </button>
 <div className="min-w-0 flex-1">
 <h4 className="text-[15px] font-bold text-[var(--text-primary)] leading-tight truncate">
 {lead.name}
 </h4>
 {lead.phone && lead.phone.trim() ? (
 <div className="text-[13px] font-mono font-bold text-[var(--text-primary)] tabular-nums mt-0.5">
 {formatBdPhoneNumber(lead.phone)}
 </div>
 ) : null}
 </div>
 </div>

 <div className="flex flex-col items-end gap-1 shrink-0">
 <SourceBadge source={lead.source} sources={lead.sources} size="sm" />
 {(lead.pageName || lead.pageId) && (
 <PageBadge pageName={lead.pageName} pageId={lead.pageId} size="sm" />
 )}
 </div>
 </div>

 <div className="rounded-lg bg-[var(--bg-page)] p-2.5 border border-[var(--border)]/70">
 <div className="flex items-center gap-2 mb-1">
 {channel && <ChannelBadge channel={channel} size="sm" />}
 {rawFollowUp && statusInfo.type !== 'none' && (
 <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${statusInfo.badgeClass}`}>
 {statusInfo.label}
 </span>
 )}
 </div>
 <p className="text-[13px] leading-[1.4] text-[var(--text-primary)] line-clamp-2">
 {cleanMsg || '—'}
 </p>
 </div>
 </div>
 );
 })}
 </div>
 </>
 )}
 </div>
 </div>
 );
};
