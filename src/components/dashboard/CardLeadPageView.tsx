import React, { useState, useEffect, useMemo } from 'react';
import {
 ArrowLeft,
 TrendingUp,
 PhoneCall,
 CheckCircle2,
 Clock,
 Star,
 Calendar,
 ExternalLink,
 Filter,
 Users,
 X,
 LayoutGrid,
 List,
} from 'lucide-react';
import { Lead, LeadStatus, LeadSource } from '../../types/lead';
import { getDhakaDateString, getDateRangeBoundaries, isLeadNew, leadService, getMonthKey } from '../../services/leadService';
import { useWorkspace } from '../../context/WorkspaceContext';
import { authService } from '../../services/authService';
import {
 SourceBadge,
 FacebookIcon,
 MessengerIcon,
 WhatsAppIcon,
 WebsiteIcon,
 ManualIcon,
 SOURCE_COLORS,
} from '../common/SourceBadge';
import { PageBadge } from '../common/PageBadge';
import { ChannelBadge, resolveMessageChannel } from '../common/ChannelBadge';
import {
 formatBanglaFollowUpDateTime,
 formatFullBanglaDateTimeWithRelative,
 formatBanglaRelativeTime,
 getFollowUpStatusInfo,
 getLeadCommentAndMessageInfo,
 toBengaliNumerals,
 formatTaka,
} from '../../utils/formatters';
import { formatBdPhoneNumber } from '../../utils/phone';
import { FollowUpDatePickerModal } from '../modals/FollowUpDatePickerModal';
import { Info } from 'lucide-react';

export type CardFilterType =
 | 'all'
 | 'new'
 | 'followup'
 | 'won'
 | 'pending'
 | 'cancelled'
 | 'hold'
 | 'facebook'
 | 'messenger'
 | 'whatsapp'
 | 'website'
 | 'manual';

export const CARD_TYPE_TO_ROUTE: Record<CardFilterType, string> = {
 all: '#/leads/all',
 new: '#/leads/new',
 followup: '#/leads/followup',
 won: '#/leads/confirm',
 pending: '#/leads/pending',
 cancelled: '#/leads/cancel',
 hold: '#/leads/hold',
 facebook: '#/leads/facebook',
 messenger: '#/leads/messenger',
 whatsapp: '#/leads/whatsapp',
 website: '#/leads/website',
 manual: '#/leads/manual',
};

export const ROUTE_TO_CARD_TYPE: Record<string, CardFilterType> = {
 '#/leads/all': 'all',
 '#/leads/new': 'new',
 '#/leads/followup': 'followup',
 '#/leads/confirm': 'won',
 '#/leads/won': 'won',
 '#/leads/pending': 'pending',
 '#/leads/cancel': 'cancelled',
 '#/leads/cancelled': 'cancelled',
 '#/leads/hold': 'hold',
 '#/leads/facebook': 'facebook',
 '#/leads/messenger': 'messenger',
 '#/leads/whatsapp': 'whatsapp',
 '#/leads/website': 'website',
 '#/leads/manual': 'manual',
};

interface CardLeadPageViewProps {
 cardType: CardFilterType;
 allLeads: Lead[];
 onBack: () => void;
 onSelectLead: (lead: Lead) => void;
 onQuickStatusChange: (leadId: string, status: LeadStatus) => void;
 onToggleStar: (leadId: string) => void;
 onUpdateFollowUpDate: (leadId: string, newFollowUpDate: string | null) => Promise<void> | void;
 selectedMonth: string;
 onMonthChange: (monthKey: string) => void;
 stats: any; // Using any for simplicity as SummaryStats might have circular issues if imported here
}

/**
 * Strips raw URLs (http://, https://) and url-wrapper artifacts like "(কমেন্ট: http...)"
 * from comment/message excerpts in the list view so only pure human text is shown.
 */
const stripUrlsFromText = (text?: string | null): string => {
 if (!text) return '';
 return text
 .replace(/\s*\((?:কমেন্ট|পোস্ট|লিংক|link)?\s*:?\s*https?:\/\/[^\s)]+\)/gi, '')
 .replace(/https?:\/\/[^\s)"]+/gi, '')
 .replace(/\(\s*\)/g, '')
 .replace(/\s{2,}/g, ' ')
 .trim();
};

const VIEW_MODE_STORAGE_KEY = 'unified_lead_card_page_view_mode';

const getInitialViewMode = (): 'list' | 'grid' => {
 try {
 const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
 if (saved === 'list' || saved === 'grid') return saved;
 } catch (e) {
 // ignore
 }
 return 'list';
};

export const CardLeadPageView: React.FC<CardLeadPageViewProps> = ({
 cardType,
 allLeads,
 onBack,
 onSelectLead,
 onQuickStatusChange,
 onToggleStar,
 onUpdateFollowUpDate,
 selectedMonth,
 onMonthChange,
 stats,
}) => {
 const { ownerUid } = useWorkspace();
 const currentUser = authService.getCurrentUser();
 const isSourceCard = ['facebook', 'messenger', 'whatsapp', 'website', 'manual'].includes(cardType);
 const [pageFilter, setPageFilter] = useState<string>('all');
 const [sourceFilter, setSourceFilter] = useState<string>('all');
 const [dateRangeFilter, setDateRangeFilter] = useState<
 'all' | 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'custom'
 >('all');
 const [customStart, setCustomStart] = useState<string>('');
 const [customEnd, setCustomEnd] = useState<string>('');
 const [followUpModalLead, setFollowUpModalLead] = useState<Lead | null>(null);
 const [isMarkSeenModalOpen, setIsMarkSeenModalOpen] = useState(false);

 // Persistent view mode across all 11 pages
 const [viewMode, setViewModeState] = useState<'list' | 'grid'>(getInitialViewMode);

 const setViewMode = (mode: 'list' | 'grid') => {
 setViewModeState(mode);
 try {
 localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
 } catch (e) {
 // ignore
 }
 };

 // Reset dropdowns each time the card page opens or changes
 useEffect(() => {
  setPageFilter('all');
  setSourceFilter('all');
  setDateRangeFilter('all');
  setCustomStart('');
  setCustomEnd('');
 }, [cardType]);

 // Sync Month Chips & Time Dropdown
 useEffect(() => {
  if (dateRangeFilter !== 'all') {
   onMonthChange('');
  }
 }, [dateRangeFilter, onMonthChange]);

 useEffect(() => {
  if (selectedMonth) {
   setDateRangeFilter('all');
   setCustomStart('');
   setCustomEnd('');
  }
 }, [selectedMonth]);

 // Card Meta: Title, Icon, Badge & Colors
 const cardMeta = useMemo(() => {
 switch (cardType) {
 case 'all':
 return {
 title: 'সব লিডস',
 subtitle: 'সকল সোর্স ও স্ট্যাটাসের লিডসমূহ',
 description: 'সিস্টেমে থাকা সকল সোর্স ও স্ট্যাটাসের লিডের বিস্তারিত পূর্ণাঙ্গ তালিকা।',
 icon: <Users className="h-6 w-6 text-[var(--text-primary)] " />,
 iconBg: 'bg-[var(--bg-elevated)] ',
 textColor: 'text-[var(--text-primary)] ',
 badgeBg: 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border)] ',
 };
 case 'new':
 return {
 title: 'নতুন লিডস',
 subtitle: 'আজকে প্রাপ্ত নতুন লিডসমূহ',
 description: 'আজকের দিনে আসা সকল নতুন ও আন-কন্টাক্টেড লিডের বিস্তারিত তালিকা।',
 icon: <TrendingUp className="h-6 w-6 text-[var(--accent)] " />,
 iconBg: 'bg-[var(--badge-blue-bg)] ',
 textColor: 'text-[var(--accent)] ',
 badgeBg: 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--border)] ',
 };
 case 'followup':
 return {
 title: 'ফলো-আপ লিডস',
 subtitle: 'আজকের ও ওভারডিউ ফলো-আপ লিডসমূহ',
 description: 'আজকের শিডিউল করা এবং নির্ধারিত সময় পার হয়ে যাওয়া (ওভারডিউ) ফলো-আপ লিড।',
 icon: <PhoneCall className="h-6 w-6 text-amber-600 " />,
 iconBg: 'bg-[var(--badge-amber-bg)] ',
 textColor: 'text-amber-600 ',
 badgeBg: 'bg-[var(--warning-bg)] text-[var(--warning)] border-amber-200 ',
 };
 case 'won':
 return {
 title: 'কনফার্মড লিডস',
 subtitle: 'সফলভাবে নিশ্চিত ও কনফার্মড ডিলসমূহ',
 description: 'সফলভাবে সম্পন্ন হওয়া এবং ক্লায়েন্ট কর্তৃক নিশ্চিতকৃত সব সফল অর্ডারের তালিকা।',
 icon: <CheckCircle2 className="h-6 w-6 text-[var(--success)] " />,
 iconBg: 'bg-[var(--badge-green-bg)] ',
 textColor: 'text-[var(--success)] ',
 badgeBg: 'bg-[var(--success-bg)] text-[var(--success)] border-emerald-200 ',
 };
 case 'pending':
 return {
 title: 'পেন্ডিং লিডস',
 subtitle: 'চলমান আলোচনা ও পেন্ডিং ডিলসমূহ',
 description: 'যেসব লিডের সাথে বর্তমানে কথোপকথন ও সেলস প্রক্রিয়া চলছে।',
 icon: <Clock className="h-6 w-6 text-amber-600 " />,
 iconBg: 'bg-[var(--badge-amber-bg)] ',
 textColor: 'text-amber-600 ',
 badgeBg: 'bg-[var(--warning-bg)] text-[var(--warning)] border-amber-200 ',
 };
 case 'cancelled':
 return {
 title: 'ক্যান্সেলড লিডস',
 subtitle: 'বাতিলকৃত অথবা ড্রপ হওয়া লিডসমূহ',
 description: 'যেসব লিড বা অর্ডার কাস্টমার বাতিল করেছেন অথবা ডিল সম্পূর্ণ হয়নি।',
 icon: <X className="h-6 w-6 text-[var(--danger)] " />,
 iconBg: 'bg-[var(--danger-bg)] ',
 textColor: 'text-[var(--danger)] ',
 badgeBg: 'bg-[var(--danger-bg)] text-[var(--danger)] border-rose-200 ',
 };
 case 'hold':
 return {
 title: 'হোল্ড লিডস',
 subtitle: 'স্থগিত রাখা লিডসমূহ',
 description: 'যেসব লিড বর্তমানে সাময়িকভাবে স্থগিত বা নির্দিষ্ট সময়ের জন্য পজ করা আছে।',
 icon: <Clock className="h-6 w-6 text-[var(--text-secondary)] " />,
 iconBg: 'bg-[var(--bg-elevated)] ',
 textColor: 'text-[var(--text-primary)] ',
 badgeBg: 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border)] ',
 };
 case 'facebook':
 return {
 title: 'Facebook',
 subtitle: 'পোস্ট ও কমেন্ট লিডস',
 description: 'Facebook পেজের পোস্ট ও কমেন্ট থেকে স্বয়ংক্রিয়ভাবে সংগৃহীত সকল লিড।',
 icon: <FacebookIcon className="h-6 w-6 text-[#1877F2]" />,
 iconBg: 'bg-[var(--badge-blue-bg)] ',
 textColor: 'text-[#1877F2] ',
 badgeBg: 'bg-[var(--accent-soft)] text-[#1877F2] border-[var(--border)] ',
 };
 case 'messenger':
 return {
 title: 'Messenger',
 subtitle: 'ইনবক্স সরাসরি চ্যাট লিডস',
 description: 'Facebook Messenger ইনবক্সের সরাসরি চ্যাট বার্তা থেকে আসা সকল লিড।',
 icon: <MessengerIcon className="h-6 w-6 text-[#0084FF]" />,
 iconBg: 'bg-[var(--badge-indigo-bg)] ',
 textColor: 'text-[#0084FF] ',
 badgeBg: 'bg-[var(--badge-indigo-bg)] text-[var(--badge-indigo-text)] border-[var(--badge-indigo-border)] ',
 };
 case 'whatsapp':
 return {
 title: 'WhatsApp',
 subtitle: 'সরাসরি চ্যাট বার্তা লিডস',
 description: 'WhatsApp মেসেজিং চ্যানেলের মাধ্যমে সরাসরি যোগাযোগ করা সব লিড।',
 icon: <WhatsAppIcon className="h-6 w-6 text-[#25D366]" />,
 iconBg: 'bg-[var(--badge-green-bg)] ',
 textColor: 'text-[#25D366] ',
 badgeBg: 'bg-[var(--success-bg)] text-[#25D366] border-emerald-200 ',
 };
 case 'website':
 return {
 title: 'Website',
 subtitle: 'ওয়েব ভিজিটর ও ফর্ম লিডস',
 description: 'ওয়েবসাইট ফর্ম ও ল্যান্ডিং পেজ সাবমিশন থেকে সংগৃহীত লিডসমূহ।',
 icon: <WebsiteIcon className="h-6 w-6 text-teal-600 " />,
 iconBg: 'bg-[var(--badge-teal-bg)] ',
 textColor: 'text-teal-600 ',
 badgeBg: 'bg-[var(--badge-teal-bg)] text-[var(--badge-teal-text)] border-[var(--badge-teal-border)] ',
 };
 case 'manual':
 return {
 title: 'ম্যানুয়াল এন্ট্রি',
 subtitle: 'অফলাইন ও ডিরেক্ট এন্ট্রি লিডস',
 description: 'এডমিন বা টিম মেম্বারদের হাতে সরাসরি সিস্টেমে যুক্ত করা অফলাইন লিড।',
 icon: <ManualIcon className="h-6 w-6 text-[var(--text-primary)] " />,
 iconBg: 'bg-[var(--bg-elevated)] ',
 textColor: 'text-[var(--text-primary)] ',
 badgeBg: 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border)] ',
 };
 default:
 return {
 title: 'লিড তালিকা',
 subtitle: 'লিডসমূহ',
 description: 'নির্দিষ্ট ফিল্টারের অধীনে থাকা লিড তালিকা।',
 icon: <Users className="h-6 w-6 text-[var(--text-primary)] " />,
 iconBg: 'bg-[var(--bg-elevated)] ',
 textColor: 'text-[var(--text-primary)] ',
 badgeBg: 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border)] ',
 };
 }
 }, [cardType]);

 // Today in Dhaka
 const todayDhaka = useMemo(() => getDhakaDateString(new Date().toISOString()), []);

 // Base card leads matching the exact dashboard card logic
 const cardLeads = useMemo(() => {
 return allLeads.filter((lead) => {
 if (lead.deleted) return false;

 switch (cardType) {
 case 'all':
 return true;
 case 'new': {
 return lead.status === 'new';
 }
 case 'followup': {
 const raw = lead.followUpDate || lead.nextFollowUpDate;
 const fuDhaka = getDhakaDateString(raw);
 return Boolean(
 lead.status === 'followup' ||
 (fuDhaka && fuDhaka <= todayDhaka && !['won', 'cancelled', 'hold', 'lost'].includes(lead.status))
 );
 }
 case 'won':
 return lead.status === 'won' || lead.status === 'confirmed';
 case 'pending':
 return ['new', 'contacted', 'followup', 'pending'].includes(lead.status);
 case 'cancelled':
 return lead.status === 'cancelled';
 case 'hold':
 return lead.status === 'hold';
 case 'facebook': {
 const sources = Array.isArray(lead.sources) && lead.sources.length > 0 ? lead.sources : [lead.source];
 return sources.includes('facebook') || lead.source === 'facebook';
 }
 case 'messenger': {
 const sources = Array.isArray(lead.sources) && lead.sources.length > 0 ? lead.sources : [lead.source];
 return sources.includes('messenger') || lead.source === 'messenger';
 }
 case 'whatsapp': {
 const sources = Array.isArray(lead.sources) && lead.sources.length > 0 ? lead.sources : [lead.source];
 return sources.includes('whatsapp') || lead.source === 'whatsapp';
 }
 case 'website': {
 const sources = Array.isArray(lead.sources) && lead.sources.length > 0 ? lead.sources : [lead.source];
 return sources.includes('website') || lead.source === 'website';
 }
 case 'manual': {
 const sources = Array.isArray(lead.sources) && lead.sources.length > 0 ? lead.sources : [lead.source];
 return sources.includes('manual') || lead.source === 'manual';
 }
 default:
 return true;
 }
 });
 }, [allLeads, cardType, todayDhaka]);

 // Connected pages extracted from cardLeads
 const pageOptions = useMemo(() => {
 const pageCounts: Record<string, { name: string; count: number }> = {};
 let noPageCount = 0;

 cardLeads.forEach((l) => {
 const pageKey = l.pageName || l.pageId;
 if (pageKey) {
 if (!pageCounts[pageKey]) {
 pageCounts[pageKey] = { name: l.pageName || l.pageId || pageKey, count: 0 };
 }
 pageCounts[pageKey].count += 1;
 } else {
 noPageCount += 1;
 }
 });

 return {
 pages: Object.entries(pageCounts).map(([key, data]) => ({
 key,
 name: data.name,
 count: data.count,
 })),
 noPageCount,
 };
 }, [cardLeads]);

 // Helper to determine if a lead matches a specific source
 const isLeadMatchingSource = (l: Lead, source: 'all' | LeadSource): boolean => {
 if (source === 'all') return true;
 const sources = Array.isArray(l.sources) && l.sources.length > 0 ? l.sources : [l.source];
 if (source === 'facebook') {
 return (
 sources.includes('facebook') ||
 l.source === 'facebook' ||
 l.lastChannel === 'comment' ||
 Boolean(l.lastPostLink) ||
 Boolean(l.lastComment) ||
 Boolean(l.commentUrl)
 );
 }
 if (source === 'messenger') {
 return (
 sources.includes('messenger') ||
 l.source === 'messenger' ||
 l.lastChannel === 'messenger' ||
 Boolean(l.messengerId)
 );
 }
 return sources.includes(source) || l.source === source;
 };

 // Source options calculated on leads matching active pageFilter & dateRangeFilter
 const sourceOptions = useMemo(() => {
 let baseList = cardLeads;

 // Apply Page filter to base list for counts
 if (pageFilter !== 'all') {
 if (pageFilter === '__no_page__') {
 baseList = baseList.filter((l) => !l.pageName && !l.pageId);
 } else {
 baseList = baseList.filter((l) => l.pageName === pageFilter || l.pageId === pageFilter);
 }
 }

 // Apply Date Range filter to base list for counts
 if (dateRangeFilter !== 'all') {
 if (dateRangeFilter === 'custom') {
 if (customStart || customEnd) {
 baseList = baseList.filter((l) => {
 const leadDhaka = getDhakaDateString(l.createdAt);
 if (!leadDhaka) return false;
 if (customStart && leadDhaka < customStart) return false;
 if (customEnd && leadDhaka > customEnd) return false;
 return true;
 });
 }
 } else {
 const { start, end } = getDateRangeBoundaries(dateRangeFilter);
 if (start && end) {
 baseList = baseList.filter((l) => {
 const leadDhaka = getDhakaDateString(l.createdAt);
 return leadDhaka >= start && leadDhaka <= end;
 });
 }
 }
 }

 const fbCount = baseList.filter((l) => isLeadMatchingSource(l, 'facebook')).length;
 const msgCount = baseList.filter((l) => isLeadMatchingSource(l, 'messenger')).length;
 const waCount = baseList.filter((l) => isLeadMatchingSource(l, 'whatsapp')).length;
 const webCount = baseList.filter((l) => isLeadMatchingSource(l, 'website')).length;
 const manualCount = baseList.filter((l) => isLeadMatchingSource(l, 'manual')).length;

 return [
 { key: 'all', label: 'সব সোর্স', count: baseList.length },
 { key: 'facebook', label: 'Facebook', count: fbCount },
 { key: 'messenger', label: 'Messenger', count: msgCount },
 { key: 'whatsapp', label: 'WhatsApp', count: waCount },
 { key: 'website', label: 'Website', count: webCount },
 ...(manualCount > 0 ? [{ key: 'manual', label: 'ম্যানুয়াল এন্ট্রি', count: manualCount }] : []),
 ];
 }, [cardLeads, pageFilter, dateRangeFilter, customStart, customEnd]);

 // Apply Page Filter, Source Filter & Date Range Filter with AND condition
 const filteredList = useMemo(() => {
 let list = cardLeads;

 // 1. Page filter
 if (pageFilter !== 'all') {
 if (pageFilter === '__no_page__') {
 list = list.filter((l) => !l.pageName && !l.pageId);
 } else {
 list = list.filter((l) => l.pageName === pageFilter || l.pageId === pageFilter);
 }
 }

 // 2. Source filter (only when not a source-specific page)
 if (!isSourceCard && sourceFilter !== 'all') {
 list = list.filter((l) => isLeadMatchingSource(l, sourceFilter as any));
 }

 // 3. Date Range filter
 if (dateRangeFilter !== 'all') {
 if (dateRangeFilter === 'custom') {
 if (customStart || customEnd) {
 list = list.filter((l) => {
 const leadDhaka = getDhakaDateString(l.createdAt);
 if (!leadDhaka) return false;
 if (customStart && leadDhaka < customStart) return false;
 if (customEnd && leadDhaka > customEnd) return false;
 return true;
 });
 }
 } else {
 const { start, end } = getDateRangeBoundaries(dateRangeFilter);
 if (start && end) {
 list = list.filter((l) => {
 const leadDhaka = getDhakaDateString(l.createdAt);
 return leadDhaka >= start && leadDhaka <= end;
 });
 }
 }
 }

 // 4. Monthly filter (from dashboard/chips)
 if (selectedMonth) {
  list = list.filter((l) => getMonthKey(l.createdAt) === selectedMonth);
 }

 return list;
 }, [cardLeads, pageFilter, sourceFilter, isSourceCard, dateRangeFilter, customStart, customEnd, selectedMonth]);

 // Sort list so that NEW leads (isLeadNew(lead)) appear FIRST at the very top
 const displayList = useMemo(() => {
  return [...filteredList].sort((a, b) => {
   const newA = isLeadNew(a, currentUser?.uid);
   const newB = isLeadNew(b, currentUser?.uid);
   if (newA && !newB) return -1;
   if (!newA && newB) return 1;
   const timeA = new Date(a.lastMessageAt || a.createdAt).getTime() || 0;
   const timeB = new Date(b.lastMessageAt || b.createdAt).getTime() || 0;
   return timeB - timeA;
  });
 }, [filteredList, currentUser?.uid]);

 const newLeadsInView = useMemo(() => {
  return filteredList.filter((l) => isLeadNew(l, currentUser?.uid));
 }, [filteredList, currentUser?.uid]);

 // Effective active source (source card page or selected source filter)
 const effectiveSource: 'all' | LeadSource = isSourceCard
 ? (cardType as LeadSource)
 : (sourceFilter as 'all' | LeadSource);

 // Column header for the message column based on active source
 const messageColumnTitle = useMemo(() => {
 if (effectiveSource === 'facebook') return 'সর্বশেষ কমেন্ট';
 if (effectiveSource === 'all') return 'সর্বশেষ কমেন্ট / মেসেজ';
 return 'সর্বশেষ মেসেজ';
 }, [effectiveSource]);

 return (
 <div className="space-y-3.5 animate-in fade-in duration-150">
 {/* ================= COMPACT SINGLE-LINE HEADER BAR ================= */}
 <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[var(--border)]/80 bg-[var(--bg-surface)] px-3.5 py-2 shadow-2xs ">
 <div className="flex items-center gap-3 min-w-0">
 <button
 onClick={onBack}
 className="group inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)]/90 bg-[var(--bg-page)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] hover:border-slate-300 hover:text-[var(--accent)] transition cursor-pointer shrink-0"
 title="ড্যাশবোর্ডে ফিরুন"
 >
 <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
 <span>← ড্যাশবোর্ডে ফিরুন</span>
 </button>

 <div className="h-4 w-px bg-slate-200 hidden sm:block" />

 <div className="flex items-center gap-2 min-w-0">
 <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cardMeta.iconBg} [&_svg]:h-4 [&_svg]:w-4`}>
 {cardMeta.icon}
 </div>
 <h1 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">
 {cardMeta.title}
 </h1>
 <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${cardMeta.badgeBg} shrink-0`}>
 {newLeadsInView.length > 0
 ? `${toBengaliNumerals(newLeadsInView.length)} নতুন · ${selectedMonth ? 'এই মাসে' : 'মোট'} ${toBengaliNumerals(filteredList.length)}`
 : `${selectedMonth ? 'এই মাসে' : 'মোট'} ${toBengaliNumerals(filteredList.length)}`}
 </span>
 </div>
 </div>

 <div className="flex items-center gap-2">
 {newLeadsInView.length >= 1 && (
 <button
 type="button"
 onClick={() => setIsMarkSeenModalOpen(true)}
 className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer shrink-0"
 >
 <CheckCircle2 className="h-3.5 w-3.5" />
 <span>সব দেখা হিসেবে চিহ্নিত করুন</span>
 </button>
 )}
 <div className="text-[11px] text-[var(--text-muted)] font-medium hidden md:block">
 ইউনিফাইড লিড ইনবক্স
 </div>
 </div>
 </div>

 {/* ================= MONTHLY CHIP NAVIGATION ================= */}
 {stats?.availableMonths && stats.availableMonths.length > 0 && (
 <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
  <button
  onClick={() => onMonthChange('')}
  className={`h-7 px-3 rounded-full text-[11px] font-bold border transition shrink-0 ${
   !selectedMonth
   ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
   : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-slate-300'
  }`}
  >
  সব মাস
  </button>
  {stats.availableMonths.map((m: any) => (
  <button
   key={m.key}
   onClick={() => onMonthChange(m.key)}
   className={`h-7 px-3 rounded-full text-[11px] font-bold border transition shrink-0 flex items-center gap-1.5 ${
   selectedMonth === m.key
    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-slate-300'
   }`}
  >
   <span>{m.label}</span>
   <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
   selectedMonth === m.key ? 'bg-white/20 text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
   }`}>
   {toBengaliNumerals(m.count)}
   </span>
  </button>
  ))}
 </div>
 )}

 {/* ================= MONTHLY SUMMARY STRIP ================= */}
 {selectedMonth && stats?.monthlyBreakdown?.[selectedMonth] && (
 <div className="flex h-12 items-center justify-between gap-4 px-4 rounded-xl border border-[var(--border)]/80 bg-[var(--bg-surface)] shadow-2xs overflow-hidden shrink-0">
  <div className="flex items-center gap-4 min-w-0">
  <div className="flex flex-col">
   <span className="text-[10px] font-bold text-[var(--text-muted)] leading-tight">মোট লিড</span>
   <span className="text-sm font-black text-[var(--text-primary)] leading-tight">
   {toBengaliNumerals(stats.monthlyBreakdown[selectedMonth].total)}টি
   </span>
  </div>
  
  <div className="h-6 w-px bg-[var(--border)]" />
  
  <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
   {Object.entries(stats.monthlyBreakdown[selectedMonth].sources).map(([src, count]) => {
   if ((count as number) === 0) return null;
   const color = (SOURCE_COLORS as any)[src] || 'var(--text-muted)';
   return (
    <div key={src} className="flex items-center gap-1.5 shrink-0">
    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
    <span className="text-[11px] font-bold text-[var(--text-secondary)]">
     {toBengaliNumerals(count as number)}
    </span>
    </div>
   );
   })}
  </div>
  </div>

  <div className="flex items-center gap-4 shrink-0">
  <div className="flex flex-col items-end">
   <span className="text-[10px] font-bold text-[var(--text-muted)] leading-tight text-right">কনফার্মড</span>
   <span className="text-sm font-black text-[var(--success)] leading-tight">
   {toBengaliNumerals(stats.monthlyBreakdown[selectedMonth].confirmed)}টি
   </span>
  </div>
  <div className="flex flex-col items-end">
   <span className="text-[10px] font-bold text-[var(--text-muted)] leading-tight text-right">মোট ভ্যালু</span>
   <span className="text-sm font-black text-[var(--accent)] leading-tight">
   ৳{toBengaliNumerals(Math.round(stats.monthlyBreakdown[selectedMonth].totalValue))}
   </span>
  </div>
  </div>
 </div>
 )}

 {/* ================= COMPACT FILTER TOOLBAR WITH LIST / GRID TOGGLE ================= */}
 <div className="rounded-xl border border-[var(--border)]/80 bg-[var(--bg-surface)] px-3 py-2 shadow-2xs ">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
 {/* Left: Page & (if not source page) Source Dropdowns */}
 <div className="flex flex-wrap items-center gap-2.5">
 {/* 1. Page Filter Dropdown */}
 <div className="flex items-center gap-1.5">
 <span className="text-xs font-bold text-[var(--text-secondary)] whitespace-nowrap">
 পেজ:
 </span>
 <select
 value={pageFilter}
 onChange={(e) => setPageFilter(e.target.value)}
 className="h-7.5 rounded-lg border border-[var(--border)] bg-[var(--bg-page)] px-2 py-0.5 text-xs font-semibold text-[var(--text-primary)] transition hover:border-slate-300 focus:border-blue-500 focus:bg-[var(--bg-surface)] focus:outline-hidden cursor-pointer min-w-[130px]"
 >
 <option value="all">
 সব পেজ ({toBengaliNumerals(cardLeads.length)})
 </option>
 {pageOptions.pages.map((p) => (
 <option key={p.key} value={p.key}>
 {p.name} ({toBengaliNumerals(p.count)})
 </option>
 ))}
 {pageOptions.noPageCount > 0 && (
 <option value="__no_page__">
 পেজ ছাড়া ({toBengaliNumerals(pageOptions.noPageCount)})
 </option>
 )}
 </select>
 </div>

 {/* 2. Source Filter Dropdown (Hidden on source-specific pages) */}
 {!isSourceCard && (
 <div className="flex items-center gap-1.5">
 <span className="text-xs font-bold text-[var(--text-secondary)] whitespace-nowrap">
 সোর্স:
 </span>
 <select
 value={sourceFilter}
 onChange={(e) => setSourceFilter(e.target.value)}
 className="h-7.5 rounded-lg border border-[var(--border)] bg-[var(--bg-page)] px-2 py-0.5 text-xs font-semibold text-[var(--text-primary)] transition hover:border-slate-300 focus:border-blue-500 focus:bg-[var(--bg-surface)] focus:outline-hidden cursor-pointer min-w-[125px]"
 >
 {sourceOptions.map((opt) => (
 <option key={opt.key} value={opt.key}>
 {opt.label} ({toBengaliNumerals(opt.count)})
 </option>
 ))}
 </select>
 </div>
 )}

 {/* Reset button if any filter is active */}
 {(pageFilter !== 'all' || (!isSourceCard && sourceFilter !== 'all') || dateRangeFilter !== 'all') && (
 <button
 onClick={() => {
 setPageFilter('all');
 setSourceFilter('all');
 setDateRangeFilter('all');
 setCustomStart('');
 setCustomEnd('');
 }}
 className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer ml-1"
 >
 ফিল্টার রিসেট
 </button>
 )}
 </div>

 {/* Right: Date Range Filter Dropdown + List/Grid View Switcher */}
 <div className="flex flex-wrap items-center gap-2 md:justify-end self-start md:self-auto">
 <span className="text-xs font-bold text-[var(--text-secondary)] whitespace-nowrap">
 সময়:
 </span>
 <select
 value={dateRangeFilter}
 onChange={(e) => setDateRangeFilter(e.target.value as any)}
 className="h-7.5 rounded-lg border border-[var(--border)] bg-[var(--bg-page)] px-2 py-0.5 text-xs font-semibold text-[var(--text-primary)] transition hover:border-slate-300 focus:border-blue-500 focus:bg-[var(--bg-surface)] focus:outline-hidden cursor-pointer min-w-[115px]"
 >
 <option value="all">সব সময়</option>
 <option value="today">আজ</option>
 <option value="yesterday">গতকাল</option>
 <option value="last7days">গত ৭ দিন</option>
 <option value="last30days">গত ৩০ দিন</option>
 <option value="thisMonth">এই মাস</option>
 <option value="custom">কাস্টম রেঞ্জ</option>
 </select>

 {/* Custom Date Pickers */}
 {dateRangeFilter === 'custom' && (
 <div className="flex items-center gap-1.5 bg-[var(--bg-elevated)]/90 p-1 rounded-lg">
 <input
 type="date"
 value={customStart}
 onChange={(e) => setCustomStart(e.target.value)}
 className="h-6 rounded border border-[var(--border)] bg-[var(--bg-surface)] px-1.5 text-xs text-[var(--text-primary)] "
 title="শুরু তারিখ"
 />
 <span className="text-xs text-[var(--text-muted)]">থেকে</span>
 <input
 type="date"
 value={customEnd}
 onChange={(e) => setCustomEnd(e.target.value)}
 className="h-6 rounded border border-[var(--border)] bg-[var(--bg-surface)] px-1.5 text-xs text-[var(--text-primary)] "
 title="শেষ তারিখ"
 />
 </div>
 )}

 {/* List / Grid View Toggle Button */}
 <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/80 p-0.5 shrink-0 ml-1">
 <button
 type="button"
 onClick={() => setViewMode('list')}
 className={`p-1.5 rounded-md transition cursor-pointer ${
 viewMode === 'list'
 ? 'bg-[var(--bg-surface)] shadow-2xs text-[var(--accent)] font-bold'
 : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
 }`}
 title="লিস্ট ভিউ (তালিকা)"
 aria-label="লিস্ট ভিউ"
 >
 <List className="h-4 w-4" />
 </button>
 <button
 type="button"
 onClick={() => setViewMode('grid')}
 className={`p-1.5 rounded-md transition cursor-pointer ${
 viewMode === 'grid'
 ? 'bg-[var(--bg-surface)] shadow-2xs text-[var(--accent)] font-bold'
 : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
 }`}
 title="গ্রিড ভিউ (কার্ড)"
 aria-label="গ্রিড ভিউ"
 >
 <LayoutGrid className="h-4 w-4" />
 </button>
 </div>
 </div>
 </div>
 </div>

 {/* ================= MAIN CONTENT (EMPTY / LIST TABLE / RESPONSIVE GRID) ================= */}
 <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)] shadow-2xs overflow-hidden min-h-[calc(100vh-210px)]">
 {filteredList.length === 0 ? (
 <div className="flex flex-col items-center justify-center p-14 text-center">
 <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-muted)] mb-2.5">
 <Filter className="h-5 w-5" />
 </div>
 <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] ">
 এই ফিল্টারে কোনো লিড নেই
 </h3>
 <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-sm">
 নির্বাচিত পেজ, সোর্স অথবা সময়সীমার মধ্যে কোনো লিড পাওয়া যায়নি। ফিল্টার পরিবর্তন করে দেখতে পারেন।
 </p>
 {(pageFilter !== 'all' || (!isSourceCard && sourceFilter !== 'all') || dateRangeFilter !== 'all') && (
 <button
 onClick={() => {
 setPageFilter('all');
 setSourceFilter('all');
 setDateRangeFilter('all');
 setCustomStart('');
 setCustomEnd('');
 }}
 className="mt-3.5 rounded-xl bg-[var(--accent)] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition cursor-pointer"
 >
 সব লিড দেখান
 </button>
 )}
 </div>
 ) : viewMode === 'list' ? (
 /* ================= LIST VIEW (DENSE HIGH-CAPACITY TABLE) ================= */
 <>
 {/* Desktop & Tablet Table with Sticky Header */}
 <div className="hidden sm:block overflow-x-auto max-h-[calc(100vh-210px)]">
 <table className="w-full min-w-[700px] border-collapse text-left">
 <thead className="sticky top-0 z-20 bg-[var(--bg-subtle)] border-b border-[var(--border)] shadow-2xs">
 <tr className="text-xs font-bold text-[var(--text-secondary)] ">
 <th className="py-2.5 pl-3.5 pr-1 w-9 shrink-0">★</th>
 <th className="py-2.5 px-3 w-[22%] min-w-[180px] whitespace-nowrap">নাম ও যোগাযোগ</th>
 <th className="py-2.5 px-3 w-[15%] min-w-[130px] whitespace-nowrap">সোর্স ও পেজ</th>
 <th className="py-2.5 px-3 w-[15%] min-w-[130px] whitespace-nowrap">ফলো-আপ তারিখ</th>
 <th className="py-2.5 pr-3.5 pl-3 min-w-[260px]">{messageColumnTitle}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 ">
 {displayList.map((lead) => {
 const channel = resolveMessageChannel(lead.lastChannel, lead);
 const isComment = channel === 'comment';
 const rawFollowUp = lead.followUpDate || lead.nextFollowUpDate;
 const statusInfo = getFollowUpStatusInfo(rawFollowUp, lead.status);
 const commentInfo = getLeadCommentAndMessageInfo(lead);

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
 : 'text-slate-300 hover:text-[var(--text-secondary)] '
 }`}
 title={lead.isStarred ? 'তারকা চিহ্নিত' : 'তারকা চিহ্নিত করুন'}
 >
 <Star className={`h-4 w-4 ${lead.isStarred ? 'fill-current' : ''}`} />
 </button>
 </td>

 {/* Name & Contact (Dense & readable) */}
 <td className="py-2.5 px-3 min-w-[180px] align-top">
 <div className="flex items-center gap-1.5 flex-wrap">
  {isLeadNew(lead, currentUser?.uid) && (
  <span className="inline-flex items-center gap-1 shrink-0">
  <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" title="নতুন লিড" />
 <span className="inline-flex items-center rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
 নতুন
 </span>
 </span>
 )}
 <div className="text-[15px] font-bold text-[var(--text-primary)] leading-tight truncate max-w-[200px]" title={lead.name}>
 {lead.name}
 </div>
 </div>
 {lead.phone && lead.phone.trim() ? (
 <div className="text-[13px] font-mono font-bold text-[var(--text-primary)] tabular-nums mt-0.5 tracking-tight">
 {formatBdPhoneNumber(lead.phone)}
 </div>
 ) : null}
 <div className="text-[12px] font-medium text-[var(--text-secondary)] mt-0.5 leading-normal">
 {formatFullBanglaDateTimeWithRelative(lead.createdAt)}
 </div>
 </td>

 {/* Source & Page */}
 <td className="py-2.5 px-3 min-w-[130px] whitespace-nowrap align-top">
 <div className="flex flex-col items-start gap-1">
 {effectiveSource === 'facebook' ? (
 <SourceBadge source="facebook" size="sm" />
 ) : effectiveSource === 'messenger' ? (
 <SourceBadge source="messenger" size="sm" />
 ) : effectiveSource !== 'all' ? (
 <SourceBadge source={effectiveSource} size="sm" />
 ) : (
 <SourceBadge source={lead.source} sources={lead.sources} size="sm" />
 )}

 {(lead.pageName || lead.pageId) && (
 <PageBadge pageName={lead.pageName} pageId={lead.pageId} size="sm" />
 )}
 </div>
 </td>

 {/* Follow-up Date */}
 <td
 className="py-2.5 px-3 min-w-[130px] whitespace-nowrap align-top"
 onClick={(e) => {
 e.stopPropagation();
 setFollowUpModalLead(lead);
 }}
 >
 <button
 type="button"
 className="group/fu flex flex-col items-start gap-1 rounded-lg px-2 py-1 -mx-1.5 transition hover:bg-[var(--accent-soft)] text-left cursor-pointer"
 title="ফলো-আপ তারিখ পরিবর্তন করতে ক্লিক করুন"
 >
 {rawFollowUp ? (
 <>
 <div className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--text-primary)] group-hover/fu:text-[var(--accent)] transition-colors">
 <Calendar className="h-3.5 w-3.5 text-blue-500 shrink-0" />
 <span>{formatBanglaFollowUpDateTime(rawFollowUp)}</span>
 </div>
 {statusInfo.type !== 'none' && (
 <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${statusInfo.badgeClass}`}>
 {statusInfo.label}
 </span>
 )}
 </>
 ) : (
 <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] group-hover/fu:text-[var(--accent)] transition-colors">
 <Calendar className="h-3 w-3 text-[var(--text-muted)] group-hover/fu" />
 <span className="underline decoration-dotted decoration-slate-400 ">
 তারিখ সেট নেই
 </span>
 </div>
 )}
 </button>
 </td>

 {/* Latest Message / Comment Column (Line-clamp-2 for high density) */}
 {effectiveSource === 'facebook' ? (
 <td className="py-2.5 pr-3.5 pl-3 min-w-[260px] align-top">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <ChannelBadge channel="comment" size="sm" />
 {commentInfo.commentTime && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(commentInfo.commentTime)}
 </span>
 )}
 </div>
 {(() => {
 const cleanComment = stripUrlsFromText(commentInfo.commentText);
 return (
 <div
 className={`text-[13.5px] leading-[1.4] line-clamp-2 break-words ${
 cleanComment
 ? 'text-[var(--text-primary)] font-normal'
 : 'italic text-[var(--text-muted)] '
 }`}
 title={cleanComment || 'কমেন্ট তথ্য নেই'}
 >
 {cleanComment || 'কমেন্ট তথ্য নেই'}
 </div>
 );
 })()}
 {(commentInfo.commentUrl || lead.lastPostLink) && (
 <a
 href={commentInfo.commentUrl || lead.lastPostLink}
 target="_blank"
 rel="noopener noreferrer"
 onClick={(e) => e.stopPropagation()}
 className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--accent)] hover:underline mt-1"
 >
 <span>পোস্ট দেখুন</span>
 <ExternalLink className="h-3 w-3" />
 </a>
 )}
 </td>
 ) : effectiveSource === 'messenger' ? (
 <td className="py-2.5 pr-3.5 pl-3 min-w-[260px] align-top">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <ChannelBadge channel="messenger" size="sm" />
 {commentInfo.messageTime && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(commentInfo.messageTime)}
 </span>
 )}
 </div>
 {(() => {
 const rawMsg = commentInfo.messageText || lead.lastMessage || lead.message;
 const cleanMsg = stripUrlsFromText(rawMsg);
 return (
 <div
 className="text-[13.5px] leading-[1.4] font-normal text-[var(--text-primary)] line-clamp-2 break-words"
 title={cleanMsg || '—'}
 >
 {cleanMsg || '—'}
 </div>
 );
 })()}
 </td>
 ) : effectiveSource !== 'all' ? (
 <td className="py-2.5 pr-3.5 pl-3 min-w-[260px] align-top">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <ChannelBadge channel={effectiveSource} size="sm" />
 {lead.lastMessageAt && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(lead.lastMessageAt)}
 </span>
 )}
 </div>
 {(() => {
 const rawMsg = lead.lastMessage || lead.message;
 const cleanMsg = stripUrlsFromText(rawMsg);
 return (
 <div
 className="text-[13.5px] leading-[1.4] font-normal text-[var(--text-primary)] line-clamp-2 break-words"
 title={cleanMsg || '—'}
 >
 {cleanMsg || '—'}
 </div>
 );
 })()}
 </td>
 ) : commentInfo.isMergedFacebookMessenger ? (
 /* All sources: Merged Facebook + Messenger */
 <td className="py-2.5 pr-3.5 pl-3 min-w-[260px] space-y-1.5 align-top">
 {/* Line 1: Comment */}
 <div>
 <div className="flex items-center gap-2 flex-wrap">
 <ChannelBadge channel="comment" size="sm" />
 {commentInfo.commentTime && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(commentInfo.commentTime)}
 </span>
 )}
 {(commentInfo.commentUrl || lead.lastPostLink) && (
 <a
 href={commentInfo.commentUrl || lead.lastPostLink}
 target="_blank"
 rel="noopener noreferrer"
 onClick={(e) => e.stopPropagation()}
 className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--accent)] hover:underline ml-auto"
 >
 <span>পোস্ট দেখুন</span>
 <ExternalLink className="h-3 w-3" />
 </a>
 )}
 </div>
 {(() => {
 const cleanComment = stripUrlsFromText(commentInfo.commentText);
 return (
 <div
 className={`text-[13px] leading-[1.4] line-clamp-1 break-words mt-0.5 ${
 cleanComment
 ? 'text-[var(--text-primary)] font-normal'
 : 'italic text-[var(--text-muted)] '
 }`}
 title={cleanComment || 'কমেন্ট তথ্য নেই'}
 >
 {cleanComment || 'কমেন্ট তথ্য নেই'}
 </div>
 );
 })()}
 </div>

 {/* Line 2: Messenger */}
 <div className="pt-1 border-t border-slate-100 ">
 <div className="flex items-center gap-2 flex-wrap">
 <ChannelBadge channel="messenger" size="sm" />
 {commentInfo.messageTime && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(commentInfo.messageTime)}
 </span>
 )}
 </div>
 {(() => {
 const rawMsg = commentInfo.messageText || lead.lastMessage || lead.message;
 const cleanMsg = stripUrlsFromText(rawMsg);
 return (
 <div
 className="text-[13px] leading-[1.4] font-normal text-[var(--text-primary)] line-clamp-1 break-words mt-0.5"
 title={cleanMsg || '—'}
 >
 {cleanMsg || '—'}
 </div>
 );
 })()}
 </div>
 </td>
 ) : (
 /* All sources: Single interaction */
 <td className="py-2.5 pr-3.5 pl-3 min-w-[260px] align-top">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 {channel && <ChannelBadge channel={channel} size="sm" />}
 {commentInfo.hasComment && channel === 'messenger' && (
 <span
 className="inline-flex items-center text-[11px] font-bold rounded-md px-1.5 py-0.2 bg-[var(--badge-amber-bg)] text-[var(--badge-amber-text)] border border-[var(--badge-amber-border)] "
 title="এই গ্রাহক ফেসবুক কমেন্টও করেছেন"
 >
 💬 কমেন্ট আছে
 </span>
 )}
 {(lead.lastMessageAt || lead.createdAt) && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(lead.lastMessageAt || lead.createdAt)}
 </span>
 )}
 </div>
 {(() => {
 const rawMsg = lead.lastMessage || lead.message;
 const cleanMsg = stripUrlsFromText(rawMsg);
 return (
 <div
 className="text-[13.5px] leading-[1.4] font-normal text-[var(--text-primary)] line-clamp-2 break-words"
 title={cleanMsg || '—'}
 >
 {cleanMsg || '—'}
 </div>
 );
 })()}
 {isComment && (commentInfo.commentUrl || lead.lastPostLink) && (
 <a
 href={commentInfo.commentUrl || lead.lastPostLink}
 target="_blank"
 rel="noopener noreferrer"
 onClick={(e) => e.stopPropagation()}
 className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--accent)] hover:underline mt-1"
 >
 <span>পোস্ট দেখুন</span>
 <ExternalLink className="h-3 w-3" />
 </a>
 )}
 </td>
 )}
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>

 {/* Mobile Compact List View (sm:hidden) */}
 <div className="block sm:hidden divide-y divide-slate-100 ">
 {displayList.map((lead) => {
 const channel = resolveMessageChannel(lead.lastChannel, lead);
 const isComment = channel === 'comment';
 const rawFollowUp = lead.followUpDate || lead.nextFollowUpDate;
 const statusInfo = getFollowUpStatusInfo(rawFollowUp, lead.status);
 const commentInfo = getLeadCommentAndMessageInfo(lead);

 return (
 <div
 key={lead.id}
 onClick={() => onSelectLead(lead)}
 className="p-3 transition-colors hover:bg-[var(--accent-soft)]/50 active:bg-blue-100/40 cursor-pointer space-y-2"
 >
 {/* Header Row: Star, Name & Source Badge */}
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
 : 'text-slate-300 hover:text-[var(--text-secondary)] '
 }`}
 title={lead.isStarred ? 'তারকা চিহ্নিত' : 'তারকা চিহ্নিত করুন'}
 >
 <Star className={`h-4 w-4 ${lead.isStarred ? 'fill-current' : ''}`} />
 </button>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-1.5 flex-wrap">
 {isLeadNew(lead, currentUser?.uid) && (
 <span className="inline-flex items-center gap-1 shrink-0">
 <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" title="নতুন লিড" />
 <span className="inline-flex items-center rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
 নতুন
 </span>
 </span>
 )}
 <h4 className="text-[15px] font-bold text-[var(--text-primary)] leading-tight truncate">
 {lead.name}
 </h4>
 </div>
 {lead.phone && lead.phone.trim() ? (
 <div className="text-[13px] font-mono font-bold text-[var(--text-primary)] tabular-nums mt-0.5">
 {formatBdPhoneNumber(lead.phone)}
 </div>
 ) : null}
 <div className="text-[12px] font-medium text-[var(--text-secondary)] mt-0.5">
 {formatFullBanglaDateTimeWithRelative(lead.createdAt)}
 </div>
 </div>
 </div>

 {/* Source & Page Badges */}
 <div className="flex flex-col items-end gap-1 shrink-0">
 {effectiveSource === 'facebook' ? (
 <SourceBadge source="facebook" size="sm" />
 ) : effectiveSource === 'messenger' ? (
 <SourceBadge source="messenger" size="sm" />
 ) : effectiveSource !== 'all' ? (
 <SourceBadge source={effectiveSource} size="sm" />
 ) : (
 <SourceBadge source={lead.source} sources={lead.sources} size="sm" />
 )}

 {(lead.pageName || lead.pageId) && (
 <PageBadge pageName={lead.pageName} pageId={lead.pageId} size="sm" />
 )}
 </div>
 </div>

 {/* Follow-up & Modal trigger */}
 <div className="flex items-center justify-between gap-2 text-xs flex-wrap pt-1 border-t border-slate-100 ">
 <div
 onClick={(e) => {
 e.stopPropagation();
 setFollowUpModalLead(lead);
 }}
 >
 {rawFollowUp ? (
 <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-bold text-[var(--accent)] ">
 <Calendar className="h-3 w-3 text-blue-500" />
 <span>{formatBanglaFollowUpDateTime(rawFollowUp)}</span>
 {statusInfo.type !== 'none' && (
 <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${statusInfo.badgeClass}`}>
 {statusInfo.label}
 </span>
 )}
 </div>
 ) : (
 <span className="text-xs text-[var(--text-muted)] underline decoration-dotted">
 ফলো-আপ সেট নেই
 </span>
 )}
 </div>
 </div>

 {/* Message / Comment Preview */}
 <div className="rounded-lg bg-[var(--bg-page)] p-2.5 border border-[var(--border)]/70 ">
 {effectiveSource === 'facebook' ? (
 <div>
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <ChannelBadge channel="comment" size="sm" />
 {commentInfo.commentTime && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(commentInfo.commentTime)}
 </span>
 )}
 </div>
 {(() => {
 const cleanComment = stripUrlsFromText(commentInfo.commentText);
 return (
 <p className={`text-[13.5px] leading-[1.4] line-clamp-2 break-words ${cleanComment ? 'text-[var(--text-primary)] font-normal' : 'italic text-[var(--text-muted)] '}`}>
 {cleanComment || 'কমেন্ট তথ্য নেই'}
 </p>
 );
 })()}
 {(commentInfo.commentUrl || lead.lastPostLink) && (
 <a
 href={commentInfo.commentUrl || lead.lastPostLink}
 target="_blank"
 rel="noopener noreferrer"
 onClick={(e) => e.stopPropagation()}
 className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--accent)] hover:underline mt-1"
 >
 <span>পোস্ট দেখুন</span>
 <ExternalLink className="h-3 w-3" />
 </a>
 )}
 </div>
 ) : effectiveSource === 'messenger' ? (
 <div>
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <ChannelBadge channel="messenger" size="sm" />
 {commentInfo.messageTime && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(commentInfo.messageTime)}
 </span>
 )}
 </div>
 {(() => {
 const rawMsg = commentInfo.messageText || lead.lastMessage || lead.message;
 const cleanMsg = stripUrlsFromText(rawMsg);
 return (
 <p className="text-[13.5px] leading-[1.4] font-normal text-[var(--text-primary)] line-clamp-2 break-words">
 {cleanMsg || '—'}
 </p>
 );
 })()}
 </div>
 ) : effectiveSource !== 'all' ? (
 <div>
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <ChannelBadge channel={effectiveSource} size="sm" />
 {lead.lastMessageAt && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(lead.lastMessageAt)}
 </span>
 )}
 </div>
 {(() => {
 const rawMsg = lead.lastMessage || lead.message;
 const cleanMsg = stripUrlsFromText(rawMsg);
 return (
 <p className="text-[13.5px] leading-[1.4] font-normal text-[var(--text-primary)] line-clamp-2 break-words">
 {cleanMsg || '—'}
 </p>
 );
 })()}
 </div>
 ) : commentInfo.isMergedFacebookMessenger ? (
 <div className="space-y-1.5">
 <div>
 <div className="flex items-center gap-2 flex-wrap">
 <ChannelBadge channel="comment" size="sm" />
 {commentInfo.commentTime && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(commentInfo.commentTime)}
 </span>
 )}
 {(commentInfo.commentUrl || lead.lastPostLink) && (
 <a
 href={commentInfo.commentUrl || lead.lastPostLink}
 target="_blank"
 rel="noopener noreferrer"
 onClick={(e) => e.stopPropagation()}
 className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--accent)] hover:underline ml-auto"
 >
 <span>পোস্ট দেখুন</span>
 <ExternalLink className="h-3 w-3" />
 </a>
 )}
 </div>
 {(() => {
 const cleanComment = stripUrlsFromText(commentInfo.commentText);
 return (
 <p className={`text-[13px] leading-[1.4] line-clamp-1 break-words mt-0.5 ${cleanComment ? 'text-[var(--text-primary)] font-normal' : 'italic text-[var(--text-muted)] '}`}>
 {cleanComment || 'কমেন্ট তথ্য নেই'}
 </p>
 );
 })()}
 </div>
 <div className="pt-1 border-t border-[var(--border)]/80 ">
 <div className="flex items-center gap-2 flex-wrap">
 <ChannelBadge channel="messenger" size="sm" />
 {commentInfo.messageTime && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(commentInfo.messageTime)}
 </span>
 )}
 </div>
 {(() => {
 const rawMsg = commentInfo.messageText || lead.lastMessage || lead.message;
 const cleanMsg = stripUrlsFromText(rawMsg);
 return (
 <p className="text-[13px] leading-[1.4] font-normal text-[var(--text-primary)] line-clamp-1 break-words mt-0.5">
 {cleanMsg || '—'}
 </p>
 );
 })()}
 </div>
 </div>
 ) : (
 <div>
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 {channel && <ChannelBadge channel={channel} size="sm" />}
 {commentInfo.hasComment && channel === 'messenger' && (
 <span
 className="inline-flex items-center text-[11px] font-bold rounded-md px-1.5 py-0.2 bg-[var(--badge-amber-bg)] text-[var(--badge-amber-text)] border border-[var(--badge-amber-border)] "
 title="এই গ্রাহক ফেসবুক কমেন্টও করেছেন"
 >
 💬 কমেন্ট আছে
 </span>
 )}
 {(lead.lastMessageAt || lead.createdAt) && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(lead.lastMessageAt || lead.createdAt)}
 </span>
 )}
 </div>
 {(() => {
 const rawMsg = lead.lastMessage || lead.message;
 const cleanMsg = stripUrlsFromText(rawMsg);
 return (
 <p className="text-[13.5px] leading-[1.4] font-normal text-[var(--text-primary)] line-clamp-2 break-words">
 {cleanMsg || '—'}
 </p>
 );
 })()}
 {isComment && (commentInfo.commentUrl || lead.lastPostLink) && (
 <a
 href={commentInfo.commentUrl || lead.lastPostLink}
 target="_blank"
 rel="noopener noreferrer"
 onClick={(e) => e.stopPropagation()}
 className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--accent)] hover:underline mt-1"
 >
 <span>পোস্ট দেখুন</span>
 <ExternalLink className="h-3 w-3" />
 </a>
 )}
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </>
 ) : (
 /* ================= GRID VIEW (3 COLS DESKTOP, 2 COLS TABLET, 1 COL MOBILE) ================= */
 <div className="p-3 sm:p-4 max-h-[calc(100vh-210px)] overflow-y-auto">
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
 {displayList.map((lead) => {
 const channel = resolveMessageChannel(lead.lastChannel, lead);
 const isComment = channel === 'comment';
 const rawFollowUp = lead.followUpDate || lead.nextFollowUpDate;
 const statusInfo = getFollowUpStatusInfo(rawFollowUp, lead.status);
 const commentInfo = getLeadCommentAndMessageInfo(lead);

 return (
 <div
 key={lead.id}
 onClick={() => onSelectLead(lead)}
 className="group relative flex flex-col justify-between rounded-xl border border-[var(--border)]/80 bg-[var(--bg-surface)] p-3.5 shadow-2xs hover:border-blue-400 hover:shadow-md :border-blue-500 transition cursor-pointer"
 >
 <div>
 {/* Top Row: Star + Name & Phone + Source & Page Badges */}
 <div className="flex items-start justify-between gap-2">
 <div className="flex items-start gap-1.5 min-w-0 flex-1">
 <button
 onClick={(e) => {
 e.stopPropagation();
 onToggleStar(lead.id);
 }}
 className={`p-1 -ml-1 rounded-md hover:bg-[var(--bg-elevated)] transition shrink-0 ${
 lead.isStarred
 ? 'text-amber-500 hover:text-amber-600'
 : 'text-slate-300 hover:text-[var(--text-secondary)] '
 }`}
 title={lead.isStarred ? 'তারকা চিহ্নিত' : 'তারকা চিহ্নিত করুন'}
 >
 <Star className={`h-4 w-4 ${lead.isStarred ? 'fill-current' : ''}`} />
 </button>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-1.5 flex-wrap">
 {isLeadNew(lead, currentUser?.uid) && (
 <span className="inline-flex items-center gap-1 shrink-0">
 <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" title="নতুন লিড" />
 <span className="inline-flex items-center rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
 নতুন
 </span>
 </span>
 )}
 <h4
 className="text-[15px] font-bold text-[var(--text-primary)] leading-tight truncate"
 title={lead.name}
 >
 {lead.name}
 </h4>
 </div>
 {lead.phone && lead.phone.trim() ? (
 <div className="text-[13px] font-mono font-bold text-[var(--text-primary)] tabular-nums mt-0.5">
 {formatBdPhoneNumber(lead.phone)}
 </div>
 ) : null}
 </div>
 </div>

 {/* Source & Page Badges */}
 <div className="flex flex-col items-end gap-1 shrink-0">
 {effectiveSource === 'facebook' ? (
 <SourceBadge source="facebook" size="sm" />
 ) : effectiveSource === 'messenger' ? (
 <SourceBadge source="messenger" size="sm" />
 ) : effectiveSource !== 'all' ? (
 <SourceBadge source={effectiveSource} size="sm" />
 ) : (
 <SourceBadge source={lead.source} sources={lead.sources} size="sm" />
 )}
 {(lead.pageName || lead.pageId) && (
 <PageBadge pageName={lead.pageName} pageId={lead.pageId} size="sm" />
 )}
 </div>
 </div>

 {/* Follow-up Date Row with clickable modal */}
 <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
 <div
 onClick={(e) => {
 e.stopPropagation();
 setFollowUpModalLead(lead);
 }}
 className="cursor-pointer"
 >
 {rawFollowUp ? (
 <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-bold text-[var(--accent)] ">
 <Calendar className="h-3 w-3 text-blue-500 shrink-0" />
 <span className="truncate">{formatBanglaFollowUpDateTime(rawFollowUp)}</span>
 {statusInfo.type !== 'none' && (
 <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${statusInfo.badgeClass}`}>
 {statusInfo.label}
 </span>
 )}
 </div>
 ) : (
 <span className="text-[11.5px] text-[var(--text-muted)] underline decoration-dotted">
 ফলো-আপ সেট নেই
 </span>
 )}
 </div>

 <div className="text-[11.5px] font-medium text-[var(--text-secondary)] shrink-0">
 {formatFullBanglaDateTimeWithRelative(lead.createdAt)}
 </div>
 </div>

 {/* Snippet box (comment or message) with line-clamp-2 */}
 <div className="mt-2 rounded-lg bg-[var(--bg-page)] p-2.5 border border-[var(--border)]/70 ">
 {effectiveSource === 'facebook' ? (
 <div>
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <ChannelBadge channel="comment" size="sm" />
 {commentInfo.commentTime && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(commentInfo.commentTime)}
 </span>
 )}
 </div>
 {(() => {
 const cleanComment = stripUrlsFromText(commentInfo.commentText);
 return (
 <p
 className={`text-[13px] leading-[1.4] line-clamp-2 break-words ${
 cleanComment
 ? 'text-[var(--text-primary)] font-normal'
 : 'italic text-[var(--text-muted)] '
 }`}
 title={cleanComment || 'কমেন্ট তথ্য নেই'}
 >
 {cleanComment || 'কমেন্ট তথ্য নেই'}
 </p>
 );
 })()}
 {(commentInfo.commentUrl || lead.lastPostLink) && (
 <a
 href={commentInfo.commentUrl || lead.lastPostLink}
 target="_blank"
 rel="noopener noreferrer"
 onClick={(e) => e.stopPropagation()}
 className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--accent)] hover:underline mt-1"
 >
 <span>পোস্ট দেখুন</span>
 <ExternalLink className="h-3 w-3" />
 </a>
 )}
 </div>
 ) : effectiveSource === 'messenger' ? (
 <div>
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <ChannelBadge channel="messenger" size="sm" />
 {commentInfo.messageTime && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(commentInfo.messageTime)}
 </span>
 )}
 </div>
 {(() => {
 const rawMsg = commentInfo.messageText || lead.lastMessage || lead.message;
 const cleanMsg = stripUrlsFromText(rawMsg);
 return (
 <p
 className="text-[13px] leading-[1.4] font-normal text-[var(--text-primary)] line-clamp-2 break-words"
 title={cleanMsg || '—'}
 >
 {cleanMsg || '—'}
 </p>
 );
 })()}
 </div>
 ) : effectiveSource !== 'all' ? (
 <div>
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <ChannelBadge channel={effectiveSource} size="sm" />
 {lead.lastMessageAt && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(lead.lastMessageAt)}
 </span>
 )}
 </div>
 {(() => {
 const rawMsg = lead.lastMessage || lead.message;
 const cleanMsg = stripUrlsFromText(rawMsg);
 return (
 <p
 className="text-[13px] leading-[1.4] font-normal text-[var(--text-primary)] line-clamp-2 break-words"
 title={cleanMsg || '—'}
 >
 {cleanMsg || '—'}
 </p>
 );
 })()}
 </div>
 ) : commentInfo.isMergedFacebookMessenger ? (
 <div className="space-y-1.5">
 <div>
 <div className="flex items-center gap-2 flex-wrap">
 <ChannelBadge channel="comment" size="sm" />
 {commentInfo.commentTime && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(commentInfo.commentTime)}
 </span>
 )}
 {(commentInfo.commentUrl || lead.lastPostLink) && (
 <a
 href={commentInfo.commentUrl || lead.lastPostLink}
 target="_blank"
 rel="noopener noreferrer"
 onClick={(e) => e.stopPropagation()}
 className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--accent)] hover:underline ml-auto"
 >
 <span>পোস্ট দেখুন</span>
 <ExternalLink className="h-3 w-3" />
 </a>
 )}
 </div>
 {(() => {
 const cleanComment = stripUrlsFromText(commentInfo.commentText);
 return (
 <p
 className={`text-[12.5px] leading-[1.4] line-clamp-1 break-words mt-0.5 ${
 cleanComment
 ? 'text-[var(--text-primary)] font-normal'
 : 'italic text-[var(--text-muted)] '
 }`}
 title={cleanComment || 'কমেন্ট তথ্য নেই'}
 >
 {cleanComment || 'কমেন্ট তথ্য নেই'}
 </p>
 );
 })()}
 </div>
 <div className="pt-1 border-t border-[var(--border)]/80 ">
 <div className="flex items-center gap-2 flex-wrap">
 <ChannelBadge channel="messenger" size="sm" />
 {commentInfo.messageTime && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(commentInfo.messageTime)}
 </span>
 )}
 </div>
 {(() => {
 const rawMsg = commentInfo.messageText || lead.lastMessage || lead.message;
 const cleanMsg = stripUrlsFromText(rawMsg);
 return (
 <p
 className="text-[12.5px] leading-[1.4] font-normal text-[var(--text-primary)] line-clamp-1 break-words mt-0.5"
 title={cleanMsg || '—'}
 >
 {cleanMsg || '—'}
 </p>
 );
 })()}
 </div>
 </div>
 ) : (
 <div>
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 {channel && <ChannelBadge channel={channel} size="sm" />}
 {commentInfo.hasComment && channel === 'messenger' && (
 <span
 className="inline-flex items-center text-[11px] font-bold rounded-md px-1.5 py-0.2 bg-[var(--badge-amber-bg)] text-[var(--badge-amber-text)] border border-[var(--badge-amber-border)] "
 title="এই গ্রাহক ফেসবুক কমেন্টও করেছেন"
 >
 💬 কমেন্ট আছে
 </span>
 )}
 {(lead.lastMessageAt || lead.createdAt) && (
 <span className="text-[12px] font-medium text-[var(--text-secondary)] ">
 {formatBanglaRelativeTime(lead.lastMessageAt || lead.createdAt)}
 </span>
 )}
 </div>
 {(() => {
 const rawMsg = lead.lastMessage || lead.message;
 const cleanMsg = stripUrlsFromText(rawMsg);
 return (
 <p
 className="text-[13px] leading-[1.4] font-normal text-[var(--text-primary)] line-clamp-2 break-words"
 title={cleanMsg || '—'}
 >
 {cleanMsg || '—'}
 </p>
 );
 })()}
 {isComment && (commentInfo.commentUrl || lead.lastPostLink) && (
 <a
 href={commentInfo.commentUrl || lead.lastPostLink}
 target="_blank"
 rel="noopener noreferrer"
 onClick={(e) => e.stopPropagation()}
 className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--accent)] hover:underline mt-1"
 >
 <span>পোস্ট দেখুন</span>
 <ExternalLink className="h-3 w-3" />
 </a>
 )}
 </div>
 )}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}
 </div>

 {/* Follow-up date picker modal if triggered */}
 {followUpModalLead && (
 <FollowUpDatePickerModal
 isOpen={Boolean(followUpModalLead)}
 lead={followUpModalLead}
 onClose={() => setFollowUpModalLead(null)}
 onSave={async (leadId, newDate) => {
 await onUpdateFollowUpDate(leadId, newDate);
 setFollowUpModalLead(null);
 }}
 />
 )}

 {/* Mark all new leads as seen modal */}
 {isMarkSeenModalOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
 <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-2xl text-[var(--text-primary)] animate-in zoom-in-95 duration-150">
 <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">
 দেখা হয়েছে হিসেবে চিহ্নিতকরণ
 </h3>
 <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
 {toBengaliNumerals(newLeadsInView.length)}টি লিড দেখা হয়েছে হিসেবে চিহ্নিত হবে।
 </p>
 <div className="flex justify-end gap-2">
 <button
 type="button"
 onClick={() => setIsMarkSeenModalOpen(false)}
 className="rounded-lg px-3.5 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
 >
 বাতিল
 </button>
 <button
 type="button"
 onClick={async () => {
 const ids = newLeadsInView.map((l) => l.id);
 await leadService.markLeadsAsSeen(ids);
 setIsMarkSeenModalOpen(false);
 }}
 className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer"
 >
 হাঁ, চিহ্নিত করুন
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};
