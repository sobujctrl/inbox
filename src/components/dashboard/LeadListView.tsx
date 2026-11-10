import React, { useState } from 'react';
import {
 Search,
 LayoutGrid,
 List,
 Filter,
 Phone,
 MessageSquare,
 Clock,
 Tag,
 Star,
 ChevronRight,
 UserCheck,
 Calendar,
 AlertCircle,
 X,
 ExternalLink,
} from 'lucide-react';
import { Lead, LeadSource, LeadStatus } from '../../types/lead';
import { FirestoreErrorPayload, FirestoreDebugInfo, getDhakaDateString, leadMatchesSource } from '../../services/leadService';
import { SourceBadge, FacebookIcon, MessengerIcon, WhatsAppIcon, WebsiteIcon, ManualIcon } from '../common/SourceBadge';
import { StatusBadge } from '../common/StatusBadge';
import { ChannelBadge, resolveMessageChannel } from '../common/ChannelBadge';
import { PageBadge } from '../common/PageBadge';
import {
 formatBanglaDateTime,
 formatBanglaDateOnly,
 formatBanglaFollowUpDateTime,
 formatFullBanglaDateTimeWithRelative,
 getFollowUpStatusInfo,
 formatTaka,
 toBengaliNumerals,
 STATUS_LABELS,
 PRESET_TAGS,
 TEAM_MEMBERS,
} from '../../utils/formatters';
import { formatBdPhoneNumber, getWhatsAppLink, getPhoneCallLink } from '../../utils/phone';
import { FollowUpDatePickerModal } from '../modals/FollowUpDatePickerModal';

interface LeadListViewProps {
 leads: Lead[];
 allActiveLeads: Lead[];
 pageLeads: Lead[];
 pageFilter: string;
 onPageFilterChange: (page: string) => void;
 onSelectLead: (lead: Lead) => void;
 onQuickStatusChange: (leadId: string, status: LeadStatus) => void;
 onToggleStar: (leadId: string) => void;
 sourceFilter: string;
 onSourceFilterChange: (source: string) => void;
 searchQuery: string;
 onSearchChange: (query: string) => void;
 onOpenAddModal: () => void;
 isFollowUpFilterActive: boolean;
 onToggleFollowUpFilter: () => void;
 isTodayNewFilterActive: boolean;
 onToggleTodayNewFilter: () => void;
 statusFilter: 'all' | LeadStatus;
 onStatusFilterChange: (status: 'all' | LeadStatus) => void;
 dateRangeFilter: 'all' | 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';
 onDateRangeFilterChange: (range: 'all' | 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom') => void;
 customDateRange: { start: string; end: string };
 onCustomDateRangeChange: (range: { start: string; end: string }) => void;
 followUpDateFilter: 'all' | 'today' | 'tomorrow' | 'thisWeek' | 'overdue' | 'noDate';
 onFollowUpDateFilterChange: (filter: 'all' | 'today' | 'tomorrow' | 'thisWeek' | 'overdue' | 'noDate') => void;
 onUpdateFollowUpDate: (leadId: string, newFollowUpDate: string | null) => Promise<void> | void;
 firestoreError?: FirestoreErrorPayload | null;
 onRetryFirestore?: () => void;
 firestoreDebug?: FirestoreDebugInfo | null;
}

export const LeadListView: React.FC<LeadListViewProps> = ({
 leads,
 allActiveLeads,
 pageLeads,
 pageFilter,
 onPageFilterChange,
 onSelectLead,
 onQuickStatusChange,
 onToggleStar,
 sourceFilter,
 onSourceFilterChange,
 searchQuery,
 onSearchChange,
 onOpenAddModal,
 isFollowUpFilterActive,
 onToggleFollowUpFilter,
 isTodayNewFilterActive,
 onToggleTodayNewFilter,
 statusFilter,
 onStatusFilterChange,
 dateRangeFilter,
 onDateRangeFilterChange,
 customDateRange,
 onCustomDateRangeChange,
 followUpDateFilter,
 onFollowUpDateFilterChange,
 onUpdateFollowUpDate,
 firestoreError,
 onRetryFirestore,
 firestoreDebug,
}) => {
 const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
 const [tagFilter, setTagFilter] = useState<string>('all');
 const [assignedFilter, setAssignedFilter] = useState<string>('all');
 const [postFilter, setPostFilter] = useState<string>('all');
 const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'value'>('newest');
 const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
 const [followUpModalLead, setFollowUpModalLead] = useState<Lead | null>(null);
 
 // Compute unique posts for filter dropdown and lead counts
 const postMap: Record<string, { count: number; link?: string }> = {};
 leads.forEach((l) => {
 if (l.lastPostId) {
 if (!postMap[l.lastPostId]) {
 postMap[l.lastPostId] = { count: 0, link: l.lastPostLink };
 }
 postMap[l.lastPostId].count++;
 }
 });
 const uniquePosts = Object.entries(postMap).map(([postId, data]) => ({
 postId,
 count: data.count,
 link: data.link,
 }));

 // Canonical ID to Name mapping from allActiveLeads
 const idToNameMap: Record<string, string> = {};
 allActiveLeads.forEach((l) => {
 if (l.pageId?.trim() && l.pageName?.trim()) {
 idToNameMap[l.pageId.trim()] = l.pageName.trim();
 }
 });

 // Compute unique pages and leads without page for dropdown and counts
 const pageMap: Record<string, { count: number; name: string }> = {};
 let noPageCount = 0;

 allActiveLeads.forEach((l) => {
 const pName = l.pageName?.trim();
 const pId = l.pageId?.trim();
 if (pName) {
 if (!pageMap[pName]) {
 pageMap[pName] = { count: 0, name: pName };
 }
 pageMap[pName].count++;
 } else if (pId) {
 const canonicalName = idToNameMap[pId] || `Page (${pId})`;
 const key = idToNameMap[pId] || pId;
 if (!pageMap[key]) {
 pageMap[key] = { count: 0, name: canonicalName };
 }
 pageMap[key].count++;
 } else {
 noPageCount++;
 }
 });

 const uniquePages = Object.entries(pageMap).map(([pageKey, data]) => ({
 pageKey,
 name: data.name,
 count: data.count,
 }));


 // Base leads for status tabs within current page and source
 const statusBaseLeads = React.useMemo(() => {
 return pageLeads.filter((lead) => {
 if (sourceFilter !== 'all') {
 const sources = Array.isArray(lead.sources) && lead.sources.length > 0 ? lead.sources : [lead.source || 'facebook'];
 const matchesSource = sources.includes(sourceFilter as LeadSource) || lead.source === sourceFilter;
 if (!matchesSource) return false;
 }
 return true;
 });
 }, [pageLeads, sourceFilter]);

 const filteredLeads = leads;

 const clearAllFilters = () => {
 onSourceFilterChange('all');
 onSearchChange('');
 onStatusFilterChange('all');
 setTagFilter('all');
 setAssignedFilter('all');
 setPostFilter('all');
 onPageFilterChange('all');
 onDateRangeFilterChange('all');
 onCustomDateRangeChange({ start: '', end: '' });
 onFollowUpDateFilterChange('all');
 if (isFollowUpFilterActive) {
 onToggleFollowUpFilter();
 }
 if (isTodayNewFilterActive) {
 onToggleTodayNewFilter();
 }
 };

 const hasActiveFilters =
 sourceFilter !== 'all' ||
 searchQuery.trim() !== '' ||
 statusFilter !== 'all' ||
 tagFilter !== 'all' ||
 assignedFilter !== 'all' ||
 postFilter !== 'all' ||
 pageFilter !== 'all' ||
 dateRangeFilter !== 'all' ||
 followUpDateFilter !== 'all' ||
 isFollowUpFilterActive ||
 isTodayNewFilterActive;

 return (
 <div className="space-y-4">
 {/* Top Filter Bar: Status Tabs & Controls */}
 <div className="rounded-xl border border-[var(--border)]/80 bg-[var(--bg-surface)] p-3 shadow-2xs space-y-3">
 {/* Row 1: Status Tabs */}
 <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
 <span className="text-[11px] font-bold text-[var(--text-secondary)] shrink-0 uppercase tracking-wider">স্ট্যাটাস</span>
 <div className="flex items-center gap-1">
 {[
 { id: 'all', label: 'সব স্ট্যাটাস', color: 'bg-[var(--bg-page)]0' },
 { id: 'new', label: 'নতুন', color: 'bg-[var(--accent)]' },
 { id: 'contacted', label: 'যোগাযোগ করা হয়েছে', color: 'bg-violet-600' },
 { id: 'followup', label: 'ফলো-আপ', color: 'bg-amber-600' },
 { id: 'won', label: 'কাস্টমার হয়েছে', color: 'bg-emerald-600' },
 { id: 'cancelled', label: 'ক্যান্সেল', color: 'bg-rose-800' },
 { id: 'hold', label: 'হোল্ড', color: 'bg-slate-600' },
 ].map((status) => {
 const isActive = statusFilter === status.id;
 const count = status.id === 'all' 
 ? statusBaseLeads.length 
 : statusBaseLeads.filter(l => l.status === status.id).length;
 
 return (
 <button
 key={status.id}
 onClick={() => onStatusFilterChange(status.id as any)}
 className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
 isActive
 ? 'bg-[var(--accent)] text-white shadow-xs '
 : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
 }`}
 >
 {status.id !== 'all' && <span className={`h-1.5 w-1.5 rounded-full ${status.color}`} />}
 <span>{status.label}</span>
 <span
 className={`rounded-md px-1 py-0 text-[10px] tabular-nums font-bold ${
 isActive
 ? 'bg-[var(--bg-surface)]/20 text-white '
 : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] '
 }`}
 >
 {toBengaliNumerals(count)}
 </span>
 </button>
 );
 })}
 </div>
 </div>

 {/* Row 3: Dropdowns & Controls */}
 <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 ">
 <div className="flex flex-wrap gap-2 flex-1">
 <select
 value={pageFilter}
 onChange={(e) => onPageFilterChange(e.target.value)}
 className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-blue-500"
 >
 <option value="all">সব পেজ ({toBengaliNumerals(allActiveLeads.length)})</option>
 {uniquePages.map((p) => (
 <option key={p.pageKey} value={p.pageKey}>
 {p.name} ({toBengaliNumerals(p.count)})
 </option>
 ))}
 <option value="no_page">পেজ ছাড়া ({toBengaliNumerals(noPageCount)})</option>
 </select>

 <select
 value={dateRangeFilter}
 onChange={(e) => onDateRangeFilterChange(e.target.value as any)}
 className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-blue-500"
 >
 <option value="all">সব সময়</option>
 <option value="today">আজ</option>
 <option value="yesterday">গতকাল</option>
 <option value="last7days">গত ৭ দিন</option>
 <option value="last30days">গত ৩০ দিন</option>
 <option value="thisMonth">এই মাস</option>
 <option value="lastMonth">গত মাস</option>
 <option value="custom">কাস্টম তারিখ</option>
 </select>

 <select
 value={followUpDateFilter}
 onChange={(e) => onFollowUpDateFilterChange(e.target.value as any)}
 className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-blue-500"
 >
 <option value="all">সব ফলো-আপ</option>
 <option value="today">আজ</option>
 <option value="tomorrow">আগামীকাল</option>
 <option value="thisWeek">এই সপ্তাহ</option>
 <option value="overdue">ওভারডিউ</option>
 <option value="noDate">তারিখ সেট নেই</option>
 </select>

 <button
 onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
 className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
 showAdvancedFilters || hasActiveFilters
 ? 'border-blue-300 bg-[var(--accent-soft)] text-[var(--accent)] '
 : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-page)] '
 }`}
 >
 <Filter className="h-3.5 w-3.5" />
 <span>ফিল্টার</span>
 </button>
 
 {/* Custom Date Range */}
 {dateRangeFilter === 'custom' && (
 <div className="flex items-center gap-1.5">
 <input
 type="date"
 value={customDateRange.start}
 onChange={(e) => onCustomDateRangeChange({ ...customDateRange, start: e.target.value })}
 className="rounded-lg border border-[var(--border)] p-1 text-xs "
 />
 <span className="text-xs text-[var(--text-secondary)]">থেকে</span>
 <input
 type="date"
 value={customDateRange.end}
 onChange={(e) => onCustomDateRangeChange({ ...customDateRange, end: e.target.value })}
 className="rounded-lg border border-[var(--border)] p-1 text-xs "
 />
 </div>
 )}
 </div>

 {/* View Toggle */}
 <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/70 p-0.5 shrink-0">
 <button
 onClick={() => setViewMode('table')}
 className={`rounded-md p-1.5 transition ${viewMode === 'table' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs ' : 'text-[var(--text-secondary)]'}`}
 title="টেবিল ভিউ"
 >
 <List className="h-4 w-4" />
 </button>
 <button
 onClick={() => setViewMode('card')}
 className={`rounded-md p-1.5 transition ${viewMode === 'card' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs ' : 'text-[var(--text-secondary)]'}`}
 title="কার্ড ভিউ"
 >
 <LayoutGrid className="h-4 w-4" />
 </button>
 </div>
 </div>
 </div>

 {/* Advanced Filter Collapsible Bar */}
 {showAdvancedFilters && (
 <div className="rounded-xl border border-[var(--border)]/80 bg-[var(--bg-page)]/70 p-3.5 ">
 <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2.5 ">
 <span className="text-xs font-bold text-[var(--text-primary)] ">
 বিস্তারিত ফিল্টার ও সাজানো
 </span>
 {hasActiveFilters && (
 <button
 onClick={clearAllFilters}
 className="flex items-center gap-1 text-xs text-[var(--danger)] hover:underline "
 >
 <X className="h-3 w-3" />
 <span>সব ফিল্টার মুছুন</span>
 </button>
 )}
 </div>

 <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
 {/* Status Filter */}
 <div>
 <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)] ">
 স্ট্যাটাস
 </label>
 <select
 value={statusFilter}
 onChange={(e) => onStatusFilterChange(e.target.value as any)}
 className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 >
 <option value="all">সব স্ট্যাটাস</option>
 <option value="new">নতুন</option>
 <option value="contacted">যোগাযোগ করা হয়েছে</option>
 <option value="followup">ফলো-আপ</option>
 <option value="won">কাস্টমার হয়েছে</option>
 <option value="cancelled">ক্যান্সেল</option>
 <option value="hold">হোল্ড</option>
 </select>
 </div>

 {/* Tag Filter */}
 <div>
 <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)] ">
 ট্যাগ
 </label>
 <select
 value={tagFilter}
 onChange={(e) => setTagFilter(e.target.value)}
 className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 >
 <option value="all">সব ট্যাগ</option>
 {PRESET_TAGS.map((t) => (
 <option key={t} value={t}>
 {t}
 </option>
 ))}
 </select>
 </div>

 {/* Assigned To */}
 <div>
 <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)] ">
 অ্যাসাইন করা সদস্য
 </label>
 <select
 value={assignedFilter}
 onChange={(e) => setAssignedFilter(e.target.value)}
 className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 >
 <option value="all">সব সদস্য</option>
 <option value="unassigned">অ্যাসাইন করা হয়নি</option>
 {TEAM_MEMBERS.map((m) => (
 <option key={m} value={m}>
 {m}
 </option>
 ))}
 </select>
 </div>

 {/* Post Filter */}
 <div>
 <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)] ">
 ফেসবুক পোস্ট
 </label>
 <select
 value={postFilter}
 onChange={(e) => setPostFilter(e.target.value)}
 className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 >
 <option value="all">সব পোস্ট</option>
 {uniquePosts.map((p) => (
 <option key={p.postId} value={p.postId}>
 {p.postId} ({toBengaliNumerals(p.count)} টি লিড)
 </option>
 ))}
 </select>
 </div>

 {/* Page Filter in Advanced Grid */}
 <div>
 <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)] ">
 ফেসবুক পেজ
 </label>
 <select
 value={pageFilter}
 onChange={(e) => onPageFilterChange(e.target.value)}
 className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 >
 <option value="all">সব পেজ ({toBengaliNumerals(allActiveLeads.length)})</option>
 {uniquePages.map((p) => (
 <option key={p.pageKey} value={p.pageKey}>
 {p.name} ({toBengaliNumerals(p.count)} টি লিড)
 </option>
 ))}
 <option value="no_page">পেজ ছাড়া ({toBengaliNumerals(noPageCount)} টি লিড)</option>
 </select>
 </div>

 {/* Sort Order */}
 <div>
 <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)] ">
 সাজানোর ক্রম
 </label>
 <select
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value as any)}
 className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 >
 <option value="newest">নতুন আগে</option>
 <option value="oldest">পুরনো আগে</option>
 <option value="name">নাম অনুসারে (ক-হ)</option>
 <option value="value">মূল্য (সর্বোচ্চ আগে)</option>
 </select>
 </div>
 </div>
 </div>
 )}

 {/* Active Filter summary pill line */}
 <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)] px-1">
 <div className="flex items-center gap-2 flex-wrap">
 <div>
 মোট প্রদর্শিত লিড:{' '}
 <span className="font-bold text-[var(--text-primary)] tabular-nums">
 {toBengaliNumerals(filteredLeads.length)}
 </span>{' '}
 টি
 </div>
 {pageFilter !== 'all' && (
 <span className="inline-flex items-center gap-1 rounded-full bg-[var(--badge-indigo-bg)] border border-[var(--badge-indigo-border)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--badge-indigo-text)] ">
 পেজ: {pageFilter === 'no_page' ? 'পেজ ছাড়া' : (pageMap[pageFilter]?.name || pageFilter)}
 <button
 onClick={() => onPageFilterChange('all')}
 className="hover:text-indigo-900 :text-white cursor-pointer"
 title="পেজ ফিল্টার বাতিল করুন"
 >
 <X className="h-3 w-3" />
 </button>
 </span>
 )}
 {dateRangeFilter !== 'all' && (
 <span className="inline-flex items-center gap-1 rounded-full bg-[var(--badge-blue-bg)] border border-[var(--badge-blue-border)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--badge-blue-text)] ">
 তৈরি: {
 dateRangeFilter === 'today' ? 'আজ' :
 dateRangeFilter === 'yesterday' ? 'গতকাল' :
 dateRangeFilter === 'last7days' ? 'গত ৭ দিন' :
 dateRangeFilter === 'last30days' ? 'গত ৩০ দিন' :
 dateRangeFilter === 'thisMonth' ? 'এই মাস' :
 dateRangeFilter === 'lastMonth' ? 'গত মাস' : 'কাস্টম'
 }
 <button
 onClick={() => onDateRangeFilterChange('all')}
 className="hover :text-white cursor-pointer"
 title="তারিখ ফিল্টার বাতিল করুন"
 >
 <X className="h-3 w-3" />
 </button>
 </span>
 )}
 {followUpDateFilter !== 'all' && (
 <span className="inline-flex items-center gap-1 rounded-full bg-[var(--badge-amber-bg)] border border-[var(--badge-amber-border)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--badge-amber-text)] ">
 ফলো-আপ: {
 followUpDateFilter === 'today' ? 'আজ' :
 followUpDateFilter === 'tomorrow' ? 'আগামীকাল' :
 followUpDateFilter === 'thisWeek' ? 'এই সপ্তাহ' :
 followUpDateFilter === 'overdue' ? 'ওভারডিউ' :
 followUpDateFilter === 'noDate' ? 'তারিখ সেট নেই' : followUpDateFilter
 }
 <button
 onClick={() => onFollowUpDateFilterChange('all')}
 className="hover:text-amber-900 :text-white cursor-pointer"
 title="ফলো-আপ ফিল্টার বাতিল করুন"
 >
 <X className="h-3 w-3" />
 </button>
 </span>
 )}
 {isFollowUpFilterActive && (
 <span className="inline-flex items-center gap-1 rounded-full bg-[var(--badge-amber-bg)] border border-[var(--badge-amber-border)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--badge-amber-text)] ">
 আজকের ফলো-আপ
 <button
 onClick={onToggleFollowUpFilter}
 className="hover:text-amber-900 :text-white cursor-pointer"
 title="বাতিল করুন"
 >
 <X className="h-3 w-3" />
 </button>
 </span>
 )}
 {isTodayNewFilterActive && (
 <span className="inline-flex items-center gap-1 rounded-full bg-[var(--badge-green-bg)] border border-[var(--badge-green-border)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--badge-green-text)] ">
 আজকের নতুন
 <button
 onClick={onToggleTodayNewFilter}
 className="hover:text-emerald-900 :text-white cursor-pointer"
 title="বাতিল করুন"
 >
 <X className="h-3 w-3" />
 </button>
 </span>
 )}
 {statusFilter !== 'all' && (
 <span className="inline-flex items-center gap-1 rounded-full bg-[var(--badge-indigo-bg)] border border-[var(--badge-indigo-border)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--badge-indigo-text)] ">
 স্ট্যাটাস: {STATUS_LABELS[statusFilter] || statusFilter}
 <button
 onClick={() => onStatusFilterChange('all')}
 className="hover:text-purple-900 :text-white cursor-pointer"
 title="স্ট্যাটাস ফিল্টার বাতিল করুন"
 >
 <X className="h-3 w-3" />
 </button>
 </span>
 )}
 {sourceFilter !== 'all' && (
 <span className="inline-flex items-center gap-1 rounded-full bg-[var(--badge-gray-bg)] border border-[var(--badge-gray-border)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--badge-gray-text)] ">
 সোর্স: {sourceFilter}
 <button
 onClick={() => onSourceFilterChange('all')}
 className="hover:text-[var(--text-primary)] :text-white cursor-pointer"
 title="সোর্স ফিল্টার বাতিল করুন"
 >
 <X className="h-3 w-3" />
 </button>
 </span>
 )}
 {hasActiveFilters && (
 <button
 onClick={clearAllFilters}
 className="text-[11px] text-[var(--accent)] hover:underline font-medium cursor-pointer ml-1"
 >
 সব ফিল্টার সাফ করুন
 </button>
 )}
 </div>
 {searchQuery && (
 <div className="text-xs">
 "<span>{searchQuery}</span>" খোঁজার ফলাফল
 </div>
 )}
 </div>

 {/* Requirement 4: Real-time Debug Line & Status when document count is 0 or error occurs */}
 {(firestoreError || leads.length === 0) && (
 <div className="rounded-xl border border-amber-300/80 bg-[var(--warning-bg)]/95 p-3.5 text-xs text-amber-950 shadow-xs ">
 <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2 ">
 <div className="flex items-center gap-2">
 <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-200/90 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-900 ">
 <span className="h-2 w-2 rounded-full bg-amber-600 animate-pulse"></span>
 Firestore ডায়াগনস্টিক তথ্য (Debug Trace)
 </span>
 <span className="text-[11px] font-medium text-[var(--warning)] ">
 {firestoreError ? 'কানেকশন ত্রুটি' : (leads.length === 0 ? '০ লিড ডিবাগিং' : 'কানেকশন সক্রিয়')}
 </span>
 </div>
 <div className="flex items-center gap-2 text-[11px]">
 {firestoreDebug?.lastUpdated && (
 <span className="text-[var(--text-secondary)] ">
 আপডেট: {firestoreDebug.lastUpdated}
 </span>
 )}
 {onRetryFirestore && (
 <button
 onClick={onRetryFirestore}
 className="rounded bg-amber-200 hover:bg-amber-300 px-2.5 py-1 text-[11px] font-bold text-amber-900 shadow-2xs transition :bg-amber-700 "
 >
 পুনরায় লোড
 </button>
 )}
 </div>
 </div>

 {/* The 4 explicit debug fields requested in requirement 4 */}
 <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 font-mono text-[11px]">
 <div className="rounded-lg bg-[var(--bg-surface)]/90 p-2.5 border border-amber-200/60 ">
 <span className="text-[10px] uppercase font-sans font-bold text-[var(--text-secondary)] block">
 ১. ইউজার আইডি (UID):
 </span>
 <span className="font-bold select-all break-all text-[var(--text-primary)] ">
 {firestoreDebug?.uid || 'লগইন করা নেই'}
 </span>
 </div>

 <div className="rounded-lg bg-[var(--bg-surface)]/90 p-2.5 border border-amber-200/60 ">
 <span className="text-[10px] uppercase font-sans font-bold text-[var(--text-secondary)] block">
 ২. কালেকশন পাথ (Path):
 </span>
 <span className="font-bold select-all break-all text-[var(--accent)] ">
 {firestoreDebug?.path || 'sharedLeads'}
 </span>
 </div>

 <div className="rounded-lg bg-[var(--bg-surface)]/90 p-2.5 border border-amber-200/60 ">
 <span className="text-[10px] uppercase font-sans font-bold text-[var(--text-secondary)] block">
 ৩. প্রাপ্ত ডকুমেন্ট সংখ্যা (Count):
 </span>
 <span className={`font-bold ${leads.length > 0 ? 'text-[var(--success)] ' : 'text-[var(--warning)] '}`}>
 {toBengaliNumerals(firestoreDebug?.docCount ?? leads.length)} টি ({firestoreDebug?.docCount ?? leads.length} docs)
 </span>
 </div>

 <div className="rounded-lg bg-[var(--bg-surface)]/90 p-2.5 border border-amber-200/60 ">
 <span className="text-[10px] uppercase font-sans font-bold text-[var(--text-secondary)] block">
 ৪. ডেটাবেস ও এরর স্ট্যাটাস:
 </span>
 <span className="font-bold break-all">
 {firestoreError || firestoreDebug?.errorMessage ? (
 <span className="text-[var(--danger)] ">
 ত্রুটি: [{firestoreError?.code || firestoreDebug?.errorCode}] {firestoreError?.details || firestoreDebug?.errorMessage}
 </span>
 ) : (
 <span className="text-[var(--success)] ">
 কোনো ত্রুটি নেই ({firestoreDebug?.databaseId || 'সংযুক্ত'})
 </span>
 )}
 </span>
 </div>
 </div>

 {/* Note for n8n */}
 <div className="mt-2.5 text-[11px] text-amber-900 flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-amber-200/40 ">
 <span>
 💡 Firestore ডেটাবেস: <strong className="font-mono">{firestoreDebug?.databaseId || 'ai-studio-unifiedleadinbox-0b829395-84c1-4d8f-be98-a6a6c0d8634d'}</strong> | কালেকশন পাথ: <strong className="font-mono">{firestoreDebug?.path || 'sharedLeads'}</strong>
 </span>
 <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
 <span className="h-1.5 w-1.5 rounded-full bg-[var(--success-bg)]0"></span>
 ডেটাবেস সক্রিয়
 </span>
 </div>
 </div>
 )}

 {/* Main Content: Table or Card View */}
 {filteredLeads.length === 0 ? (
 /* Empty State */
 <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-[var(--bg-surface)] p-12 text-center ">
 <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)] ">
 <AlertCircle className="h-7 w-7" />
 </div>
 <h3 className="mt-4 text-base font-bold text-[var(--text-primary)] ">
 কোনো লিড পাওয়া যায়নি
 </h3>
 <p className="mt-1 max-w-sm text-xs text-[var(--text-secondary)] ">
 {hasActiveFilters
 ? 'আপনার নির্বাচিত ফিল্টার বা সার্চ কোয়েরির সাথে কোনো লিড মিলছে না। ফিল্টার পরিবর্তন করে দেখুন।'
 : 'বর্তমানে ইনবক্সে কোনো লিড নেই। নতুন লিড যোগ করতে বা ইমপোর্ট করতে নিচের বাটনে চাপ দিন।'}
 </p>
 <div className="mt-5 flex gap-2">
 {hasActiveFilters ? (
 <button
 onClick={clearAllFilters}
 className="rounded-lg bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover "
 >
 ফিল্টার রিসেট করুন
 </button>
 ) : (
 <button
 onClick={onOpenAddModal}
 className="rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
 >
 নতুন লিড যোগ করুন
 </button>
 )}
 </div>
 </div>
 ) : viewMode === 'table' ? (
 /* TABLE VIEW */
 <div className="rounded-xl border border-[var(--border)]/80 bg-[var(--bg-surface)] shadow-2xs overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full min-w-[980px] border-collapse text-left text-xs">
 <thead className="sticky top-0 z-20 shadow-2xs">
 <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)] text-[11px] font-bold text-[var(--text-secondary)] ">
 <th className="py-3 pl-4 pr-1 w-8 shrink-0">★</th>
 <th className="py-3 px-3 min-w-[190px] whitespace-nowrap">নাম ও ফোন নম্বর</th>
 <th className="py-3 px-3 min-w-[140px] whitespace-nowrap">সোর্স ও পেজ</th>
 <th className="py-3 px-3 min-w-[130px] max-w-[160px]">প্রোডাক্ট / সার্ভিস</th>
 <th className="py-3 px-3 min-w-[130px] whitespace-nowrap">স্ট্যাটাস</th>
 <th className="py-3 px-3 min-w-[100px] whitespace-nowrap">ফলো-আপ</th>
 <th className="py-3 px-3 max-w-[130px]">সর্বশেষ মেসেজ</th>
 <th className="py-3 px-3 min-w-[90px] whitespace-nowrap">অ্যাসাইন</th>
 <th className="py-3 pr-4 pl-2 text-right min-w-[110px] whitespace-nowrap">অ্যাকশন</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 ">
 {filteredLeads.map((lead) => {
 const isMerged = lead.sources && lead.sources.length > 1;
            const primarySource = lead.source || "manual";
            const sourceColorClass =
              primarySource === "facebook" || primarySource === "messenger" ? "border-l-[3px] border-l-[var(--badge-teal-text)]/60" :
              primarySource === "website" ? "border-l-[3px] border-l-[var(--badge-pink-text)]/60" :
              primarySource === "whatsapp" ? "border-l-[3px] border-l-[var(--badge-green-text)]/60" :
              "border-l-[3px] border-l-[var(--badge-gray-text)]/60";
 return (
 <tr
 key={lead.id}
 onClick={() => onSelectLead(lead)}
                className={`group cursor-pointer transition-colors hover:bg-[var(--accent-soft)]/40 ${sourceColorClass}`}
 >
 {/* Star */}
 <td
 className="py-3 pl-4 pr-1 w-8 shrink-0"
 onClick={(e) => {
 e.stopPropagation();
 onToggleStar(lead.id);
 }}
 >
 <button
 className={`p-1 rounded-sm ${
 lead.isStarred
 ? 'text-amber-500 hover:text-amber-600'
 : 'text-slate-300 hover:text-[var(--text-secondary)] '
 }`}
 >
 <Star className={`h-3.5 w-3.5 ${lead.isStarred ? 'fill-current' : ''}`} />
 </button>
 </td>

 {/* Name & Phone */}
 <td className="py-3 px-3 min-w-[190px]">
 {(() => {
 const isUnread = lead.lastMessageAt && (!lead.lastSeenAt || new Date(lead.lastMessageAt).getTime() > new Date(lead.lastSeenAt).getTime());
 return (
 <div className="font-bold text-[var(--text-primary)] whitespace-nowrap flex items-center gap-1.5">
 <span>{lead.name}</span>
 {isUnread && (
 <span className="inline-flex items-center rounded-full bg-[var(--danger-bg)] px-2 py-0.2 text-[10px] font-bold text-[var(--danger)] animate-pulse">
 নতুন মেসেজ
 </span>
 )}
 </div>
 );
 })()}
 {lead.phone && lead.phone.trim() ? (
 <div className="text-[11px] font-mono text-[var(--text-secondary)] tabular-nums">
 {formatBdPhoneNumber(lead.phone)}
 </div>
 ) : (
 <span className="inline-flex items-center gap-1 mt-0.5 rounded-sm bg-[var(--warning-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--warning)] ">
 ফোন নেই
 </span>
 )}
 {lead.messengerId && (
 <div className="text-[10px] font-mono text-[var(--accent)] mt-0.5 truncate max-w-[170px]" title={`Messenger PSID: ${lead.messengerId}`}>
 ID: {lead.messengerId}
 </div>
 )}
 <div className="text-[10px] text-[var(--text-secondary)] mt-1">
 লিড এসেছে: {formatFullBanglaDateTimeWithRelative(lead.createdAt)}
 </div>
 </td>

 {/* Source & Page Badges */}
 <td className="py-3 px-3 min-w-[140px] whitespace-nowrap">
 <div className="flex flex-col items-start gap-1">
 <SourceBadge source={lead.source} sources={lead.sources} size="sm" />
 {(lead.pageName || lead.pageId) && (
 <PageBadge pageName={lead.pageName} pageId={lead.pageId} size="sm" />
 )}
 {isMerged && (
 <span className="block text-[10px] text-purple-600 font-medium">
 মার্জড লিড
 </span>
 )}
 </div>
 </td>

 {/* Product Interest */}
 <td className="py-3 px-3 min-w-[130px] max-w-[160px]">
 <div className="truncate font-medium text-[var(--text-primary)] " title={lead.productInterest}>
 {lead.productInterest}
 </div>
 {lead.tags.length > 0 && (
 <div className="flex flex-wrap gap-1 mt-1">
 {lead.tags.slice(0, 1).map((t) => (
 <span
 key={t}
 className="inline-block rounded-xs bg-[var(--bg-elevated)] px-1.5 py-0.2 text-[10px] text-[var(--text-secondary)] "
 >
 {t}
 </span>
 ))}
 {lead.tags.length > 1 && (
 <span className="text-[10px] text-[var(--text-muted)]">
 +{toBengaliNumerals(lead.tags.length - 1)}
 </span>
 )}
 </div>
 )}
 </td>

 {/* Status */}
 <td
 className="py-3 px-3 min-w-[130px] whitespace-nowrap"
 onClick={(e) => e.stopPropagation()}
 >
 <select
 value={lead.status}
 onChange={(e) => onQuickStatusChange(lead.id, e.target.value as LeadStatus)}
 className="rounded-md border border-transparent bg-[var(--bg-elevated)] py-1 pl-2 pr-6 text-[11px] font-medium text-[var(--text-primary)] transition hover:border-slate-300 focus:border-blue-500 focus:bg-[var(--bg-surface)] focus:outline-hidden "
 >
 <option value="new">নতুন</option>
 <option value="contacted">যোগাযোগ করা হয়েছে</option>
 <option value="followup">ফলো-আপ</option>
 <option value="won">কাস্টমার হয়েছে</option>
 <option value="lost">হারানো</option>
 </select>
 </td>

 {/* Next Follow Up (Requirement 1 & 2) */}
 <td
 className="py-3 px-3 min-w-[130px] whitespace-nowrap"
 onClick={(e) => {
 e.stopPropagation();
 setFollowUpModalLead(lead);
 }}
 >
 {(() => {
 const rawDate = lead.followUpDate || lead.nextFollowUpDate;
 const statusInfo = getFollowUpStatusInfo(rawDate, lead.status);
 return (
 <button
 type="button"
 className="group/fu flex flex-col items-start gap-1 rounded-lg px-2 py-1 -mx-2 transition hover:bg-[var(--accent-soft)] text-left cursor-pointer"
 title="ফলো-আপ তারিখ পরিবর্তন করতে ক্লিক করুন"
 >
 {rawDate ? (
 <>
 <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-primary)] group-hover/fu:text-[var(--accent)] transition-colors">
 <Calendar className="h-3 w-3 text-blue-500 shrink-0" />
 <span>{formatBanglaFollowUpDateTime(rawDate)}</span>
 </div>
 {statusInfo.type !== 'none' && (
 <span className={`rounded-md px-1.5 py-0.2 text-[10px] font-bold ${statusInfo.badgeClass}`}>
 {statusInfo.label}
 </span>
 )}
 </>
 ) : (
 <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] group-hover/fu:text-[var(--accent)] transition-colors">
 <Calendar className="h-3 w-3 text-[var(--text-muted)] group-hover/fu" />
 <span className="underline decoration-dotted decoration-slate-300 ">
 তারিখ সেট নেই
 </span>
 </div>
 )}
 </button>
 );
 })()}
 </td>

 {/* Message excerpt */}
 <td className="py-3 px-3 min-w-[170px] max-w-[220px]">
 {(() => {
 const channel = resolveMessageChannel(lead.lastChannel, lead);
 const isComment = channel === 'comment';
 return (
 <div>
 <div className="flex items-center gap-1.5 mb-1 flex-wrap">
 {channel && <ChannelBadge channel={channel} size="xs" />}
 {channel === 'messenger' && (lead.sources?.includes('facebook') || lead.source === 'facebook' || lead.lastComment) && (
 <span
 className="inline-flex items-center text-[10px] font-bold rounded px-1.5 py-0.2 bg-[var(--warning-bg)] text-[var(--warning)] border border-amber-200 "
 title="এই গ্রাহক ফেসবুক কমেন্টও করেছেন"
 >
 💬 কমেন্ট আছে
 </span>
 )}
 </div>
 <div className="truncate text-[var(--text-primary)] text-[11px]" title={lead.lastMessage || lead.message}>
 {lead.lastMessage || lead.message}
 </div>
 <div className="text-[10px] text-[var(--text-secondary)] mt-1 space-y-0.5">
 <div><strong>লিড এসেছে:</strong> {formatFullBanglaDateTimeWithRelative(lead.createdAt)}</div>
 <div><strong>সর্বশেষ মেসেজ:</strong> {formatFullBanglaDateTimeWithRelative(lead.lastMessageAt || lead.createdAt)}</div>
 </div>
 {/* Requirement 3: কমেন্টের মেসেজের নিচে "পোস্ট দেখুন" লিংক রাখো, আর Messenger মেসেজে ওই লিংক দেখিও না */}
 {isComment && lead.lastPostLink && (
 <a
 href={lead.lastPostLink}
 target="_blank"
 rel="noopener noreferrer"
 onClick={(e) => e.stopPropagation()}
 className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--accent)] hover:underline mt-1"
 >
 <span>পোস্ট দেখুন</span>
 <ExternalLink className="h-2.5 w-2.5" />
 </a>
 )}
 </div>
 );
 })()}
 </td>

 {/* Assigned member */}
 <td className="py-3 px-3 min-w-[90px] whitespace-nowrap">
 <span className="text-[11px] text-[var(--text-primary)] font-medium">
 {lead.assignedTo || '—'}
 </span>
 </td>

 {/* Action buttons (Messenger, WhatsApp, Call) */}
 <td
 className="py-3 pr-4 pl-2 text-right min-w-[120px] whitespace-nowrap"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center justify-end gap-1.5 shrink-0">
 {/* Messenger Reply button if messengerId is present */}
 {lead.messengerId && (
 <a
 href="https://business.facebook.com/latest/inbox/all"
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-[var(--accent-soft)] text-[#0084FF] hover:bg-blue-100 border border-[var(--border)]/70 text-[11px] font-bold transition shrink-0"
 title="Meta Business Suite Inbox-এ মেসেজের উত্তর দিন"
 >
 <MessengerIcon className="h-3.5 w-3.5 text-[#0084FF]" />
 <span className="hidden xl:inline">Messenger-এ উত্তর দিন</span>
 </a>
 )}

 {/* WhatsApp & Call buttons ONLY if phone exists */}
 {lead.phone && lead.phone.trim() ? (
 <>
 <a
 href={getWhatsAppLink(lead.phone, lead.name)}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--success-bg)] text-[var(--success)] hover:bg-emerald-100 transition shrink-0"
 title="WhatsApp-এ মেসেজ পাঠান"
 >
 <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366]" />
 </a>

 <a
 href={getPhoneCallLink(lead.phone)}
 className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-blue-100 transition shrink-0"
 title="কল করুন"
 >
 <Phone className="h-3.5 w-3.5" />
 </a>
 </>
 ) : null}

 {/* Details Drawer trigger */}
 <button
 onClick={() => onSelectLead(lead)}
 className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition shrink-0"
 title="বিস্তারিত দেখুন"
 >
 <ChevronRight className="h-4 w-4" />
 </button>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 ) : (
 /* CARD VIEW */
 <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
 {filteredLeads.map((lead) => {
 const isMerged = lead.sources && lead.sources.length > 1;
            const primarySource = lead.source || "manual";
            const sourceColorClass =
              primarySource === "facebook" || primarySource === "messenger" ? "border-l-[3px] border-l-[var(--badge-teal-text)]/60" :
              primarySource === "website" ? "border-l-[3px] border-l-[var(--badge-pink-text)]/60" :
              primarySource === "whatsapp" ? "border-l-[3px] border-l-[var(--badge-green-text)]/60" :
              "border-l-[3px] border-l-[var(--badge-gray-text)]/60";
 return (
 <div
 key={lead.id}
 onClick={() => onSelectLead(lead)}
 className="group relative flex flex-col justify-between rounded-xl border border-[var(--border)]/80 bg-[var(--bg-surface)] p-4 shadow-2xs transition-all hover:border-blue-400 hover:shadow-sm :border-blue-500 cursor-pointer"
 >
 {/* Card Top: Source Badge & Status */}
 <div>
 <div className="flex items-center justify-between gap-2 flex-wrap">
 <div className="flex items-center gap-1.5 flex-wrap">
 <SourceBadge source={lead.source} sources={lead.sources} size="sm" />
 {(lead.pageName || lead.pageId) && (
 <PageBadge pageName={lead.pageName} pageId={lead.pageId} size="sm" />
 )}
 </div>
 <StatusBadge status={lead.status} size="sm" />
 </div>

 {/* Name & Phone */}
 <div className="mt-3">
 <div className="flex items-center justify-between">
 {(() => {
 const isUnread = lead.lastMessageAt && (!lead.lastSeenAt || new Date(lead.lastMessageAt).getTime() > new Date(lead.lastSeenAt).getTime());
 return (
 <div className="flex items-center gap-1.5 flex-wrap">
 <h4 className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
 {lead.name}
 </h4>
 {isUnread && (
 <span className="inline-flex items-center rounded-full bg-[var(--danger-bg)] px-2 py-0.2 text-[10px] font-bold text-[var(--danger)] animate-pulse">
 নতুন মেসেজ
 </span>
 )}
 </div>
 );
 })()}
 <button
 onClick={(e) => {
 e.stopPropagation();
 onToggleStar(lead.id);
 }}
 className={`p-1 rounded-sm ${
 lead.isStarred
 ? 'text-amber-500'
 : 'text-slate-300 hover:text-[var(--text-secondary)] '
 }`}
 >
 <Star className={`h-3.5 w-3.5 ${lead.isStarred ? 'fill-current' : ''}`} />
 </button>
 </div>

 {lead.phone && lead.phone.trim() ? (
 <p className="font-mono text-xs text-[var(--text-secondary)] tabular-nums">
 {formatBdPhoneNumber(lead.phone)}
 </p>
 ) : (
 <span className="inline-flex items-center mt-1 rounded-sm bg-[var(--warning-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--warning)] ">
 ফোন নেই
 </span>
 )}

 {lead.messengerId && (
 <p className="text-[10px] font-mono text-[var(--accent)] mt-0.5">
 PSID: {lead.messengerId}
 </p>
 )}
 <div className="text-[10px] text-[var(--text-secondary)] mt-1">
 লিড এসেছে: {formatFullBanglaDateTimeWithRelative(lead.createdAt)}
 </div>
 </div>

 {/* Product & Note */}
 {(() => {
 const channel = resolveMessageChannel(lead.lastChannel);
 const isComment = channel === 'comment';
 return (
 <div className="mt-2.5 rounded-lg bg-[var(--bg-page)] p-2.5 ">
 <div className="flex items-center justify-between gap-1.5 mb-1">
 <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
 {lead.productInterest}
 </span>
 <div className="flex items-center gap-1">
 {channel && <ChannelBadge channel={channel} size="xs" />}
 {channel === 'messenger' && (lead.sources?.includes('facebook') || lead.source === 'facebook' || lead.lastComment) && (
 <span
 className="inline-flex items-center text-[10px] font-bold rounded px-1.5 py-0.2 bg-[var(--warning-bg)] text-[var(--warning)] border border-amber-200 "
 title="এই গ্রাহক ফেসবুক কমেন্টও করেছেন"
 >
 💬 কমেন্ট আছে
 </span>
 )}
 </div>
 </div>
 <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)] ">
 "{lead.lastMessage || lead.message}"
 </p>
 <div className="mt-1.5 text-[10px] text-[var(--text-secondary)] space-y-0.5">
 <div><strong>লিড এসেছে:</strong> {formatFullBanglaDateTimeWithRelative(lead.createdAt)}</div>
 <div><strong>সর্বশেষ মেসেজ:</strong> {formatFullBanglaDateTimeWithRelative(lead.lastMessageAt || lead.createdAt)}</div>
 </div>
 {/* Requirement 3: কমেন্টের মেসেজের নিচে "পোস্ট দেখুন" লিংক রাখো, আর Messenger মেসেজে ওই লিংক দেখিও না */}
 {isComment && lead.lastPostLink && (
 <div className="mt-1.5">
 <a
 href={lead.lastPostLink}
 target="_blank"
 rel="noopener noreferrer"
 onClick={(e) => e.stopPropagation()}
 className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] hover:underline "
 >
 <span>পোস্ট দেখুন</span>
 <ExternalLink className="h-3 w-3" />
 </a>
 </div>
 )}
 </div>
 );
 })()}

 {/* Tags */}
 {lead.tags.length > 0 && (
 <div className="mt-2.5 flex flex-wrap gap-1">
 {lead.tags.map((t) => (
 <span
 key={t}
 className="rounded-md bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] "
 >
 {t}
 </span>
 ))}
 </div>
 )}
 </div>

 {/* Follow-up Date Row */}
 <div className="mt-3 flex items-center justify-between rounded-lg bg-[var(--bg-page)] px-2.5 py-1.5 text-[11px] ">
 <span className="text-[var(--text-secondary)] font-medium">ফলো-আপ:</span>
 {(() => {
 const rawDate = lead.followUpDate || lead.nextFollowUpDate;
 const statusInfo = getFollowUpStatusInfo(rawDate, lead.status);
 return (
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 setFollowUpModalLead(lead);
 }}
 className="group/fu inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 hover:bg-[var(--bg-surface)] transition cursor-pointer text-left shadow-2xs"
 title="ফলো-আপ তারিখ পরিবর্তন করতে ক্লিক করুন"
 >
 <Calendar className="h-3 w-3 text-blue-500 shrink-0" />
 {rawDate ? (
 <>
 <span className="font-semibold text-[var(--text-primary)] group-hover/fu:text-[var(--accent)] transition-colors">
 {formatBanglaFollowUpDateTime(rawDate)}
 </span>
 {statusInfo.type !== 'none' && (
 <span className={`rounded-md px-1.5 py-0.2 text-[10px] font-bold ${statusInfo.badgeClass}`}>
 {statusInfo.label}
 </span>
 )}
 </>
 ) : (
 <span className="text-[var(--text-muted)] underline decoration-dotted group-hover/fu:text-[var(--accent)]">
 তারিখ সেট নেই
 </span>
 )}
 </button>
 );
 })()}
 </div>

 {/* Card Bottom: Metadata & Actions */}
 <div className="mt-4 border-t border-slate-100 pt-3 ">
 <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] ">
 <span className="flex items-center gap-1">
 <Clock className="h-3 w-3" />
 {formatBanglaDateTime(lead.createdAt)}
 </span>
 {lead.assignedTo && (
 <span className="font-medium text-[var(--text-primary)] ">
 {lead.assignedTo}
 </span>
 )}
 </div>

 {/* Quick Action Buttons */}
 <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
 {/* Messenger reply button if messengerId exists */}
 {lead.messengerId && (
 <a
 href="https://business.facebook.com/latest/inbox/all"
 target="_blank"
 rel="noopener noreferrer"
 className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-soft)] py-1.5 px-2.5 text-xs font-bold text-[#0084FF] hover:bg-blue-100 border border-[var(--border)]/70 transition"
 title="Meta Business Suite Inbox-এ মেসেজের উত্তর দিন"
 >
 <MessengerIcon className="h-3.5 w-3.5 text-[#0084FF]" />
 <span>Messenger-এ উত্তর দিন</span>
 </a>
 )}

 {/* WhatsApp & Call ONLY if phone exists */}
 {lead.phone && lead.phone.trim() ? (
 <>
 <a
 href={getWhatsAppLink(lead.phone, lead.name)}
 target="_blank"
 rel="noopener noreferrer"
 className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--success-bg)] py-1.5 text-xs font-bold text-[var(--success)] hover:bg-emerald-100 transition"
 >
 <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366]" />
 <span>WhatsApp</span>
 </a>
 <a
 href={getPhoneCallLink(lead.phone)}
 className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--accent-soft)] py-1.5 text-xs font-bold text-[var(--accent)] hover:bg-blue-100 transition"
 >
 <Phone className="h-3.5 w-3.5" />
 <span>কল করুন</span>
 </a>
 </>
 ) : null}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 )}

 {/* Follow-up Date Picker Modal (Requirement 1) */}
 <FollowUpDatePickerModal
 isOpen={Boolean(followUpModalLead)}
 lead={followUpModalLead}
 onClose={() => setFollowUpModalLead(null)}
 onSave={async (leadId, followUpDate) => {
 if (onUpdateFollowUpDate) {
 await onUpdateFollowUpDate(leadId, followUpDate);
 }
 }}
 />
 </div>
 );
 };
