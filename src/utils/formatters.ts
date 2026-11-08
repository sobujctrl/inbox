import { Lead, LeadSource, LeadStatus } from '../types/lead';
import { formatBdPhoneNumber } from './phone';

export const SOURCE_LABELS: Record<LeadSource, string> = {
 facebook: 'Facebook',
 messenger: 'Messenger',
 whatsapp: 'WhatsApp',
 website: 'ওয়েবসাইট',
 manual: 'ম্যানুয়াল এন্ট্রি',
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
 new: 'নতুন',
 contacted: 'যোগাযোগ করা হয়েছে',
 followup: 'ফলো-আপ',
 won: 'কাস্টমার হয়েছে',
 confirmed: 'কনফার্ম',
 pending: 'পেন্ডিং',
 cancelled: 'ক্যান্সেল',
 hold: 'হোল্ড',
};

export const PRESET_TAGS = [
 'গরম লিড 🔥',
 'দাম জানতে চেয়েছে',
 'কল ব্যাক প্রয়োজন',
 'VIP ক্লায়েন্ট',
 'অফার চায়',
 'পাইকারি ক্রেতা',
 'তাড়াতাড়ি ডেলিভারি',
 'সন্দেহপ্রবণ',
 'রিপিট কাস্টমার',
];

export const TEAM_MEMBERS = [
 'রাকিব হাসান',
 'সুমাইয়া আক্তার',
 'মেহরাব হোসেন',
 'তানজিম আহমেদ',
 'ফারজানা সুলতানা',
];

/**
 * Converts English numbers to Bengali numerals
 */
export function toBengaliNumerals(num: number | string): string {
 const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
 return String(num).replace(/[0-9]/g, (w) => bengaliDigits[+w]);
}

/**
 * Format relative time or clean date in Bengali
 */
export function formatBanglaDateTime(isoDateString?: string | null): string {
 if (!isoDateString) return 'নির্ধারিত নয়';
 try {
 const date = new Date(isoDateString);
 if (isNaN(date.getTime())) return isoDateString;

 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffMins = Math.floor(diffMs / (1000 * 60));
 const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
 const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

 if (diffMins < 1) return 'এইমাত্র';
 if (diffMins < 60) return `${toBengaliNumerals(diffMins)} মিনিট আগে`;
 if (diffHours < 24 && now.getDate() === date.getDate()) {
 return `আজ ${date.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}`;
 }
 if (diffDays === 1) {
 return `গতকাল ${date.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}`;
 }

 return date.toLocaleDateString('bn-BD', {
 year: 'numeric',
 month: 'short',
 day: 'numeric',
 hour: '2-digit',
 minute: '2-digit',
 });
 } catch {
 return isoDateString;
 }
}

function getDhakaDateOnlyString(isoString?: string | null): string {
 if (!isoString) return '';
 try {
 const d = new Date(isoString);
 if (isNaN(d.getTime())) return '';
 return new Intl.DateTimeFormat('en-CA', {
 timeZone: 'Asia/Dhaka',
 year: 'numeric',
 month: '2-digit',
 day: '2-digit',
 }).format(d);
 } catch {
 return '';
 }
}

/**
 * Full date and time in Bangladesh time with relative time in parentheses, e.g. "৫ নভেম্বর ২০২৬, দুপুর ১:০৯ (আজ)" or "২ নভেম্বর ২০২৬, রাত ৯:১৫ (৩ দিন আগে)"
 */
export function formatFullBanglaDateTimeWithRelative(isoDateString?: string | null): string {
 if (!isoDateString) return 'তারিখ নির্ধারিত নয়';
 try {
 const tz = 'Asia/Dhaka';
 const date = new Date(isoDateString);
 if (isNaN(date.getTime())) return isoDateString;

 const day = date.toLocaleDateString('bn-BD', { timeZone: tz, day: 'numeric' });
 const month = date.toLocaleDateString('bn-BD', { timeZone: tz, month: 'long' });
 const year = date.toLocaleDateString('bn-BD', { timeZone: tz, year: 'numeric' });

 const timeStr = new Intl.DateTimeFormat('en-GB', {
 timeZone: tz,
 hour: '2-digit',
 minute: '2-digit',
 hour12: false,
 }).format(date);

 const [hStr, mStr] = timeStr.split(':');
 const hour24 = parseInt(hStr, 10);
 const hour12 = hour24 % 12 || 12;
 const period = getBanglaPeriod(hour24);

 const formattedTime = `${period} ${toBengaliNumerals(hour12)}:${toBengaliNumerals(mStr)}`;
 const fullFormatted = `${day} ${month} ${year}, ${formattedTime}`;

 const targetDhaka = getDhakaDateOnlyString(isoDateString);
 const nowDhaka = getDhakaDateOnlyString(new Date().toISOString());

 if (!targetDhaka) return fullFormatted;

 const tTime = new Date(`${targetDhaka}T00:00:00Z`).getTime();
 const todayTime = new Date(`${nowDhaka}T00:00:00Z`).getTime();
 const diffDays = Math.round((todayTime - tTime) / (1000 * 60 * 60 * 24));

 let relativeStr = '';
 if (diffDays === 0) {
 relativeStr = 'আজ';
 } else if (diffDays === 1) {
 relativeStr = 'গতকাল';
 } else if (diffDays > 1) {
 relativeStr = `${toBengaliNumerals(diffDays)} দিন আগে`;
 } else if (diffDays === -1) {
 relativeStr = 'আগামীকাল';
 } else {
 relativeStr = `${toBengaliNumerals(Math.abs(diffDays))} দিন পরে`;
 }

 const currentYear = new Date().toLocaleString('en-CA', { timeZone: tz }).substring(0, 4);
 const targetYear = targetDhaka.substring(0, 4);
 const datePart = targetYear === currentYear ? `${day} ${month}, ${formattedTime}` : `${day} ${month} ${year}, ${formattedTime}`;

 return `${datePart} (${relativeStr})`;
 } catch {
 return isoDateString;
 }
}

/**
 * Format strictly relative time in Bengali (e.g. '৩ মিনিট আগে', '১ ঘণ্টা আগে', 'এইমাত্র')
 */
export function formatBanglaRelativeTime(isoDateString?: string | null): string {
 if (!isoDateString) return '';
 try {
 const date = new Date(isoDateString);
 if (isNaN(date.getTime())) return isoDateString;

 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 if (diffMs < 0) return 'এইমাত্র';

 const diffMins = Math.floor(diffMs / (1000 * 60));
 const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
 const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

 if (diffMins < 1) return 'এইমাত্র';
 if (diffMins < 60) return `${toBengaliNumerals(diffMins)} মিনিট আগে`;
 if (diffHours < 24) return `${toBengaliNumerals(diffHours)} ঘণ্টা আগে`;
 if (diffDays === 1) return 'গতকাল';
 if (diffDays < 30) return `${toBengaliNumerals(diffDays)} দিন আগে`;

 return date.toLocaleDateString('bn-BD', {
 year: 'numeric',
 month: 'short',
 day: 'numeric',
 });
 } catch {
 return isoDateString;
 }
}

/**
 * Helper to determine Bengali period: সকাল, দুপুর, বিকাল, সন্ধ্যা, রাত
 */
export function getBanglaPeriod(hour24: number): string {
 if (hour24 >= 5 && hour24 < 12) return 'সকাল';
 if (hour24 >= 12 && hour24 < 15) return 'দুপুর';
 if (hour24 >= 15 && hour24 < 18) return 'বিকাল';
 if (hour24 >= 18 && hour24 < 20) return 'সন্ধ্যা';
 return 'রাত';
}

/**
 * Format follow-up date and optional time in Bengali (Asia/Dhaka)
 * e.g. "৮ নভেম্বর, বিকাল ৪:০০" or "৮ নভেম্বর" (if no time specified)
 */
export function formatBanglaFollowUpDateTime(dateStr?: string | null): string {
 if (!dateStr) return 'তারিখ সেট নেই';
 try {
 const tz = 'Asia/Dhaka';
 const trimmed = dateStr.trim();
 const hasTime = trimmed.includes('T') || (trimmed.includes(':') && trimmed.includes(' '));

 // Handle plain YYYY-MM-DD cleanly without timezone shift
 if (!hasTime && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
 const [y, m, d] = trimmed.split('-').map(Number);
 const localDate = new Date(y, m - 1, d);
 return localDate.toLocaleDateString('bn-BD', {
 day: 'numeric',
 month: 'long',
 });
 }

 const date = new Date(trimmed);
 if (isNaN(date.getTime())) return dateStr;

 const dayMonth = date.toLocaleDateString('bn-BD', {
 timeZone: tz,
 day: 'numeric',
 month: 'long',
 });

 if (!hasTime) {
 return dayMonth;
 }

 const timeStr = new Intl.DateTimeFormat('en-GB', {
 timeZone: tz,
 hour: '2-digit',
 minute: '2-digit',
 hour12: false,
 }).format(date);

 const [hStr, mStr] = timeStr.split(':');
 const hour24 = parseInt(hStr, 10);
 const hour12 = hour24 % 12 || 12;
 const period = getBanglaPeriod(hour24);

 return `${dayMonth}, ${period} ${toBengaliNumerals(hour12)}:${toBengaliNumerals(mStr)}`;
 } catch {
 return dateStr;
 }
}

/**
 * Returns the status pill info for follow-up date
 * - আজ হলে "আজ" (কমলা)
 * - ভবিষ্যতে হলে "২ দিন বাকি" (নীল)
 * - পার হয়ে গেলে "৩ দিন ওভারডিউ" (লাল)
 * - স্ট্যাটাস "কাস্টমার হয়েছে" বা "হারানো" হলে ওভারডিউ দেখাবে না
 */
export function getFollowUpStatusInfo(
 dateStr?: string | null,
 status?: LeadStatus
): {
 type: 'none' | 'today' | 'future' | 'overdue' | 'resolved';
 label: string;
 badgeClass: string;
} {
 if (!dateStr || !dateStr.trim()) {
 return {
 type: 'none',
 label: 'তারিখ সেট নেই',
 badgeClass: 'text-[var(--badge-gray-text)] bg-[var(--badge-gray-bg)] border border-[var(--badge-gray-border)]',
 };
 }

 try {
 const tz = 'Asia/Dhaka';
 const now = new Date();
 const todayDhaka = now.toLocaleString('en-CA', { timeZone: tz }).split(',')[0];

 let targetDhaka = '';
 const trimmed = dateStr.trim();
 if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
 targetDhaka = trimmed.substring(0, 10);
 } else {
 const d = new Date(trimmed);
 if (!isNaN(d.getTime())) {
 targetDhaka = d.toLocaleString('en-CA', { timeZone: tz }).split(',')[0];
 }
 }

 if (!targetDhaka) {
 return {
 type: 'none',
 label: 'তারিখ সেট নেই',
 badgeClass: 'text-[var(--badge-gray-text)] bg-[var(--badge-gray-bg)] border border-[var(--badge-gray-border)]',
 };
 }

 const tTime = new Date(`${targetDhaka}T00:00:00Z`).getTime();
 const todayTime = new Date(`${todayDhaka}T00:00:00Z`).getTime();
 const diffDays = Math.round((tTime - todayTime) / (1000 * 60 * 60 * 24));

 if (diffDays === 0) {
 return {
 type: 'today',
 label: 'আজ',
 badgeClass: 'text-[var(--badge-amber-text)] bg-[var(--badge-amber-bg)] border border-[var(--badge-amber-border)]',
 };
 }

 if (diffDays > 0) {
 const label = diffDays === 1 ? 'আগামীকাল' : `${toBengaliNumerals(diffDays)} দিন বাকি`;
 return {
 type: 'future',
 label,
 badgeClass: 'text-[var(--badge-blue-text)] bg-[var(--badge-blue-bg)] border border-[var(--badge-blue-border)]',
 };
 }

 // diffDays < 0 (overdue)
 if (status === 'won' || status === 'confirmed') {
 return {
 type: 'resolved',
 label: 'সম্পন্ন',
 badgeClass: 'text-[var(--badge-gray-text)] bg-[var(--badge-gray-bg)] border border-[var(--badge-gray-border)]',
 };
 }

 const overdueDays = Math.abs(diffDays);
 return {
 type: 'overdue',
 label: `${toBengaliNumerals(overdueDays)} দিন ওভারডিউ`,
 badgeClass: 'text-[var(--badge-red-text)] bg-[var(--badge-red-bg)] border border-[var(--badge-red-border)]',
 };
 } catch {
 return {
 type: 'none',
 label: 'তারিখ সেট নেই',
 badgeClass: 'text-[var(--badge-gray-text)] bg-[var(--badge-gray-bg)] border border-[var(--badge-gray-border)]',
 };
 }
}

/**
 * Formats a date only (e.g. for follow-up date)
 */
export function formatBanglaDateOnly(dateString?: string | null): string {
 return formatBanglaFollowUpDateTime(dateString);
}

/**
 * Format currency in Bangladeshi Taka
 */
export function formatTaka(amount?: number): string {
 if (amount === undefined || amount === null) return '৳ ০';
 return `৳ ${toBengaliNumerals(amount.toLocaleString('en-IN'))}`;
}

/**
 * Exports leads to CSV format with UTF-8 BOM so Excel displays Bengali cleanly
 */
export function exportLeadsToCSV(leads: Lead[], filename = 'leads-export.csv'): void {
 const headers = [
 'নাম',
 'ফোন নম্বর',
 'মূল সোর্স',
 'সব সোর্স (মার্জড)',
 'ফেসবুক পেজ',
 'পেজ ID',
 'প্রোডাক্ট/সার্ভিস',
 'স্ট্যাটাস',
 'ট্যাগসমূহ',
 'প্রথম মেসেজ',
 'অ্যাসাইন করা',
 'তৈরির সময়',
 'পরবর্তী ফলো-আপ',
 'আনুমানিক মূল্য (টাকা)',
 ];

 const escapeCSV = (field: string | number | undefined | null): string => {
 if (field === null || field === undefined) return '""';
 const stringVal = String(field);
 return `"${stringVal.replace(/"/g, '""')}"`;
 };

 const rows = leads.map((lead) => [
 escapeCSV(lead.name),
 escapeCSV(formatBdPhoneNumber(lead.phone)),
 escapeCSV(SOURCE_LABELS[lead.source] || lead.source),
 escapeCSV(lead.sources.map((s) => SOURCE_LABELS[s] || s).join(', ')),
 escapeCSV(lead.pageName || ''),
 escapeCSV(lead.pageId || ''),
 escapeCSV(lead.productInterest),
 escapeCSV(STATUS_LABELS[lead.status] || lead.status),
 escapeCSV(lead.tags.join(', ')),
 escapeCSV(lead.message),
 escapeCSV(lead.assignedTo || 'অ্যাসাইন করা নেই'),
 escapeCSV(formatBanglaDateTime(lead.createdAt)),
 escapeCSV(lead.nextFollowUpDate ? formatBanglaDateOnly(lead.nextFollowUpDate) : 'নেই'),
 escapeCSV(lead.estimatedValue || 0),
 ]);

 const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

 // Add UTF-8 BOM (\uFEFF) for Excel Bengali character rendering
 const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.setAttribute('href', url);
 link.setAttribute('download', filename);
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 URL.revokeObjectURL(url);
}

export interface LeadCommentMessageInfo {
 commentText?: string;
 commentTime?: string;
 commentUrl?: string;
 messageText?: string;
 messageTime?: string;
 hasComment: boolean;
 hasMessenger: boolean;
 isMergedFacebookMessenger: boolean;
}

/**
 * Extracts normalized comment and messenger information from a lead,
 * inspecting top-level fields (lastComment, lastMessage), activities, and channels.
 */
export function getLeadCommentAndMessageInfo(lead: Lead): LeadCommentMessageInfo {
 const sources = Array.isArray(lead.sources) && lead.sources.length > 0 ? lead.sources : [lead.source];
 const hasFbSource = sources.includes('facebook') || lead.source === 'facebook';
 const hasMsgSource = sources.includes('messenger') || lead.source === 'messenger';

 // 1. Comment extraction
 let commentText: string | undefined = lead.lastComment?.trim() || undefined;
 let commentTime: string | undefined = lead.lastCommentAt || undefined;
 let commentUrl: string | undefined = lead.commentUrl || lead.lastPostLink || undefined;

 // Search activities if not on top-level
 if (!commentText && lead.activities && Array.isArray(lead.activities)) {
 const commentAct = lead.activities.find(
 (a) => a.channel === 'comment' || (a.type as string) === 'comment' || (a.description && a.description.includes('কমেন্ট'))
 );
 if (commentAct) {
 const desc = commentAct.details || commentAct.description || '';
 const clean = desc
 .replace(/^Facebook\s*কমেন্ট:\s*/i, '')
 .replace(/^কমেন্ট:\s*/i, '')
 .replace(/^["'“”‘’]|["'“”‘’]$/g, '')
 .trim();
 if (clean) {
 commentText = clean;
 commentTime = commentTime || commentAct.timestamp;
 commentUrl = commentUrl || commentAct.postLink;
 }
 }
 }

 // If lead's primary interaction was a comment and lastMessage is present
 if (!commentText && (lead.lastChannel === 'comment' || (hasFbSource && !hasMsgSource))) {
 commentText = lead.lastMessage || lead.message;
 commentTime = commentTime || lead.lastMessageAt || lead.createdAt;
 }

 // 2. Messenger message extraction
 let messageText: string | undefined = lead.lastMessage?.trim() || undefined;
 let messageTime: string | undefined = lead.lastMessageAt || undefined;

 // If lastChannel was comment but lead also has Messenger, look in activities for latest Messenger message
 if (hasMsgSource && lead.lastChannel === 'comment' && lead.activities && Array.isArray(lead.activities)) {
 const msgAct = lead.activities.find(
 (a) => a.channel === 'messenger' || (a.type as string) === 'messenger' || (a.description && a.description.includes('Messenger'))
 );
 if (msgAct) {
 const desc = msgAct.details || msgAct.description || '';
 const clean = desc
 .replace(/^Messenger-এ\s*নতুন\s*মেসেজ:\s*/i, '')
 .replace(/^মেসেঞ্জার:\s*/i, '')
 .replace(/^["'“”‘’]|["'“”‘’]$/g, '')
 .trim();
 if (clean) {
 messageText = clean;
 messageTime = msgAct.timestamp || messageTime;
 }
 }
 }

 if (!messageText && hasMsgSource) {
 messageText = lead.message || undefined;
 messageTime = messageTime || lead.createdAt;
 }

 const hasComment = Boolean(
 hasFbSource ||
 lead.lastComment ||
 lead.lastPostLink ||
 lead.commentUrl ||
 lead.lastChannel === 'comment' ||
 Boolean(commentText)
 );

 const hasMessenger = Boolean(
 hasMsgSource ||
 lead.messengerId ||
 lead.lastChannel === 'messenger' ||
 (hasMsgSource && Boolean(messageText))
 );

 const isMergedFacebookMessenger = hasComment && hasMessenger;

 return {
 commentText,
 commentTime,
 commentUrl,
 messageText,
 messageTime,
 hasComment,
 hasMessenger,
 isMergedFacebookMessenger,
 };
}

