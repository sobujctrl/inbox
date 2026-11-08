import React, { useState, useEffect } from 'react';
import {
 X,
 Phone,
 MessageSquare,
 Calendar,
 Tag,
 User,
 Clock,
 Trash2,
 Save,
 CheckCircle,
 AlertTriangle,
 Send,
 Plus,
 DollarSign,
 Share2,
 ExternalLink,
 ChevronDown,
 ChevronUp,
 Copy,
 Check,
} from 'lucide-react';

import { Lead, LeadStatus, LeadSource } from '../../types/lead';
import { SourceBadge, WhatsAppIcon, FacebookIcon, MessengerIcon } from '../common/SourceBadge';
import { ChannelBadge, resolveMessageChannel } from '../common/ChannelBadge';
import { PageBadge } from '../common/PageBadge';
import {
 formatBanglaDateTime,
 formatBanglaRelativeTime,
 formatBanglaDateOnly,
 formatFullBanglaDateTimeWithRelative,
 formatTaka,
 toBengaliNumerals,
 getLeadCommentAndMessageInfo,
 STATUS_LABELS,
 SOURCE_LABELS,
 PRESET_TAGS,
 TEAM_MEMBERS,
} from '../../utils/formatters';
import {
 formatBdPhoneNumber,
 normalizeBdPhoneNumber,
 getWhatsAppLink,
 getPhoneCallLink,
} from '../../utils/phone';
import { useWorkspace } from '../../context/WorkspaceContext';
import { authService } from '../../services/authService';
import { leadService } from '../../services/leadService';

interface ParsedMessageActivity {
 id: string;
 channel: 'comment' | 'messenger' | 'whatsapp';
 text: string;
 timestamp: string;
 postLink?: string;
}

function extractMessageActivities(lead: Lead): ParsedMessageActivity[] {
 if (!lead.activities || !Array.isArray(lead.activities)) return [];

 const results: ParsedMessageActivity[] = [];

 for (const act of lead.activities) {
 const desc = (act.description || '').trim();
 let channel: 'comment' | 'messenger' | 'whatsapp' | null = null;
 let cleanText = '';

 if (desc.startsWith('Facebook কমেন্ট:')) {
 channel = 'comment';
 cleanText = desc.replace(/^Facebook\s*কমেন্ট:\s*/i, '').trim();
 } else if (desc.startsWith('Messenger-এ নতুন মেসেজ:')) {
 channel = 'messenger';
 cleanText = desc.replace(/^Messenger-এ\s*নতুন\s*মেসেজ:\s*/i, '').trim();
 } else if (desc.startsWith('WhatsApp-এ নতুন মেসেজ:')) {
 channel = 'whatsapp';
 cleanText = desc.replace(/^WhatsApp-এ\s*নতুন\s*মেসেজ:\s*/i, '').trim();
 } else if (
 act.channel === 'comment' ||
 (act.type as string) === 'comment' ||
 desc.toLowerCase().startsWith('কমেন্ট:')
 ) {
 channel = 'comment';
 cleanText = desc.replace(/^(Facebook\s*কমেন্ট:|কমেন্ট:)\s*/i, '').trim();
 } else if (
 act.channel === 'messenger' ||
 (act.type as string) === 'messenger' ||
 desc.toLowerCase().startsWith('মেসেঞ্জার:')
 ) {
 channel = 'messenger';
 cleanText = desc.replace(/^(Messenger-এ\s*নতুন\s*মেসেজ:|মেসেঞ্জার:\s*)/i, '').trim();
 } else if (
 act.channel === 'whatsapp' ||
 (act.type as string) === 'whatsapp' ||
 desc.toLowerCase().startsWith('হোয়াটসঅ্যাপ:')
 ) {
 channel = 'whatsapp';
 cleanText = desc.replace(/^(WhatsApp-এ\s*নতুন\s*মেসেজ:|হোয়াটসঅ্যাপ:\s*)/i, '').trim();
 }

 if (channel) {
 if (act.details && act.details.trim()) {
 cleanText = act.details.trim();
 }

 cleanText = cleanText
 .replace(/^Facebook\s*কমেন্ট:\s*/i, '')
 .replace(/^Messenger-এ\s*নতুন\s*মেসেজ:\s*/i, '')
 .replace(/^WhatsApp-এ\s*নতুন\s*মেসেজ:\s*/i, '')
 .replace(/^কমেন্ট:\s*/i, '')
 .replace(/^মেসেঞ্জার:\s*/i, '')
 .replace(/^হোয়াটসঅ্যাপ:\s*/i, '')
 .replace(/^["'“”‘’]|["'“”‘’]$/g, '')
 .trim();

 const postLink = channel === 'comment' ? (act.postLink || lead.lastPostLink) : undefined;

 results.push({
 id: act.id || `${channel}-${act.timestamp}-${Math.random()}`,
 channel,
 text: cleanText || desc,
 timestamp: act.timestamp,
 postLink,
 });
 }
 }

 // Sort from newest to oldest
 return results.sort((a, b) => {
 const timeA = new Date(a.timestamp).getTime() || 0;
 const timeB = new Date(b.timestamp).getTime() || 0;
 return timeB - timeA;
 });
}

type TabType = 'conversation' | 'info' | 'activity';

interface LeadDetailDrawerProps {
 lead: Lead | null;
 isOpen: boolean;
 onClose: () => void;
 onUpdateLead: (id: string, updates: Partial<Lead>) => void;
 onAddNote: (leadId: string, noteContent: string, author?: string) => void;
 onDeleteLead: (leadId: string) => Promise<{ success: boolean; message: string }> | void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
 lead,
 isOpen,
 onClose,
 onUpdateLead,
 onAddNote,
 onDeleteLead,
}) => {
 const { ownerUid } = useWorkspace();
 const currentUser = authService.getCurrentUser();
 const [teamMembers, setTeamMembers] = useState<any[]>([]);

 // Form State - Always declare hooks unconditionally before any early returns
 const [name, setName] = useState(lead?.name || '');
 const [phone, setPhone] = useState(lead?.phone || '');
 const [messengerId, setMessengerId] = useState(lead?.messengerId || '');
 const [profileLink, setProfileLink] = useState(lead?.profileLink || '');
 const [productInterest, setProductInterest] = useState(lead?.productInterest || '');
 const [status, setStatus] = useState<LeadStatus>(lead?.status || 'new');
 const [nextFollowUpDate, setNextFollowUpDate] = useState(() => {
 const raw = lead?.followUpDate || lead?.nextFollowUpDate || '';
 return raw ? raw.substring(0, 10) : '';
 });
 const [assignedTo, setAssignedTo] = useState(lead?.assignedTo || '');
 const [estimatedValue, setEstimatedValue] = useState<number | ''>(() => {
 return lead?.estimatedValue && lead.estimatedValue > 0 ? lead.estimatedValue : '';
 });
 const [selectedTags, setSelectedTags] = useState<string[]>(lead?.tags || []);
 const [newTagInput, setNewTagInput] = useState('');
 const [newNote, setNewNote] = useState('');
 const [noteAuthor, setNoteAuthor] = useState('অ্যাডমিন');

 // Active tab: Default is 'conversation' (কথোপকথন)
 const [activeTab, setActiveTab] = useState<TabType>('conversation');
 const [isSavedRecently, setIsSavedRecently] = useState(false);
 const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
 const [copiedId, setCopiedId] = useState(false);

 const handleCopyId = (textToCopy: string) => {
 if (!textToCopy) return;
 navigator.clipboard?.writeText(textToCopy);
 setCopiedId(true);
 setTimeout(() => setCopiedId(false), 2000);
 };

 // Delete Confirmation Modal States
 const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
 const [isDeleting, setIsDeleting] = useState(false);
 const [deleteError, setDeleteError] = useState<string | null>(null);

 // Subscribe to team members
 useEffect(() => {
  if (!ownerUid) return;
  return leadService.subscribeToTeamMembers(ownerUid, (members) => {
   setTeamMembers(members.filter(m => m.active));
  });
 }, [ownerUid]);

 // Sync state if lead changes
 useEffect(() => {
  if (lead && currentUser) {
   setName(lead.name);
   setPhone(lead.phone || '');
   setMessengerId(lead.messengerId || '');
   setProfileLink(lead.profileLink || '');
   setProductInterest(lead.productInterest || '');
   setStatus(lead.status);
   const rawDate = lead.followUpDate || lead.nextFollowUpDate || '';
   setNextFollowUpDate(rawDate ? rawDate.substring(0, 10) : '');
   setAssignedTo(lead.assignedTo || '');
   setEstimatedValue(lead.estimatedValue && lead.estimatedValue > 0 ? lead.estimatedValue : '');
   setSelectedTags(lead.tags || []);

   // Mark lead as seen and lastSeenAt if needed
   const updatesToMark: Partial<Lead> = {};
   
   // 1. Per-user seen map update
   const myUid = currentUser.uid || currentUser.email;
   if (!lead.seenBy || !lead.seenBy[myUid]) {
    updatesToMark.seenBy = {
     ...(lead.seenBy || {}),
     [myUid]: new Date().toISOString()
    };
   }

   // 2. Legacy seenAt update (backward compatibility)
   if (!lead.seenAt) {
    updatesToMark.seenAt = new Date().toISOString();
   }
   
   const isUnread =
    lead.lastMessageAt &&
    (!lead.lastSeenAt || new Date(lead.lastMessageAt).getTime() > new Date(lead.lastSeenAt).getTime());
   if (isUnread) {
    updatesToMark.lastSeenAt = new Date().toISOString();
   }
   
   if (Object.keys(updatesToMark).length > 0) {
    onUpdateLead(lead.id, updatesToMark);
   }
  }
 }, [lead?.id, currentUser?.uid]);

 // Early return check strictly AFTER all hooks
 if (!isOpen || !lead) return null;

 // Handle Save
 const handleSave = () => {
 const cleanPhone = phone.trim() ? normalizeBdPhoneNumber(phone) || phone.trim() : undefined;
 const dateToSave = nextFollowUpDate ? nextFollowUpDate.substring(0, 10) : null;
 onUpdateLead(lead.id, {
 name,
 phone: cleanPhone,
 originalPhone: phone.trim() || undefined,
 messengerId: messengerId.trim() || undefined,
 profileLink: profileLink.trim() || undefined,
 productInterest,
 status,
 followUpDate: dateToSave,
 nextFollowUpDate: dateToSave,
 assignedTo: assignedTo || null,
 estimatedValue: estimatedValue === '' ? 0 : Number(estimatedValue),
 tags: selectedTags,
 });
 setIsSavedRecently(true);
 setTimeout(() => setIsSavedRecently(false), 2000);
 };

 // Handle Add Note
 const handleAddNoteSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!newNote.trim()) return;
 onAddNote(lead.id, newNote.trim(), noteAuthor);
 setNewNote('');
 };

 // Toggle Tags
 const toggleTag = (tag: string) => {
 if (selectedTags.includes(tag)) {
 setSelectedTags(selectedTags.filter((t) => t !== tag));
 } else {
 setSelectedTags([...selectedTags, tag]);
 }
 };

 const handleAddNewCustomTag = () => {
 if (newTagInput.trim() && !selectedTags.includes(newTagInput.trim())) {
 setSelectedTags([...selectedTags, newTagInput.trim()]);
 setNewTagInput('');
 }
 };

 // Handle Confirm Delete from Firestore
 const handleConfirmDelete = async () => {
 setIsDeleting(true);
 setDeleteError(null);

 try {
 const res = await onDeleteLead(lead.id);
 setIsDeleting(false);

 if (res && res.success === false) {
 setDeleteError(res.message);
 } else {
 setIsDeleteConfirmOpen(false);
 onClose();
 }
 } catch (err: any) {
 setIsDeleting(false);
 setDeleteError(err?.message || 'Firestore থেকে লিড মুছতে ব্যর্থ হয়েছে।');
 }
 };

 const isMultiSource = lead.sources && lead.sources.length > 1;
 const leadChannel = resolveMessageChannel(lead.lastChannel, lead);
 const commentInfo = getLeadCommentAndMessageInfo(lead);
 const latestMessageText = lead.lastMessage || lead.message || '';
 const messageActivities = extractMessageActivities(lead);

 // Messenger direct link
 const messengerUrl = lead.messengerId
 ? lead.messengerId.startsWith('http')
 ? lead.messengerId
 : `https://m.me/${lead.messengerId}`
 : 'https://business.facebook.com/latest/inbox/all';

 return (
 <div className="fixed inset-0 z-50 overflow-hidden">
 {/* Backdrop */}
 <div
 className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
 onClick={onClose}
 />

 <div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10">
 <div className="w-screen max-w-full sm:max-w-xl bg-[var(--bg-surface)] shadow-2xl transition-all flex flex-col border-l border-[var(--border)] ">
 
 {/* ======================================================== */}
 {/* 1. STICKY HEADER (Always visible, compact, no duplicate save/delete) */}
 {/* ======================================================== */}
 <div className="sticky top-0 z-20 border-b border-[var(--border)]/90 bg-[var(--bg-surface)]/95 backdrop-blur-md px-4 py-3 shrink-0">
 {/* Top row: Customer Name, badges, time, and Close Button */}
 <div className="flex items-start justify-between gap-2">
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-1.5 flex-wrap">
 <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
 {name || lead.name}
 </h2>
 {commentInfo.isMergedFacebookMessenger ? (
 <>
 <ChannelBadge channel="comment" size="xs" />
 <ChannelBadge channel="messenger" size="xs" />
 </>
 ) : (
 <>
 {leadChannel && <ChannelBadge channel={leadChannel} size="xs" />}
 {leadChannel === 'messenger' && commentInfo.hasComment && (
 <ChannelBadge channel="comment" size="xs" />
 )}
 </>
 )}
 {(lead.pageName || lead.pageId) && (
 <PageBadge pageName={lead.pageName} pageId={lead.pageId} size="sm" />
 )}
 </div>

 {/* Sub row: Phone status badge, ID with Copy Button & time */}
 <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[var(--text-secondary)] flex-wrap">
 {lead.phone && lead.phone.trim() ? (
 <span className="font-mono font-semibold text-[var(--text-primary)] ">
 {formatBdPhoneNumber(lead.phone)}
 </span>
 ) : (
 <span className="inline-flex items-center rounded-md bg-[var(--warning-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--warning)] border border-amber-200 ">
 ফোন নেই
 </span>
 )}
 <span>•</span>
 {/* ID with Copy Button */}
 {(lead.messengerId || lead.id) && (
 <>
 <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold bg-[var(--bg-elevated)] text-[var(--text-primary)] px-2 py-0.5 rounded-md border border-[var(--border)] ">
 <span>ID: {lead.messengerId || lead.id}</span>
 <button
 type="button"
 onClick={() => handleCopyId(lead.messengerId || lead.id)}
 className="hover:text-[var(--accent)] p-0.5 rounded transition cursor-pointer"
 title={copiedId ? 'কপি হয়েছে!' : 'ID কপি করুন'}
 >
 {copiedId ? (
 <Check className="w-3 h-3 text-[var(--success)] " />
 ) : (
 <Copy className="w-3 h-3 text-[var(--text-muted)] hover:text-[var(--text-secondary)]" />
 )}
 </button>
 </span>
 <span>•</span>
 </>
 )}
 <span className="flex items-center gap-1">
 <Clock className="w-3 h-3" />
 {formatBanglaRelativeTime(lead.lastMessageAt || lead.createdAt)}
 </span>
 </div>
 </div>

 {/* Close 'X' Button Only */}
 <button
 type="button"
 onClick={onClose}
 aria-label="বন্ধ করুন"
 title="বন্ধ করুন"
 className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] shrink-0 transition"
 >
 <X className="h-5 w-5" />
 </button>
 </div>

 {/* Bottom Header Row: Status Selector Dropdown & Large Reply Action Button */}
 <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
 {/* Status Single Dropdown */}
 <div className="flex items-center gap-1.5">
 <span className="text-[11px] font-semibold text-[var(--text-secondary)] ">স্ট্যাটাস:</span>
 <select
 value={status}
 onChange={(e) => setStatus(e.target.value as LeadStatus)}
 className="rounded-lg border border-slate-300 bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-bold text-[var(--text-primary)] shadow-2xs focus:border-blue-500 focus:outline-hidden "
 >
 {(['new', 'contacted', 'followup', 'won', 'lost'] as LeadStatus[]).map((st) => (
 <option key={st} value={st}>
 {STATUS_LABELS[st]}
 </option>
 ))}
 </select>
 </div>

 {/* Action Buttons: Facebook, Messenger, WhatsApp, Call */}
 <div className="flex items-center gap-1.5 ml-auto flex-wrap">
 {/* Facebook Comment / Post Link if available */}
 {(commentInfo.commentUrl || lead.lastPostLink) && (
 <a
 href={commentInfo.commentUrl || lead.lastPostLink}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs font-bold text-[#1877F2] hover:bg-blue-100 border border-[var(--border)]/70 transition"
 title="ফেসবুক পোস্ট/কমেন্ট দেখুন"
 >
 <FacebookIcon className="h-3.5 w-3.5 text-[#1877F2] shrink-0" />
 <span className="hidden sm:inline">ফেসবুক পোস্ট</span>
 </a>
 )}

 {/* Messenger reply */}
 <a
 href={messengerUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1.5 rounded-lg bg-[#0084FF] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#0073e6] transition"
 title="Messenger-এ উত্তর দিন"
 >
 <MessengerIcon className="h-3.5 w-3.5 shrink-0" />
 <span>Messenger</span>
 </a>

 {/* WhatsApp & Call buttons if phone exists */}
 {lead.phone && lead.phone.trim() && (
 <>
 <a
 href={getWhatsAppLink(lead.phone, lead.name)}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#20ba59] transition"
 title="WhatsApp চ্যাট"
 >
 <WhatsAppIcon className="h-3.5 w-3.5 shrink-0" />
 <span className="hidden min-[480px]:inline">WhatsApp</span>
 </a>

 <a
 href={getPhoneCallLink(lead.phone)}
 className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs font-bold text-[var(--accent)] hover:bg-blue-100 border border-[var(--border)]/70 transition"
 title="সরাসরি কল করুন"
 >
 <Phone className="h-3.5 w-3.5 shrink-0" />
 <span>কল</span>
 </a>
 </>
 )}
 </div>
 </div>

 {/* Multi-source banner (if lead is linked across channels) */}
 {isMultiSource && (
 <div className="mt-2 rounded-md bg-[var(--badge-indigo-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--badge-indigo-text)] border border-[var(--badge-indigo-border)] flex items-center gap-1.5">
 <Share2 className="h-3 w-3 text-[var(--badge-indigo-text)] shrink-0" />
 <span className="truncate">
 মার্জড লিড (মাল্টি-চ্যানেল): {lead.sources.map((s) => SOURCE_LABELS[s] || s).join(' + ')}
 </span>
 </div>
 )}
 </div>

 {/* ======================================================== */}
 {/* 2. THREE CLEAN TABS (Default is 'কথোপকথন') */}
 {/* ======================================================== */}
 <div className="flex border-b border-[var(--border)]/90 px-4 bg-[var(--bg-page)]/70 shrink-0">
 <button
 onClick={() => setActiveTab('conversation')}
 className={`py-2.5 text-xs font-bold border-b-2 transition-colors mr-5 whitespace-nowrap flex items-center gap-1.5 ${
 activeTab === 'conversation'
 ? 'border-blue-600 text-[var(--accent)] '
 : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
 }`}
 >
 <MessageSquare className="w-3.5 h-3.5" />
 <span>কথোপকথন</span>
 {(lead.notes.length > 0 || messageActivities.length > 0) && (
 <span className="rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] tabular-nums ">
 {toBengaliNumerals(lead.notes.length + (latestMessageText ? 1 : 0))}
 </span>
 )}
 </button>

 <button
 onClick={() => setActiveTab('info')}
 className={`py-2.5 text-xs font-bold border-b-2 transition-colors mr-5 whitespace-nowrap flex items-center gap-1.5 ${
 activeTab === 'info'
 ? 'border-blue-600 text-[var(--accent)] '
 : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
 }`}
 >
 <User className="w-3.5 h-3.5" />
 <span>তথ্য</span>
 </button>

 <button
 onClick={() => setActiveTab('activity')}
 className={`py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
 activeTab === 'activity'
 ? 'border-blue-600 text-[var(--accent)] '
 : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
 }`}
 >
 <Clock className="w-3.5 h-3.5" />
 <span>অ্যাক্টিভিটি</span>
 {lead.activities.length > 0 && (
 <span className="rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] tabular-nums ">
 {toBengaliNumerals(lead.activities.length)}
 </span>
 )}
 </button>
 </div>

 {/* ======================================================== */}
 {/* 3. DRAWER BODY (Tab Panels) */}
 {/* ======================================================== */}
 <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
 
 {/* ---------------------------------------------------- */}
 {/* TAB 1: CONVERSATION (কথোপকথন - ডিফল্ট) */}
 {/* ---------------------------------------------------- */}
 {activeTab === 'conversation' && (
 <div className="space-y-4">
 {/* If merged with both Facebook comment and Messenger, display both distinct cards */}
 {commentInfo.isMergedFacebookMessenger ? (
 <>
 {/* FACEBOOK COMMENT CARD */}
 <div className="rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50/70 to-orange-50/40 p-3.5 shadow-2xs">
 <div className="flex items-center justify-between text-[11px] font-bold text-amber-950 mb-2 flex-wrap gap-1">
 <div className="flex items-center gap-1.5">
 <span>ফেসবুক কমেন্ট</span>
 <ChannelBadge channel="comment" size="xs" />
 </div>
 {commentInfo.commentTime && (
 <span className="font-normal text-[var(--text-secondary)] text-[10px]">
 {formatBanglaDateTime(commentInfo.commentTime)}
 </span>
 )}
 </div>
 <p className={`text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap ${commentInfo.commentText ? 'text-[var(--text-primary)] ' : 'italic text-[var(--text-muted)] '}`}>
 {commentInfo.commentText ? `"${commentInfo.commentText}"` : 'কমেন্ট তথ্য নেই'}
 </p>

 {(commentInfo.commentUrl || lead.lastPostLink) && (
 <div className="mt-2.5 pt-2 border-t border-amber-200/60 flex items-center justify-between">
 <span className="text-[11px] text-[var(--text-secondary)] ">
 ফেসবুক পোস্টের কমেন্ট
 </span>
 <a
 href={commentInfo.commentUrl || lead.lastPostLink}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700 transition"
 >
 <span>পোস্ট দেখুন</span>
 <ExternalLink className="h-3 w-3" />
 </a>
 </div>
 )}
 </div>

 {/* MESSENGER MESSAGE CARD */}
 <div className="rounded-xl border border-[var(--border)]/90 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 p-3.5 shadow-2xs">
 <div className="flex items-center justify-between text-[11px] font-bold text-blue-950 mb-2 flex-wrap gap-1">
 <div className="flex items-center gap-1.5">
 <span>মেসেঞ্জার ইনবক্স বার্তা</span>
 <ChannelBadge channel="messenger" size="xs" />
 </div>
 {commentInfo.messageTime && (
 <span className="font-normal text-[var(--text-secondary)] text-[10px]">
 {formatBanglaDateTime(commentInfo.messageTime)}
 </span>
 )}
 </div>
 <p className="text-xs sm:text-sm font-medium text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
 "{commentInfo.messageText || latestMessageText}"
 </p>
 <div className="mt-2.5 pt-2 border-t border-[var(--border)]/60 flex items-center justify-between">
 <span className="text-[11px] text-[var(--text-secondary)] ">
 ইনবক্স থেকে সরাসরি যোগাযোগ
 </span>
 <a
 href={messengerUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 rounded-md bg-[#0084FF] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#0073e6] transition"
 >
 <MessengerIcon className="h-3 w-3" />
 <span>Messenger-এ উত্তর দিন</span>
 </a>
 </div>
 </div>
 </>
 ) : latestMessageText || commentInfo.commentText ? (
 <div className="rounded-xl border border-[var(--border)]/90 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 p-3.5 shadow-2xs">
 <div className="flex items-center justify-between text-[11px] font-bold text-blue-950 mb-2 flex-wrap gap-1">
 <div className="flex items-center gap-1.5">
 <span>{leadChannel === 'comment' ? 'সর্বশেষ কমেন্ট' : 'সর্বশেষ মেসেজ'}</span>
 {leadChannel && <ChannelBadge channel={leadChannel} size="xs" />}
 </div>
 {(lead.lastMessageAt || commentInfo.commentTime) && (
 <span className="font-normal text-[var(--text-secondary)] text-[10px]">
 {formatBanglaDateTime(lead.lastMessageAt || commentInfo.commentTime)}
 </span>
 )}
 </div>
 <p className="text-xs sm:text-sm font-medium text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
 "{latestMessageText || commentInfo.commentText}"
 </p>

 {/* If comment, show 'পোস্ট দেখুন' button */}
 {(leadChannel === 'comment' || commentInfo.hasComment) && (commentInfo.commentUrl || lead.lastPostLink) && (
 <div className="mt-2.5 pt-2 border-t border-[var(--border)]/60 flex items-center justify-between">
 <span className="text-[11px] text-[var(--text-secondary)] ">
 ফেসবুক পোস্টের কমেন্ট
 </span>
 <a
 href={commentInfo.commentUrl || lead.lastPostLink}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-white hover:bg-blue-700 transition"
 >
 <span>পোস্ট দেখুন</span>
 <ExternalLink className="h-3 w-3" />
 </a>
 </div>
 )}
 </div>
 ) : (
 <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center ">
 <p className="text-xs text-[var(--text-muted)] ">কোনো মেসেজ রেকর্ড পাওয়া যায়নি</p>
 </div>
 )}

 {/* 2. CHAT-STYLE PREVIOUS MESSAGES/COMMENTS TIMELINE */}
 {messageActivities.length > 0 && (
 <div className="space-y-2 pt-1">
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-bold text-[var(--text-secondary)] ">
 আগের মেসেজ / কমেন্ট হিস্ট্রি
 </span>
 <span className="text-[10px] text-[var(--text-muted)] ">
 {toBengaliNumerals(messageActivities.length)}টি রেকর্ড
 </span>
 </div>

 <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
 {messageActivities.map((item) => (
 <div
 key={item.id}
 className="rounded-lg border border-[var(--border)]/80 bg-[var(--bg-page)]/60 p-2.5 text-xs transition "
 >
 <div className="flex items-center justify-between gap-2 mb-1">
 <ChannelBadge channel={item.channel} size="xs" />
 {item.timestamp && (
 <span className="text-[10px] text-[var(--text-muted)] ">
 {formatBanglaRelativeTime(item.timestamp)}
 </span>
 )}
 </div>
 <p className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
 {item.text}
 </p>
 {item.channel === 'comment' && item.postLink && (
 <div className="mt-1.5 pt-1 border-t border-[var(--border)]/50 ">
 <a
 href={item.postLink}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--accent)] hover:underline "
 >
 <span>পোস্ট দেখুন</span>
 <ExternalLink className="h-2.5 w-2.5" />
 </a>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 )}

 {/* 3. COMPACT NOTE ADDING BOX */}
 <form
 onSubmit={handleAddNoteSubmit}
 className="rounded-xl border border-[var(--border)]/90 bg-[var(--bg-page)]/70 p-3 space-y-2 pt-2.5"
 >
 <div className="flex items-center justify-between">
 <label className="text-[11px] font-bold text-[var(--text-primary)] ">
 নোট যোগ করুন
 </label>
 <select
 value={noteAuthor}
 onChange={(e) => setNoteAuthor(e.target.value)}
 className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] text-[var(--text-primary)] "
 >
 <option value="অ্যাডমিন">লেখক: অ্যাডমিন</option>
 {teamMembers.map((m) => (
 <option key={m.email} value={m.name}>
 লেখক: {m.name}
 </option>
 ))}
 </select>
 </div>
 <textarea
 rows={2}
 value={newNote}
 onChange={(e) => setNewNote(e.target.value)}
 placeholder="গ্রাহকের সাথে আলাপের সারসংক্ষেপ লিখুন..."
 className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 />
 <div className="flex justify-end">
 <button
 type="submit"
 disabled={!newNote.trim()}
 className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition"
 >
 <Send className="h-3 w-3" />
 <span>নোট সংরক্ষণ</span>
 </button>
 </div>
 </form>

 {/* 4. SAVED NOTES LIST */}
 {lead.notes && lead.notes.length > 0 && (
 <div className="space-y-2 pt-2 border-t border-[var(--border)]/60 ">
 <span className="text-[11px] font-bold text-[var(--text-secondary)] ">
 সংরক্ষিত নোটসমূহ ({toBengaliNumerals(lead.notes.length)})
 </span>
 <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
 {lead.notes.map((note) => (
 <div
 key={note.id}
 className="rounded-lg border border-[var(--border)]/80 bg-[var(--bg-surface)] p-2.5 text-xs "
 >
 <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] mb-1">
 <span className="font-bold text-[var(--text-primary)] ">
 {note.author}
 </span>
 <span>{formatBanglaDateTime(note.createdAt)}</span>
 </div>
 <p className="text-xs text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
 {note.content}
 </p>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* ---------------------------------------------------- */}
 {/* TAB 2: INFO (তথ্য - কম্প্যাক্ট ২-কলাম গ্রিড) */}
 {/* ---------------------------------------------------- */}
 {activeTab === 'info' && (
 <div className="space-y-4 text-xs">
 {/* Lead Timestamps Display */}
 <div className="rounded-xl border border-[var(--border)]/85 bg-[var(--bg-page)] p-3 space-y-1.5 text-xs text-[var(--text-primary)] ">
 <div className="flex items-center justify-between flex-wrap gap-1">
 <span className="font-semibold text-[var(--text-secondary)] ">লিড এসেছে:</span>
 <span className="font-bold text-[var(--text-primary)] ">{formatFullBanglaDateTimeWithRelative(lead.createdAt)}</span>
 </div>
 <div className="flex items-center justify-between flex-wrap gap-1">
 <span className="font-semibold text-[var(--text-secondary)] ">সর্বশেষ মেসেজ:</span>
 <span className="font-bold text-[var(--text-primary)] ">{formatFullBanglaDateTimeWithRelative(lead.lastMessageAt || lead.createdAt)}</span>
 </div>
 {lead.updatedBy && (
 <div className="flex items-center justify-between flex-wrap gap-1 pt-1.5 border-t border-[var(--border)]/50 mt-1.5">
 <span className="font-semibold text-[var(--text-secondary)] ">শেষ আপডেট:</span>
 <span className="font-bold text-[var(--accent)] ">{lead.updatedBy.name} ({formatBanglaRelativeTime(lead.updatedBy.timestamp)})</span>
 </div>
 )}
 </div>

 {/* Compact 2-column Grid */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {/* Name */}
 <div>
 <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
 গ্রাহকের নাম
 </label>
 <input
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 />
 </div>

 {/* Phone */}
 <div>
 <div className="flex items-center justify-between mb-1">
 <label className="block text-[11px] font-bold text-[var(--text-secondary)] ">
 ফোন নম্বর
 </label>
 {!phone && (
 <span className="text-[10px] text-amber-600 font-semibold">
 ফোন নেই
 </span>
 )}
 </div>
 <input
 type="text"
 value={phone}
 onChange={(e) => setPhone(e.target.value)}
 placeholder="017XXXXXXXX বা খালি রাখুন"
 className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2 font-mono text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 />
 </div>

 {/* Product Interest */}
 <div>
 <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
 আগ্রহের প্রোডাক্ট / সার্ভিস
 </label>
 <input
 type="text"
 value={productInterest}
 onChange={(e) => setProductInterest(e.target.value)}
 placeholder="যেমন: লেদার ব্যাগ, ওয়েব সার্ভিস"
 className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 />
 </div>

 {/* Estimated Value */}
 <div>
 <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
 সম্ভাব্য মূল্য (টাকা)
 </label>
 <input
 type="number"
 value={estimatedValue === 0 ? '' : estimatedValue}
 onChange={(e) =>
 setEstimatedValue(e.target.value === '' ? '' : Number(e.target.value))
 }
 placeholder="যেমন: ১৫০০"
 className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 />
 </div>

 {/* Next Follow-Up Date */}
 <div>
 <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
 ফলো-আপের তারিখ
 </label>
 <input
 type="date"
 value={nextFollowUpDate}
 onChange={(e) => setNextFollowUpDate(e.target.value)}
 className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 />
 </div>

 {/* Assigned Team Member */}
 <div>
 <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
 দায়িত্বপ্রাপ্ত সদস্য
 </label>
 <select
 value={assignedTo}
 onChange={(e) => setAssignedTo(e.target.value)}
 className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 >
 <option value="">অ্যাসাইন করা নেই</option>
 <option value="অ্যাডমিন">অ্যাডমিন</option>
 {teamMembers.map((m) => (
 <option key={m.email} value={m.name}>
 {m.name}
 </option>
 ))}
 </select>
 </div>
 </div>

 {/* Tags Section */}
 <div className="pt-2 border-t border-[var(--border)]/60 ">
 <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">
 ট্যাগসমূহ
 </label>
 <div className="flex flex-wrap gap-1.5 mb-2">
 {PRESET_TAGS.map((tag) => {
 const isSelected = selectedTags.includes(tag);
 return (
 <button
 key={tag}
 type="button"
 onClick={() => toggleTag(tag)}
 className={`rounded-md px-2 py-0.5 text-xs font-semibold transition ${
 isSelected
 ? 'bg-[var(--accent)] text-white shadow-2xs'
 : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover '
 }`}
 >
 {tag}
 </button>
 );
 })}
 </div>
 <div className="flex gap-2">
 <input
 type="text"
 placeholder="কাস্টম ট্যাগ লিখুন..."
 value={newTagInput}
 onChange={(e) => setNewTagInput(e.target.value)}
 onKeyDown={(e) =>
 e.key === 'Enter' && (e.preventDefault(), handleAddNewCustomTag())
 }
 className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 />
 <button
 type="button"
 onClick={handleAddNewCustomTag}
 className="rounded-lg bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover "
 >
 যুক্ত করুন
 </button>
 </div>
 </div>

 {/* 4. COLLAPSIBLE "আরও দেখুন (Advanced)" SECTION */}
 <div className="pt-2 border-t border-[var(--border)]/60 ">
 <button
 type="button"
 onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
 className="w-full flex items-center justify-between text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] :text-white py-1 transition"
 >
 <span>আরও দেখুন (Advanced কারিগরি তথ্য)</span>
 {isAdvancedOpen ? (
 <ChevronUp className="w-4 h-4" />
 ) : (
 <ChevronDown className="w-4 h-4" />
 )}
 </button>

 {isAdvancedOpen && (
 <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-page)]/70 p-3 space-y-3 animate-in fade-in duration-150">
 {/* Messenger PSID & Profile Link */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div>
 <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1">
 Messenger PSID (User ID)
 </label>
 <input
 type="text"
 value={messengerId}
 onChange={(e) => setMessengerId(e.target.value)}
 placeholder="যেমন: 489218491029482"
 className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-1.5 font-mono text-[11px] text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 />
 </div>
 <div>
 <div className="flex items-center justify-between mb-1">
 <label className="block text-[10px] font-bold text-[var(--text-secondary)] ">
 ফেসবুক প্রোফাইল লিংক
 </label>
 {profileLink && (
 <a
 href={profileLink}
 target="_blank"
 rel="noopener noreferrer"
 className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-0.5"
 >
 ভিজিট <ExternalLink className="h-2.5 w-2.5" />
 </a>
 )}
 </div>
 <input
 type="url"
 value={profileLink}
 onChange={(e) => setProfileLink(e.target.value)}
 placeholder="https://facebook.com/..."
 className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-1.5 text-[11px] text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 />
 </div>
 </div>

 {/* Facebook Page Info */}
 {(lead.pageName || lead.pageId) && (
 <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] pt-2 border-t border-[var(--border)]/50 ">
 <span>ফেসবুক পেজ: {lead.pageName || 'অজ্ঞাত'}</span>
 {lead.pageId && <span className="font-mono text-[10px]">ID: {lead.pageId}</span>}
 </div>
 )}

 {/* Lead Document ID & Creation Time */}
 <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] pt-1">
 <span>Lead ID: {lead.id}</span>
 <span>তৈরি: {formatBanglaDateTime(lead.createdAt)}</span>
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {/* ---------------------------------------------------- */}
 {/* TAB 3: ACTIVITY (অ্যাক্টিভিটি হিস্ট্রি ও অডিট ট্রেইল) */}
 {/* ---------------------------------------------------- */}
 {activeTab === 'activity' && (
 <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before">
 {lead.activities.length === 0 ? (
 <p className="text-xs text-[var(--text-muted)]">কোনো অ্যাক্টিভিটি হিস্ট্রি নেই</p>
 ) : (
 lead.activities.map((act) => {
 const actChannel = resolveMessageChannel(act.channel, {
 ...act,
 lastChannel: lead.lastChannel,
 lastPostLink: lead.lastPostLink,
 });
 const isComment =
 actChannel === 'comment' || act.type === 'comment' || Boolean(act.postLink);
 const isMessenger =
 actChannel === 'messenger' ||
 act.channel === 'messenger' ||
 (act.type === 'contacted' && act.description.includes('Messenger'));
 const resolvedChannel = isComment ? 'comment' : isMessenger ? 'messenger' : actChannel;

 return (
 <div key={act.id} className="relative">
 {/* Dot / icon */}
 <div className="absolute -left-[18px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--accent)] " />

 <div className="flex items-center gap-1.5 flex-wrap">
 <span className="text-xs font-bold text-[var(--text-primary)] ">
 {act.description}
 </span>
 {resolvedChannel && <ChannelBadge channel={resolvedChannel} size="xs" />}
 </div>

 {act.details && (
 <p className="mt-0.5 text-xs text-[var(--text-secondary)] ">
 {act.details}
 </p>
 )}

 {isComment && act.postLink && (
 <div className="mt-1">
 <a
 href={act.postLink}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] hover:underline "
 >
 <span>পোস্ট দেখুন</span>
 <ExternalLink className="h-3 w-3" />
 </a>
 </div>
 )}

 <div className="mt-1 text-[10px] text-[var(--text-muted)] ">
 {formatBanglaDateTime(act.timestamp)}
 </div>
 </div>
 );
 })
 )}
 </div>
 )}
 </div>

 {/* ======================================================== */}
 {/* 5. DRAWER FOOTER: Only Save & Close + Small Red Delete Icon */}
 {/* ======================================================== */}
 <div className="border-t border-[var(--border)]/90 p-3 sm:p-4 bg-[var(--bg-page)]/90 flex items-center justify-between gap-2 shrink-0">
 {/* Small red trash icon button for permanent delete */}
 <button
 type="button"
 onClick={() => {
 setDeleteError(null);
 setIsDeleteConfirmOpen(true);
 }}
 title="লিড মুছে ফেলুন"
 aria-label="লিড মুছে ফেলুন"
 className="flex items-center justify-center p-2 rounded-lg text-[var(--danger)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)] :bg-rose-950/40 transition shrink-0"
 >
 <Trash2 className="h-4 w-4" />
 </button>

 {/* Right: Close and Primary Save */}
 <div className="flex items-center gap-2 ml-auto">
 <button
 type="button"
 onClick={onClose}
 className="rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover transition shrink-0"
 >
 বন্ধ করুন
 </button>
 <button
 type="button"
 onClick={handleSave}
 className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition shrink-0"
 >
 {isSavedRecently ? (
 <>
 <CheckCircle className="h-3.5 w-3.5" />
 <span>সংরক্ষিত হয়েছে!</span>
 </>
 ) : (
 <>
 <Save className="h-3.5 w-3.5" />
 <span>সংরক্ষণ করুন</span>
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 </div>

 {/* ======================================================== */}
 {/* DELETE CONFIRMATION MODAL */}
 {/* ======================================================== */}
 {isDeleteConfirmOpen && (
 <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
 <div className="w-full max-w-sm rounded-2xl border border-rose-200 bg-[var(--bg-surface)] p-5 shadow-2xl text-[var(--text-primary)] animate-in zoom-in-95 duration-150">
 <div className="flex items-center gap-3 text-[var(--danger)] mb-3">
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--danger-bg)] ">
 <Trash2 className="h-5 w-5" />
 </div>
 <div>
 <h3 className="text-sm font-bold text-[var(--text-primary)] ">
 লিডটি স্থায়ীভাবে মুছে ফেলতে চান?
 </h3>
 <p className="text-[11px] text-[var(--text-secondary)] ">
 এই পরিবর্তনটি পূর্বাবস্থায় ফেরানো যাবে না
 </p>
 </div>
 </div>

 <div className="rounded-xl bg-[var(--bg-page)] p-3 text-xs border border-[var(--border)] mb-3 space-y-1">
 <p className="font-bold text-[var(--text-primary)] ">{lead.name}</p>
 {lead.phone && (
 <p className="font-mono text-[var(--text-secondary)] text-[11px]">{lead.phone}</p>
 )}
 <p className="text-[11px] text-[var(--text-secondary)] ">
 সোর্স: {lead.sources.map((s) => SOURCE_LABELS[s] || s).join(', ')}
 </p>
 </div>

 {deleteError && (
 <div className="mb-3 rounded-xl bg-[var(--danger-bg)] p-3 text-xs text-rose-800 border border-rose-200 flex items-start gap-2">
 <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--danger)] " />
 <div className="space-y-0.5">
 <span className="font-bold block">মুছতে ব্যর্থ হয়েছে:</span>
 <p className="leading-relaxed text-[11px]">{deleteError}</p>
 </div>
 </div>
 )}

 <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
 Firestore ক্লাউড ডাটাবেজ থেকে এই লিডের সমস্ত তথ্য, নোট ও হিস্ট্রি স্থায়ীভাবে মুছে যাবে।
 </p>

 <div className="flex justify-end gap-2">
 <button
 type="button"
 disabled={isDeleting}
 onClick={() => {
 setIsDeleteConfirmOpen(false);
 setDeleteError(null);
 }}
 className="rounded-lg px-3.5 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
 >
 বাতিল
 </button>
 <button
 type="button"
 disabled={isDeleting}
 onClick={handleConfirmDelete}
 className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-700 shadow-xs disabled:opacity-50 transition"
 >
 {isDeleting ? (
 <>
 <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
 <span>মুছে ফেলা হচ্ছে...</span>
 </>
 ) : (
 <>
 <Trash2 className="h-3.5 w-3.5" />
 <span>হ্যাঁ, মুছে ফেলুন</span>
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};
