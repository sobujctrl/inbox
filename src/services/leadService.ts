import {
 collection,
 doc,
 setDoc,
 deleteDoc,
 getDocs,
 onSnapshot,
 query,
 where,
 writeBatch,
 getDoc,
} from 'firebase/firestore';
import { Lead, LeadActivity, LeadNote, LeadSource, LeadStatus } from '../types/lead';
import { INITIAL_DEMO_LEADS } from '../data/demoLeads';
import { normalizeBdPhoneNumber, formatBdPhoneNumber } from '../utils/phone';
import { SOURCE_LABELS, STATUS_LABELS, toBengaliNumerals } from '../utils/formatters';

const BENGALI_MONTHS = [
 'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

export function getMonthKey(isoString?: string | null): string {
 if (!isoString) return '';
 try {
 const d = new Date(isoString);
 if (isNaN(d.getTime())) return '';
 // Format YYYY-MM in Asia/Dhaka using Intl.DateTimeFormat
 const formatted = new Intl.DateTimeFormat('en-CA', {
 timeZone: 'Asia/Dhaka',
 year: 'numeric',
 month: '2-digit',
 }).format(d);
 return formatted.substring(0, 7); // Ensure YYYY-MM
 } catch {
 return '';
 }
}

export function getBengaliMonthLabel(year: number, month: number): string {
 const monthName = BENGALI_MONTHS[month - 1] || 'অজ্ঞাত';
 const yearBn = toBengaliNumerals(year);
 return `${monthName} ${yearBn}`;
}
import { initializeFirebaseInstances, isFirebaseConfigured, getActiveDatabaseId, getSavedFirebaseConfig, saveFirebaseConfig } from '../firebase/config';

export interface FirestoreDebugInfo {
 uid: string;
 databaseId: string;
 path: string;
 docCount: number;
 status: 'connected' | 'error' | 'loading';
 errorCode?: string;
 errorMessage?: string;
 lastUpdated: string;
}

const STORAGE_KEY = 'unified_lead_inbox_leads_v1';
const FIRESTORE_CACHE_KEY = 'unified_lead_inbox_firestore_v2';
const TEAM_MEMBERS_KEY = 'unified_lead_inbox_team_v1';
const TAGS_KEY = 'unified_lead_inbox_tags_v1';

// Real-time multi-tab BroadcastChannel
const broadcastChannel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
 ? new BroadcastChannel('unified_lead_sync_channel')
 : null;

if (broadcastChannel) {
 broadcastChannel.onmessage = (event) => {
 if (event.data?.type === 'leads_updated') {
 window.dispatchEvent(new CustomEvent('leads_storage_updated'));
 }
 };
}

if (typeof window !== 'undefined') {
 window.addEventListener('storage', (e) => {
 if (e.key === STORAGE_KEY || e.key === FIRESTORE_CACHE_KEY) {
 window.dispatchEvent(new CustomEvent('leads_storage_updated'));
 }
 });
}

export interface AddLeadResult {
 isDuplicate: boolean;
 lead: Lead;
 mergedSources?: LeadSource[];
 notificationMessage: string;
}

export const NEW_LEADS_BASELINE = '2026-11-08T00:00:00+06:00';

/**
 * Returns whether a lead is "new" for a specific user.
 */
export function isLeadNew(lead?: Lead | null, userId?: string | null, baseline = NEW_LEADS_BASELINE): boolean {
  if (!lead) return false;

  // 1. Per-user seen check
  if (userId && lead.seenBy && lead.seenBy[userId]) return false;

  // 2. Legacy seenAt check (for owner only, or if no userId provided)
  // Since we don't know the ownerUid here, we check seenAt as a fallback.
  // If seenAt exists and we are the one who saw it (or we are checking globally), return false.
  if (lead.seenAt && (!userId || lead.id.includes(userId || ''))) return false;

  if (!lead.createdAt) return false;
  const leadTime = new Date(lead.createdAt).getTime();
  const baselineTime = new Date(baseline).getTime();
  if (isNaN(leadTime) || isNaN(baselineTime)) return false;
  return leadTime >= baselineTime;
}

export interface MonthOption {
 key: string; // 'YYYY-MM' or 'all'
 label: string; // 'নভেম্বর ২০২৬' or 'সব সময়'
 count: number;
 year: number;
 month: number;
}

export interface SummaryStats {
 totalLeads: number;

 // Monthly stats for the "Total Leads" box
 totalLeadsInSelectedMonth: number;
 pipelineValueInSelectedMonth: number;
 availableMonths: MonthOption[];

 // 9 New lead boxes
 newLeadsCount: number;
 totalNewStatusCount: number;

 newFollowUpCount: number;
 totalFollowUpCount: number;

 newWonCount: number;
 totalWonCount: number;
 wonValue: number;

 newCancelledCount: number;
 totalCancelledCount: number;
 cancelledValue: number;

 newFacebookCount: number;
 totalFacebookCount: number;

 newMessengerCount: number;
 totalMessengerCount: number;

 newWhatsappCount: number;
 totalWhatsappCount: number;

 newWebsiteCount: number;
 totalWebsiteCount: number;

 newManualCount: number;
 totalManualCount: number;

 // 3 Total lead boxes
 totalPendingCount: number;
 pendingValue: number;

 totalHoldCount: number;
 holdValue: number;

 // Backward compatibility & legacy fields
 todayNewLeads: number;
 todayFollowUpCount: number;
 overdueFollowUpCount: number;
 facebookCount: number;
 messengerCount: number;
 whatsappCount: number;
 websiteCount: number;
 manualCount: number;
 wonCount: number;
 cancelledCount: number;
 holdCount: number;
 pendingCount: number;
 totalEstimatedPipelineValue: number;
 unreadCount: number;
 totalUnreadNewLeadsCount: number;
}

export interface FirestoreErrorPayload {
 code: string;
 message: string;
 details: string;
}

/**
 * Safely parse any date value (Firestore Timestamp, ISO string, epoch number, numeric string)
 * into a valid ISO 8601 string.
 */
export function safeToIsoString(val: any, fallback?: string): string {
 const fallbackVal = fallback || new Date().toISOString();
 if (val === null || val === undefined || val === '') return fallbackVal;

 // Firestore Timestamp object: has .toDate() function
 if (typeof val === 'object') {
 if (typeof val.toDate === 'function') {
 try {
 const d = val.toDate();
 if (d instanceof Date && !isNaN(d.getTime())) {
 return d.toISOString();
 }
 } catch {}
 }
 // Firestore Timestamp representation: { seconds: number, nanoseconds?: number } or { _seconds: number }
 const secs = val.seconds ?? val._seconds;
 if (typeof secs === 'number' && !isNaN(secs)) {
 try {
 const d = new Date(secs * 1000);
 if (!isNaN(d.getTime())) {
 return d.toISOString();
 }
 } catch {}
 }
 }

 // Number: epoch timestamp (seconds or milliseconds)
 if (typeof val === 'number' && !isNaN(val)) {
 if (val < 1e11) {
 return new Date(val * 1000).toISOString();
 }
 return new Date(val).toISOString();
 }

 // String: ISO, YYYY-MM-DD, or numeric string
 if (typeof val === 'string') {
 const trimmed = val.trim();
 if (!trimmed) return fallbackVal;
 if (/^\d+$/.test(trimmed)) {
 const num = Number(trimmed);
 return safeToIsoString(num, fallbackVal);
 }
 const d = new Date(trimmed);
 if (!isNaN(d.getTime())) {
 return d.toISOString();
 }
 }

 return fallbackVal;
}

/**
 * Returns YYYY-MM-DD date string in Asia/Dhaka timezone for any valid date value.
 */
export function getDhakaDateString(isoString?: string | null): string {
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
 * Returns ISO date strings for start and end of various date ranges in Asia/Dhaka timezone.
 */
export function getDateRangeBoundaries(
 range: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth'
): { start: string; end: string } {
 const now = new Date();
 const tz = 'Asia/Dhaka';
 
 const getD = (d: Date) => d.toLocaleString('en-CA', { timeZone: tz }).split(',')[0];

 switch (range) {
 case 'today': {
 const d = getD(now);
 return { start: d, end: d };
 }
 case 'yesterday': {
 const d = new Date(now);
 d.setDate(d.getDate() - 1);
 const dy = getD(d);
 return { start: dy, end: dy };
 }
 case 'last7days': {
 const end = new Date(now);
 const start = new Date(now);
 start.setDate(start.getDate() - 6);
 return { start: getD(start), end: getD(end) };
 }
 case 'last30days': {
 const end = new Date(now);
 const start = new Date(now);
 start.setDate(start.getDate() - 29);
 return { start: getD(start), end: getD(end) };
 }
 case 'thisMonth': {
 const start = new Date(now.getFullYear(), now.getMonth(), 1);
 return { start: getD(start), end: getD(now) };
 }
 case 'lastMonth': {
 const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
 const end = new Date(now.getFullYear(), now.getMonth(), 0);
 return { start: getD(start), end: getD(end) };
 }
 default:
 return { start: '', end: '' };
 }
}

/**
 * Normalizes any raw source into a valid LeadSource ('facebook' | 'messenger' | 'whatsapp' | 'manual')
 */
export function normalizeLeadSource(src?: any, hasMessengerId?: boolean): LeadSource {
 if (!src) return hasMessengerId ? 'messenger' : 'facebook';
 const s = String(src).toLowerCase().trim();
 if (s.includes('messenger') || s === 'msg' || s === 'chat') return 'messenger';
 if (s.includes('whatsapp') || s === 'wa') return 'whatsapp';
 if (s.includes('web') || s.includes('ওয়েবসাইট') || s === 'site') return 'website';
 if (s.includes('manual') || s === 'offline') return 'manual';
 if (s.includes('face') || s.includes('fb') || s.includes('meta') || s.includes('comment')) return 'facebook';
 return hasMessengerId ? 'messenger' : 'facebook';
}

/**
 * Normalizes any status into a valid LeadStatus ('new' | 'contacted' | 'followup' | 'won' | 'lost')
 */
export function normalizeLeadStatus(st?: any): LeadStatus {
 if (!st) return 'new';
 const s = String(st).toLowerCase().trim();
 if (s === 'contacted' || s === 'contact' || s === 'যোগাযোগ করা হয়েছে') return 'contacted';
 if (s === 'followup' || s === 'follow_up' || s === 'follow-up' || s === 'ফলোআপ') return 'followup';
 if (s === 'pending' || s === 'পেন্ডিং') return 'pending';
 if (s === 'confirmed' || s === 'কনফার্ম') return 'confirmed';
 if (s === 'won' || s === 'closed_won' || s === 'সফল') return 'won';
 if (s === 'cancelled' || s === 'cancel' || s === 'ক্যান্সেল') return 'cancelled';
 if (s === 'hold' || s === 'হোল্ড') return 'hold';
 return 'new'; // 'new', 'NEW', 'New', 'open', 'unread', etc. default to 'new'
}

/**
 * Normalizes raw document data from Firestore / n8n into a fully-typed, robust Lead object.
 * Applies comprehensive defaults for all omitted or optional fields.
 */
export function normalizeFirestoreLead(docId: string, rawData: any): Lead {
 const raw = rawData || {};
 const docKey = docId || String(raw.id || `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);

 // Messenger ID (handle integer, string, psid, sender_id)
 const rawMessengerId = raw.messengerId ?? raw.messenger_id ?? raw.psid ?? raw.sender_id ?? raw.senderId ?? null;
 const messengerId = rawMessengerId !== null && rawMessengerId !== undefined && String(rawMessengerId).trim() !== ''
 ? String(rawMessengerId).trim()
 : undefined;

 // Phone (handle number, string, phone_number, mobile)
 const rawPhone = raw.phone ?? raw.phoneNumber ?? raw.phone_number ?? raw.mobile ?? raw.contact ?? raw.originalPhone ?? raw.original_phone ?? null;
 let cleanPhoneStr: string | undefined = undefined;
 let normalizedPhone: string | undefined = undefined;
 if (rawPhone !== null && rawPhone !== undefined && String(rawPhone).trim() !== '') {
 cleanPhoneStr = String(rawPhone).trim();
 const norm = normalizeBdPhoneNumber(cleanPhoneStr);
 normalizedPhone = norm || cleanPhoneStr;
 }

 // Name (handle full_name, sender_name, customer_name, lead_name, etc.)
 const rawName = raw.name ?? raw.fullName ?? raw.full_name ?? raw.sender_name ?? raw.lead_name ?? raw.customer_name ?? raw.userName ?? raw.user_name ?? null;
 let name = rawName ? String(rawName).trim() : '';
 if (!name) {
 if (normalizedPhone) {
 name = `গ্রাহক (${formatBdPhoneNumber(normalizedPhone)})`;
 } else if (messengerId) {
 name = `Messenger User (${messengerId.slice(-4)})`;
 } else {
 name = 'নতুন লিড (n8n)';
 }
 }

 // Sources & Primary Source
 const rawSource = raw.source ?? raw.channel ?? raw.platform ?? raw.lead_source ?? null;
 const primarySource = normalizeLeadSource(rawSource, Boolean(messengerId));

 let sourcesList: LeadSource[] = [];
 const rawSources = raw.sources ?? raw.channels ?? null;
 if (Array.isArray(rawSources)) {
 sourcesList = rawSources.map((s) => normalizeLeadSource(s, Boolean(messengerId))).filter((v, i, a) => a.indexOf(v) === i);
 } else if (typeof rawSources === 'string' && rawSources.trim()) {
 sourcesList = rawSources.split(',').map((s) => normalizeLeadSource(s, Boolean(messengerId))).filter((v, i, a) => a.indexOf(v) === i);
 }
 if (sourcesList.length === 0) {
 sourcesList = [primarySource];
 } else if (!sourcesList.includes(primarySource)) {
 sourcesList.unshift(primarySource);
 }

 // Dates
 const nowIso = new Date().toISOString();
 const rawCreatedAt = raw.createdAt ?? raw.created_at ?? raw.timestamp ?? raw.created_time ?? raw.time ?? raw.date ?? null;
 const createdAt = safeToIsoString(rawCreatedAt, nowIso);

 const rawUpdatedAt = raw.updatedAt ?? raw.updated_at ?? rawCreatedAt ?? null;
 const updatedAt = safeToIsoString(rawUpdatedAt, createdAt);

 // Message & Last Message
 const rawMessage = raw.message ?? raw.lastMessage ?? raw.last_message ?? raw.text ?? raw.comment ?? raw.body ?? raw.lead_message ?? '';
 const message = typeof rawMessage === 'string' ? rawMessage.trim() : (rawMessage ? String(rawMessage) : '');

 const rawLastMsg = raw.lastMessage ?? raw.last_message ?? raw.message ?? null;
 const lastMessage = rawLastMsg ? (typeof rawLastMsg === 'string' ? rawLastMsg.trim() : String(rawLastMsg)) : (message || undefined);

 const rawLastMsgAt = raw.lastMessageAt ?? raw.last_message_at ?? rawCreatedAt ?? null;
 const lastMessageAt = rawLastMsgAt ? safeToIsoString(rawLastMsgAt, createdAt) : (message ? createdAt : undefined);

 // Status
 const status = normalizeLeadStatus(raw.status ?? raw.lead_status);

 // Tags
 let tags: string[] = [];
 const rawTags = raw.tags ?? raw.tag ?? null;
 if (Array.isArray(rawTags)) {
 tags = rawTags.map((t) => (typeof t === 'string' ? t.trim() : (t?.name ? String(t.name).trim() : ''))).filter(Boolean);
 } else if (typeof rawTags === 'string' && rawTags.trim()) {
 tags = rawTags.split(',').map((t) => t.trim()).filter(Boolean);
 }

 // Notes
 let notes: LeadNote[] = [];
 if (Array.isArray(raw.notes) && raw.notes.length > 0) {
 notes = raw.notes.map((n: any, idx: number) => ({
 id: String(n.id || `note-${idx}-${Date.now()}`),
 content: String(n.content || n.text || ''),
 createdAt: safeToIsoString(n.createdAt || n.created_at, createdAt),
 author: String(n.author || 'সিস্টেম / n8n'),
 })).filter((n: LeadNote) => n.content.trim() !== '');
 } else if (typeof raw.notes === 'string' && raw.notes.trim()) {
 notes = [
 {
 id: `note-${Date.now()}`,
 content: raw.notes.trim(),
 createdAt,
 author: 'n8n',
 },
 ];
 } else if (typeof raw.note === 'string' && raw.note.trim()) {
 notes = [
 {
 id: `note-${Date.now()}`,
 content: raw.note.trim(),
 createdAt,
 author: 'n8n',
 },
 ];
 }

 // Activities
 let activities: LeadActivity[] = [];
 if (Array.isArray(raw.activities) && raw.activities.length > 0) {
 activities = raw.activities.map((a: any, idx: number) => ({
 id: String(a.id || `act-${idx}-${Date.now()}`),
 type: String(a.type || 'created') as any,
 description: String(a.description || a.details || 'কার্যক্রম'),
 timestamp: safeToIsoString(a.timestamp || a.createdAt, createdAt),
 details: a.details ? String(a.details) : undefined,
 postLink: a.postLink ? String(a.postLink) : undefined,
 channel: a.channel ? String(a.channel) : undefined,
 }));
 } else {
 activities = [
 {
 id: `act-init-${docKey}`,
 type: 'created',
 description: `${primarySource.toUpperCase()} থেকে লিড সংগৃহীত হয়েছে (n8n/Firestore)`,
 timestamp: createdAt,
 channel: primarySource === 'messenger' ? 'messenger' : (primarySource === 'facebook' ? 'comment' : undefined),
 },
 ];
 }

 // Follow-up Date (Requirement 1 & 2: cannot be before createdAt, default to today/lastMessageAt if missing or outdated)
 const todayDhaka = getDhakaDateString(nowIso);
 const createdDhaka = getDhakaDateString(createdAt);
 const lastMsgDhaka = lastMessageAt ? getDhakaDateString(lastMessageAt) : createdDhaka;

 let followUpDate: string | null = null;
 const rawFollowUp = raw.followUpDate ?? raw.follow_up_date ?? raw.nextFollowUpDate ?? raw.next_follow_up_date ?? null;
 if (rawFollowUp) {
 const parsedFollowUp = safeToIsoString(rawFollowUp, '');
 if (parsedFollowUp) {
 followUpDate = parsedFollowUp.split('T')[0];
 } else if (typeof rawFollowUp === 'string' && rawFollowUp.trim()) {
 followUpDate = rawFollowUp.trim();
 }
 }

 if (!followUpDate || followUpDate < createdDhaka || (followUpDate < todayDhaka && lastMsgDhaka === todayDhaka)) {
 followUpDate = lastMsgDhaka >= todayDhaka ? lastMsgDhaka : todayDhaka;
 }

 // Page info
 const rawPageId = raw.pageId ?? raw.page_id ?? raw.pageID ?? raw.facebook_page_id ?? null;
 const pageId = rawPageId ? String(rawPageId).trim() : undefined;

 const rawPageName = raw.pageName ?? raw.page_name ?? raw.pageTitle ?? raw.page_title ?? null;
 const pageName = rawPageName ? String(rawPageName).trim() : undefined;

 // Channel & Post Link
 const rawLastChannel = raw.lastChannel ?? raw.last_channel ?? raw.channel ?? null;
 const cleanLastChannel = rawLastChannel
 ? String(rawLastChannel).trim().toLowerCase()
 : (messengerId ? 'messenger' : (pageId || primarySource === 'facebook' ? 'comment' : undefined));

 const rawPostId = raw.lastPostId ?? raw.last_post_id ?? raw.postId ?? raw.post_id ?? null;
 const lastPostId = rawPostId ? String(rawPostId).trim() : undefined;

 const rawPostLink = raw.lastPostLink ?? raw.last_post_link ?? raw.postLink ?? raw.post_link ?? null;
 const lastPostLink = rawPostLink ? String(rawPostLink).trim() : undefined;

 const rawLastComment = raw.lastComment ?? raw.last_comment ?? raw.commentText ?? raw.comment_text ?? raw.facebookComment ?? null;
 const lastComment = rawLastComment && String(rawLastComment).trim() !== '' ? String(rawLastComment).trim() : undefined;

 const rawLastCommentAt = raw.lastCommentAt ?? raw.last_comment_at ?? raw.commentTime ?? raw.comment_time ?? null;
 const lastCommentAt = rawLastCommentAt ? safeToIsoString(rawLastCommentAt, createdAt) : undefined;

 const rawCommentUrl = raw.commentUrl ?? raw.comment_url ?? raw.commentLink ?? raw.comment_link ?? lastPostLink;
 const commentUrl = rawCommentUrl && String(rawCommentUrl).trim() !== '' ? String(rawCommentUrl).trim() : undefined;

 const rawProfileLink = raw.profileLink ?? raw.profile_link ?? raw.facebook_profile ?? null;
 const profileLink = rawProfileLink ? String(rawProfileLink).trim() : undefined;

 return {
 id: docKey,
 name,
 phone: normalizedPhone,
 originalPhone: cleanPhoneStr || normalizedPhone,
 messengerId,
 profileLink,
 lastChannel: cleanLastChannel as any,
 lastMessage,
 lastMessageAt,
 lastPostId,
 lastPostLink,
 lastComment,
 lastCommentAt,
 commentUrl,
 source: primarySource,
 sources: sourcesList,
 productInterest: raw.productInterest || raw.product_interest || raw.product || 'সাধারণ অনুসন্ধান',
 message,
 status,
 tags,
 createdAt,
 updatedAt,
 followUpDate,
 nextFollowUpDate: followUpDate,
 assignedTo: raw.assignedTo || raw.assigned_to || raw.assignee || null,
 notes,
 activities,
 estimatedValue: typeof raw.estimatedValue === 'number' ? raw.estimatedValue : (Number(raw.value || raw.amount) || 0),
 isStarred: Boolean(raw.isStarred ?? raw.is_starred ?? raw.starred ?? false),
 lastSeenAt: raw.lastSeenAt ? safeToIsoString(raw.lastSeenAt, nowIso) : undefined,
 pageId,
 pageName,
 seenAt: (raw.seenAt ?? raw.seen_at) ? safeToIsoString(raw.seenAt ?? raw.seen_at, nowIso) : undefined,
 seenBy: raw.seenBy || {},
 createdBy: raw.createdBy,
 updatedBy: raw.updatedBy,
 };
}

class LeadService {
 private workspaceOwnerId: string | null = null;
 private currentOperator: { uid: string; name: string } | null = null;

 /**
 * Set the workspace owner UID (where leads are stored)
 */
 public setWorkspaceOwnerId(ownerId?: string | null): void {
  this.workspaceOwnerId = ownerId || null;
 }

 /**
 * Set the active user performing operations
 */
 public setCurrentOperator(uid: string, name: string): void {
  this.currentOperator = { uid, name };
 }

 /**
 * For backward compatibility - sets the workspace owner
 */
 public setActiveUserId(userId?: string | null): void {
  this.workspaceOwnerId = userId || null;
 }

 /**
 * Returns the UID of the workspace owner
 */
 public getActiveUserId(): string | null {
  if (this.workspaceOwnerId) return this.workspaceOwnerId;
  const { auth } = initializeFirebaseInstances();
  return auth?.currentUser?.uid || null;
 }

 public getCurrentOperator() {
  return this.currentOperator;
 }

 /**
 * Returns user-isolated localStorage key
 */
 private getStorageKey(userId?: string | null): string {
 const uid = userId || this.getActiveUserId();
 return uid ? `unified_lead_inbox_leads_${uid}` : STORAGE_KEY;
 }

 /**
 * Returns user-isolated Firestore cache key
 */
 private getFirestoreCacheKey(userId?: string | null): string {
 const uid = userId || this.getActiveUserId();
 return uid ? `unified_lead_inbox_firestore_${uid}` : FIRESTORE_CACHE_KEY;
 }

 /**
 * Retrieves all leads for the current user.
 * If Firebase is configured, reads strictly from Firestore cache and NEVER from old localStorage mock data.
 */
 public getLeads(userId?: string | null): Lead[] {
 const isFb = isFirebaseConfigured();
 const cacheKey = isFb ? this.getFirestoreCacheKey(userId) : this.getStorageKey(userId);

 try {
 const stored = localStorage.getItem(cacheKey);
 if (stored !== null) {
 const parsed = JSON.parse(stored);
 if (Array.isArray(parsed)) {
 return parsed.map((item) => normalizeFirestoreLead(item.id, item));
 }
 }
 } catch (e) {
 console.error('Error reading leads from storage:', e);
 }
 // Default is empty array
 return [];
 }

 /**
 * Saves leads array to user-isolated storage and broadcasts update event
 */
 public saveLeads(leads: Lead[], userId?: string | null): void {
 const isFb = isFirebaseConfigured();
 const cacheKey = isFb ? this.getFirestoreCacheKey(userId) : this.getStorageKey(userId);

 try {
 localStorage.setItem(cacheKey, JSON.stringify(leads));
 window.dispatchEvent(new CustomEvent('leads_storage_updated'));
 broadcastChannel?.postMessage({ type: 'leads_updated' });
 } catch (e) {
 console.error('Error saving leads to storage:', e);
 }
 }

 /**
 * Real-time Firestore subscription via onSnapshot for users/{uid}/leads.
 * If Firestore is configured, attaches a real-time listener to the logged-in user's subcollection.
 * Any lead written by n8n or webhooks is automatically normalized and safely rendered with defaults.
 * Emits debugInfo containing UID, database ID, path, docCount, and error info.
 */
 public subscribeToLeads(
 onUpdate: (leads: Lead[], debugInfo?: FirestoreDebugInfo) => void,
 onError?: (error: FirestoreErrorPayload, debugInfo?: FirestoreDebugInfo) => void,
 userId?: string | null
 ): () => void {
 if (userId) {
 this.workspaceOwnerId = userId;
 }
 const { db, auth } = initializeFirebaseInstances();
 const uid = userId || this.getActiveUserId() || auth?.currentUser?.uid || '';
 const activeDbId = getActiveDatabaseId();
 const collectionPath = uid ? `users/${uid}/leads` : 'users/{uid}/leads';

 if (isFirebaseConfigured() && db && uid) {
 try {
 const leadsCol = collection(db, 'users', uid, 'leads');
 const unsubscribe = onSnapshot(
 leadsCol,
 (snapshot) => {
 const firestoreLeads: Lead[] = [];
 snapshot.forEach((docSnapshot) => {
 const data = docSnapshot.data() as any;
 const leadItem = normalizeFirestoreLead(docSnapshot.id, data);
 firestoreLeads.push(leadItem);
 });

 // Sort newest first safely with parsed ISO strings
 firestoreLeads.sort((a, b) => {
 const timeA = new Date(a.lastMessageAt || a.createdAt).getTime() || 0;
 const timeB = new Date(b.lastMessageAt || b.createdAt).getTime() || 0;
 return timeB - timeA;
 });

 // Save to user-specific Firestore cache
 this.saveLeads(firestoreLeads, uid);

 const debugInfo: FirestoreDebugInfo = {
 uid,
 databaseId: activeDbId,
 path: collectionPath,
 docCount: snapshot.size,
 status: 'connected',
 lastUpdated: new Date().toLocaleTimeString('bn-BD'),
 };

 onUpdate(firestoreLeads, debugInfo);
 },
 (error) => {
 console.error('Firestore onSnapshot error:', error);
 let userFriendlyDetails = error.message;

 if (error.code === 'permission-denied') {
 userFriendlyDetails =
 'অনুমতি মেলেনি (permission-denied): Firestore Security Rules অ্যাক্সেস করতে বাধা দিচ্ছে। অনুগ্রহ করে আপনার Google অ্যাকাউন্টে লগইন অবস্থা ঠিক আছে কি না নিশ্চিত করুন।';
 } else if (error.code === 'unavailable') {
 userFriendlyDetails = 'Firestore সার্ভিস বর্তমানে সংযোগ পাচ্ছে না (unavailable)। ইন্টারনেট সংযোগ পরীক্ষা করুন।';
 }

 const debugInfo: FirestoreDebugInfo = {
 uid,
 databaseId: activeDbId,
 path: collectionPath,
 docCount: 0,
 status: 'error',
 errorCode: error.code,
 errorMessage: error.message,
 lastUpdated: new Date().toLocaleTimeString('bn-BD'),
 };

 if (onError) {
 onError(
 {
 code: error.code,
 message: error.message,
 details: userFriendlyDetails,
 },
 debugInfo
 );
 }
 // For new user or permission issue, do NOT load mock leads
 onUpdate([], debugInfo);
 }
 );

 return unsubscribe;
 } catch (err: any) {
 console.error('Error subscribing to Firestore leads:', err);
 const debugInfo: FirestoreDebugInfo = {
 uid: uid || 'unknown',
 databaseId: activeDbId,
 path: collectionPath,
 docCount: 0,
 status: 'error',
 errorCode: err?.code || 'unknown',
 errorMessage: err?.message || String(err),
 lastUpdated: new Date().toLocaleTimeString('bn-BD'),
 };
 if (onError) {
 onError(
 {
 code: err?.code || 'unknown',
 message: err?.message || String(err),
 details: 'Firestore কানেকশন শুরু করতে ব্যর্থ হয়েছে। Firebase কনফিগারেশন চেক করুন।',
 },
 debugInfo
 );
 }
 onUpdate([], debugInfo);
 return () => {};
 }
 }

 // Local fallback listener (only when Firebase is not configured at all)
 const handleLocalUpdate = () => {
 const localLeads = this.getLeads(uid);
 const debugInfo: FirestoreDebugInfo = {
 uid: uid || 'local-user',
 databaseId: 'local-storage',
 path: `localStorage/leads`,
 docCount: localLeads.length,
 status: 'connected',
 lastUpdated: new Date().toLocaleTimeString('bn-BD'),
 };
 onUpdate(localLeads, debugInfo);
 };

 window.addEventListener('leads_storage_updated', handleLocalUpdate);
 const initialLeads = this.getLeads(uid);
 const initialDebugInfo: FirestoreDebugInfo = {
 uid: uid || 'local-user',
 databaseId: 'local-storage',
 path: `localStorage/leads`,
 docCount: initialLeads.length,
 status: 'connected',
 lastUpdated: new Date().toLocaleTimeString('bn-BD'),
 };
 onUpdate(initialLeads, initialDebugInfo);

 return () => {
 window.removeEventListener('leads_storage_updated', handleLocalUpdate);
 };
 }


 /**
 * Finds an existing lead with the same normalized phone number
 */
 public findLeadByPhone(rawPhone?: string | null, excludeId?: string): Lead | undefined {
 if (!rawPhone || !rawPhone.trim()) return undefined;
 const normalizedTarget = normalizeBdPhoneNumber(rawPhone);
 if (!normalizedTarget || normalizedTarget.length < 10) return undefined;

 const leads = this.getLeads();
 return leads.find(
 (l) => l.id !== excludeId && l.phone && normalizeBdPhoneNumber(l.phone) === normalizedTarget
 );
 }

 /**
 * Finds an existing lead with the same Facebook Messenger PSID
 */
 public findLeadByMessengerId(messengerId?: string | null, excludeId?: string): Lead | undefined {
 if (!messengerId || !messengerId.trim()) return undefined;
 const target = messengerId.trim();

 const leads = this.getLeads();
 return leads.find(
 (l) => l.id !== excludeId && l.messengerId && l.messengerId.trim() === target
 );
 }

 /**
 * Checks for duplicate lead:
 * 1. Priority 1: Match by normalized BD phone number if phone exists.
 * 2. Priority 2: Match by Facebook Messenger PSID if phone is absent or doesn't match.
 */
 public findDuplicateLead(
 params: { phone?: string | null; messengerId?: string | null },
 excludeId?: string
 ): Lead | undefined {
 // 1. Phone check
 if (params.phone) {
 const matchByPhone = this.findLeadByPhone(params.phone, excludeId);
 if (matchByPhone) return matchByPhone;
 }

 // 2. Messenger ID check
 if (params.messengerId) {
 const matchByMessenger = this.findLeadByMessengerId(params.messengerId, excludeId);
 if (matchByMessenger) return matchByMessenger;
 }

 return undefined;
 }

 /**
 * Adds a new lead or gracefully merges if a duplicate phone number or messengerId is detected.
 * Syncs to both Firestore (if configured) and localStorage.
 */
 public async addOrMergeLeadAsync(params: {
 name: string;
 phone?: string | null;
 messengerId?: string | null;
 profileLink?: string | null;
 lastChannel?: 'comment' | 'messenger' | string | null;
 lastMessage?: string | null;
 lastMessageAt?: string | null;
 lastPostId?: string | null;
 lastPostLink?: string | null;
 lastComment?: string | null;
 lastCommentAt?: string | null;
 commentUrl?: string | null;
 pageId?: string | null;
 pageName?: string | null;
 source: LeadSource;
 productInterest?: string;
 message?: string;
 status?: LeadStatus;
 tags?: string[];
 nextFollowUpDate?: string | null;
 followUpDate?: string | null;
 assignedTo?: string | null;
 estimatedValue?: number;
 }): Promise<AddLeadResult> {
 const { db } = initializeFirebaseInstances();
 const normalizedPhone = params.phone ? normalizeBdPhoneNumber(params.phone) : '';
 const cleanMessengerId = params.messengerId?.trim() || '';
 const leads = this.getLeads();

 // Check duplicate locally:
 // Priority 1: Phone match
 let existingIndex = -1;
 let matchType: 'phone' | 'messenger' = 'phone';

 if (normalizedPhone && normalizedPhone.length >= 10) {
 existingIndex = leads.findIndex(
 (l) => l.phone && normalizeBdPhoneNumber(l.phone) === normalizedPhone
 );
 if (existingIndex !== -1) {
 matchType = 'phone';
 }
 }

 // Priority 2: Messenger PSID match if not found by phone
 if (existingIndex === -1 && cleanMessengerId) {
 existingIndex = leads.findIndex(
 (l) => l.messengerId && l.messengerId.trim() === cleanMessengerId
 );
 if (existingIndex !== -1) {
 matchType = 'messenger';
 }
 }

 const nowIso = new Date().toISOString();

 if (existingIndex !== -1) {
 // DUPLICATE DETECTED: MERGE!
 const existing = { ...leads[existingIndex] };
 const previousSources = [...existing.sources];
 const isNewSource = !existing.sources.includes(params.source);

 if (isNewSource) {
 existing.sources = [...existing.sources, params.source];
 }

 // If existing lead didn't have phone, but incoming has phone: update phone!
 if (!existing.phone && normalizedPhone) {
 existing.phone = normalizedPhone;
 existing.originalPhone = params.phone || undefined;
 }

 // If incoming has messengerId and existing doesn't: update messengerId
 if (cleanMessengerId && !existing.messengerId) {
 existing.messengerId = cleanMessengerId;
 }

 // If incoming has profileLink: update profileLink
 if (params.profileLink?.trim()) {
 existing.profileLink = params.profileLink.trim();
 }

 if (params.pageId?.trim() && !existing.pageId) {
 existing.pageId = params.pageId.trim();
 }
 if (params.pageName?.trim() && !existing.pageName) {
 existing.pageName = params.pageName.trim();
 }

 // Update latest message or comment
 const incomingMessage = params.lastMessage || params.message;
 const isCommentIntake = params.lastChannel === 'comment' || params.source === 'facebook' || Boolean(params.lastPostLink) || Boolean(params.lastComment);

 if (params.lastComment?.trim()) {
 existing.lastComment = params.lastComment.trim();
 existing.lastCommentAt = params.lastCommentAt || nowIso;
 } else if (isCommentIntake && incomingMessage?.trim()) {
 existing.lastComment = incomingMessage.trim();
 existing.lastCommentAt = params.lastMessageAt || nowIso;
 }

 if (params.commentUrl?.trim()) {
 existing.commentUrl = params.commentUrl.trim();
 } else if (params.lastPostLink?.trim()) {
 existing.commentUrl = params.lastPostLink.trim();
 }

 if (incomingMessage?.trim()) {
 if (!isCommentIntake || params.source === 'messenger' || cleanMessengerId) {
 existing.lastMessage = incomingMessage.trim();
 existing.lastMessageAt = params.lastMessageAt || nowIso;
 } else if (!existing.lastMessage) {
 existing.lastMessage = incomingMessage.trim();
 existing.lastMessageAt = params.lastMessageAt || nowIso;
 }
 }

 if (params.productInterest && !existing.productInterest.includes(params.productInterest)) {
 existing.productInterest = `${existing.productInterest} / ${params.productInterest}`;
 }

 if (params.estimatedValue && params.estimatedValue > 0) {
 existing.estimatedValue = (existing.estimatedValue || 0) + params.estimatedValue;
 }

 if (params.lastChannel) {
 existing.lastChannel = params.lastChannel;
 } else if (params.lastPostLink || params.lastPostId) {
 existing.lastChannel = 'comment';
 } else if (cleanMessengerId || params.source === 'messenger') {
 existing.lastChannel = 'messenger';
 }
 if (params.lastPostId) existing.lastPostId = params.lastPostId;
 if (params.lastPostLink) existing.lastPostLink = params.lastPostLink;

 if (params.tags && params.tags.length > 0) {
 const set = new Set([...existing.tags, ...params.tags]);
 existing.tags = Array.from(set);
 }

 const sourceLabelNew = SOURCE_LABELS[params.source] || params.source;
 const prevLabels = previousSources.map((s) => SOURCE_LABELS[s] || s).join(', ');
 const matchReason = matchType === 'phone'
 ? `ফোন নম্বর (${formatBdPhoneNumber(existing.phone)})`
 : `Messenger PSID (${cleanMessengerId})`;

 const mergeActivity: LeadActivity = {
 id: 'act-' + Date.now(),
 type: params.lastChannel === 'comment' || params.lastPostLink ? 'comment' : 'source_merged',
 description: `ডুপ্লিকেট ইনটেক (${matchReason} দিয়ে মার্জ): লিডটি পুনরায় ${sourceLabelNew} থেকে যোগাযোগ করেছে (পূর্বের সোর্স: ${prevLabels})।`,
 timestamp: nowIso,
 details: incomingMessage ? `বার্তা: "${incomingMessage}"` : undefined,
 channel: existing.lastChannel,
 postLink: params.lastPostLink || undefined,
 };
 existing.activities = [mergeActivity, ...existing.activities];
 existing.updatedAt = nowIso;

 if (incomingMessage && incomingMessage.trim()) {
 const newNote: LeadNote = {
 id: 'note-' + Date.now(),
 content: `[${sourceLabelNew} থেকে প্রাপ্ত নতুন বার্তা]: ${incomingMessage.trim()}`,
 createdAt: nowIso,
 author: 'সিস্টেম অটো-মার্জ',
 };
 existing.notes = [newNote, ...existing.notes];
 }

 // Sync to Firestore under users/{uid}/leads
 const uid = this.getActiveUserId();
 if (isFirebaseConfigured() && db && uid) {
 try {
 await setDoc(doc(db, 'users', uid, 'leads', existing.id), existing, { merge: true });
 } catch (e) {
 console.error('Failed to sync merged lead to Firestore:', e);
 }
 }

 leads[existingIndex] = existing;
 this.saveLeads(leads);

 return {
 isDuplicate: true,
 lead: existing,
 mergedSources: existing.sources,
 notificationMessage: `লিড মার্জ সম্পন্ন! "${existing.name}" (${matchReason}) আগের লিডের সাথে একত্রিত করা হয়েছে।`,
 };
 }

 // NEW LEAD CREATION
 const isNewCommentIntake = params.lastChannel === 'comment' || params.source === 'facebook' || Boolean(params.lastPostLink) || Boolean(params.lastComment);
 const newLeadComment = params.lastComment?.trim() || (isNewCommentIntake ? (params.lastMessage || params.message)?.trim() : undefined);

 const newLead: Lead = {
 id: 'lead-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
 name: params.name.trim() || (cleanMessengerId ? `Messenger User (${cleanMessengerId.slice(-4)})` : 'অজ্ঞাত লিড'),
 phone: normalizedPhone || (params.phone?.trim() ? params.phone.trim() : undefined),
 originalPhone: params.phone?.trim() ? params.phone.trim() : undefined,
 messengerId: cleanMessengerId || undefined,
 profileLink: params.profileLink?.trim() || undefined,
 lastChannel: params.lastChannel || (params.lastPostLink || params.lastPostId ? 'comment' : (cleanMessengerId || params.source === 'messenger' ? 'messenger' : undefined)),
 lastMessage: (params.lastMessage || params.message)?.trim() || undefined,
 lastMessageAt: params.lastMessageAt || (params.message ? nowIso : undefined),
 lastPostId: params.lastPostId?.trim() || undefined,
 lastPostLink: params.lastPostLink?.trim() || undefined,
 lastComment: newLeadComment,
 lastCommentAt: newLeadComment ? (params.lastCommentAt || params.lastMessageAt || nowIso) : undefined,
 commentUrl: (params.commentUrl || params.lastPostLink)?.trim() || undefined,
 pageId: params.pageId?.trim() || undefined,
 pageName: params.pageName?.trim() || undefined,
 source: params.source,
 sources: [params.source],
 productInterest: params.productInterest?.trim() || 'সাধারণ অনুসন্ধান',
 message: params.message?.trim() || params.lastMessage?.trim() || 'কোনো বার্তা নেই',
 status: params.status || 'new',
 tags: params.tags || [],
 createdAt: nowIso,
 updatedAt: nowIso,
 followUpDate: params.followUpDate || params.nextFollowUpDate || null,
 nextFollowUpDate: params.followUpDate || params.nextFollowUpDate || null,
 assignedTo: params.assignedTo || null,
 estimatedValue: params.estimatedValue || 0,
 isStarred: false,
 notes: (params.message?.trim() || params.lastMessage?.trim())
 ? [
 {
 id: 'note-' + Date.now(),
 content: (params.message || params.lastMessage)!.trim(),
 createdAt: nowIso,
 author: params.source === 'messenger' ? 'Messenger গ্রাহক' : 'গ্রাহকের প্রথম মেসেজ',
 },
 ]
 : [],
 activities: [
 {
 id: 'act-' + Date.now(),
 type: (params.lastChannel === 'comment' || params.lastPostLink) ? 'comment' : 'created',
 description: `${SOURCE_LABELS[params.source]} থেকে নতুন লিড ইনবক্সে যুক্ত হয়েছে${cleanMessengerId ? ` (Messenger PSID: ${cleanMessengerId})` : ''}।`,
 timestamp: nowIso,
 channel: params.lastChannel || (params.lastPostLink ? 'comment' : (cleanMessengerId || params.source === 'messenger' ? 'messenger' : undefined)),
 postLink: params.lastPostLink?.trim() || undefined,
 },
 ],
 seenBy: {},
 createdBy: this.currentOperator ? { uid: this.currentOperator.uid, name: this.currentOperator.name } : undefined,
 };

 // Sync to Firestore under users/{uid}/leads
 const uid = this.getActiveUserId();
 if (isFirebaseConfigured() && db && uid) {
 try {
 await setDoc(doc(db, 'users', uid, 'leads', newLead.id), newLead);
 } catch (e) {
 console.error('Failed to save new lead to Firestore:', e);
 }
 }

 const updatedList = [newLead, ...leads];
 this.saveLeads(updatedList);

 return {
 isDuplicate: false,
 lead: newLead,
 notificationMessage: `সফলভাবে নতুন লিড যোগ করা হয়েছে: ${newLead.name} (${SOURCE_LABELS[newLead.source]})`,
 };
 }

 /**
 * Synchronous wrapper for addOrMergeLead
 */
 public addOrMergeLead(params: {
 name: string;
 phone?: string | null;
 messengerId?: string | null;
 profileLink?: string | null;
 lastChannel?: 'comment' | 'messenger' | string | null;
 lastMessage?: string | null;
 lastMessageAt?: string | null;
 lastPostId?: string | null;
 lastPostLink?: string | null;
 pageId?: string | null;
 pageName?: string | null;
 source: LeadSource;
 productInterest?: string;
 message?: string;
 status?: LeadStatus;
 tags?: string[];
 nextFollowUpDate?: string | null;
 followUpDate?: string | null;
 assignedTo?: string | null;
 estimatedValue?: number;
 }): AddLeadResult {
 const leads = this.getLeads();
 const normalizedPhone = params.phone ? normalizeBdPhoneNumber(params.phone) : '';
 const cleanMessengerId = params.messengerId?.trim() || '';

 let existingIndex = -1;
 if (normalizedPhone && normalizedPhone.length >= 10) {
 existingIndex = leads.findIndex(
 (l) => l.phone && normalizeBdPhoneNumber(l.phone) === normalizedPhone
 );
 }
 if (existingIndex === -1 && cleanMessengerId) {
 existingIndex = leads.findIndex(
 (l) => l.messengerId && l.messengerId.trim() === cleanMessengerId
 );
 }

 // Trigger async sync in background
 this.addOrMergeLeadAsync(params).catch(console.error);

 if (existingIndex !== -1) {
 return {
 isDuplicate: true,
 lead: leads[existingIndex],
 notificationMessage: `লিড মার্জ হচ্ছে...`,
 };
 }

 const nowIso = new Date().toISOString();
 const tempLead: Lead = {
 id: 'lead-' + Date.now(),
 name: params.name || (cleanMessengerId ? `Messenger User (${cleanMessengerId.slice(-4)})` : 'অজ্ঞাত লিড'),
 phone: normalizedPhone || (params.phone?.trim() ? params.phone.trim() : undefined),
 originalPhone: params.phone?.trim() ? params.phone.trim() : undefined,
 messengerId: cleanMessengerId || undefined,
 profileLink: params.profileLink?.trim() || undefined,
 lastMessage: (params.lastMessage || params.message)?.trim() || undefined,
 lastMessageAt: params.lastMessageAt || nowIso,
 source: params.source,
 sources: [params.source],
 productInterest: params.productInterest || '',
 message: params.message || params.lastMessage || '',
 status: params.status || 'new',
 tags: params.tags || [],
 createdAt: nowIso,
 updatedAt: nowIso,
 followUpDate: params.followUpDate || params.nextFollowUpDate || null,
 nextFollowUpDate: params.followUpDate || params.nextFollowUpDate || null,
 assignedTo: params.assignedTo || null,
 estimatedValue: params.estimatedValue || 0,
 notes: [],
 activities: [],
 };

 return {
 isDuplicate: false,
 lead: tempLead,
 notificationMessage: `লিড যোগ করা হয়েছে: ${tempLead.name}`,
 };
 }


 /**
 * Updates existing lead fields in Firestore and localStorage
 */
 public async updateLead(id: string, updates: Partial<Lead>, editorName = 'অ্যাডমিন'): Promise<Lead | null> {
 const leads = this.getLeads();
 const index = leads.findIndex((l) => l.id === id);
 if (index === -1) return null;

 const current = leads[index];
 const nowIso = new Date().toISOString();
 const activities: LeadActivity[] = [...current.activities];

 if (updates.status && updates.status !== current.status) {
 activities.unshift({
 id: 'act-' + Date.now(),
 type: 'status_change',
 description: `স্ট্যাটাস পরিবর্তন: ${STATUS_LABELS[current.status]} → ${STATUS_LABELS[updates.status]} (${editorName})`,
 timestamp: nowIso,
 });
 }

 if (updates.nextFollowUpDate !== undefined && updates.nextFollowUpDate !== current.nextFollowUpDate) {
 activities.unshift({
 id: 'act-' + Date.now(),
 type: 'followup_scheduled',
 description: updates.nextFollowUpDate
 ? `ফলো-আপ নির্ধারিত: ${updates.nextFollowUpDate} (${editorName})`
 : `ফলো-আপ বাতিল করা হয়েছে (${editorName})`,
 timestamp: nowIso,
 });
 }

 if (updates.assignedTo !== undefined && updates.assignedTo !== current.assignedTo) {
 activities.unshift({
 id: 'act-' + Date.now(),
 type: 'assigned',
 description: updates.assignedTo
 ? `লিডটি ${updates.assignedTo}-কে অ্যাসাইন করা হয়েছে (${editorName})`
 : `লিডটি আন-অ্যাসাইন করা হয়েছে (${editorName})`,
 timestamp: nowIso,
 });
 }

 const updatedLead: Lead = {
 ...current,
 ...updates,
 activities,
 updatedAt: nowIso,
 updatedBy: this.currentOperator ? { uid: this.currentOperator.uid, name: this.currentOperator.name, timestamp: nowIso } : undefined,
 };

 // Sync to Firestore
 const uid = this.getActiveUserId();
 if (isFirebaseConfigured() && uid) {
 const { db } = initializeFirebaseInstances();
 if (db) {
 try {
 await setDoc(doc(db, 'users', uid, 'leads', id), updatedLead, { merge: true });
 } catch (e) {
 console.error('Failed to sync updated lead to Firestore:', e);
 }
 }
 }

 leads[index] = updatedLead;
 this.saveLeads(leads);

 return updatedLead;
 }

 /**
 * Marks multiple leads as seen for the current user
 */
 public async markLeadsAsSeen(leadIds: string[]): Promise<void> {
  if (!leadIds || leadIds.length === 0 || !this.currentOperator) return;
  const nowIso = new Date().toISOString();
  const uid = this.currentOperator.uid;
  
  const promises = leadIds.map(async (id) => {
   const leads = this.getLeads();
   const lead = leads.find(l => l.id === id);
   if (!lead) return;

   const seenBy = { ...(lead.seenBy || {}), [uid]: nowIso };
   return this.updateLead(id, { seenBy }, 'সিস্টেম');
  });
  
  await Promise.all(promises);
 }

 /**
 * Adds an internal note to a lead
 */
 public async addNote(leadId: string, content: string, author = 'অ্যাডমিন'): Promise<Lead | null> {
 if (!content.trim()) return null;
 const leads = this.getLeads();
 const index = leads.findIndex((l) => l.id === leadId);
 if (index === -1) return null;

 const current = leads[index];
 const nowIso = new Date().toISOString();

 const newNote: LeadNote = {
 id: 'note-' + Date.now(),
 content: content.trim(),
 createdAt: nowIso,
 author,
 };

 const newActivity: LeadActivity = {
 id: 'act-' + Date.now(),
 type: 'note_added',
 description: `নতুন নোট যুক্ত করা হয়েছে: "${content.trim()}" (${author})`,
 timestamp: nowIso,
 };

 return this.updateLead(leadId, {
 notes: [newNote, ...current.notes],
 activities: [newActivity, ...current.activities],
 });
 }

 /**
 * Toggles star status
 */
 public async toggleStar(leadId: string): Promise<Lead | null> {
 const leads = this.getLeads();
 const lead = leads.find((l) => l.id === leadId);
 if (!lead) return null;

 return this.updateLead(leadId, { isStarred: !lead.isStarred });
 }

 /**
 * Permanently deletes a lead from Firestore and local storage
 */
 public async permanentlyDeleteLead(leadId: string): Promise<void> {
 const uid = this.getActiveUserId();
 if (isFirebaseConfigured() && uid) {
 const { db } = initializeFirebaseInstances();
 if (db) {
 await deleteDoc(doc(db, 'users', uid, 'leads', leadId));
 }
 }

 const leads = this.getLeads();
 const filtered = leads.filter((l) => l.id !== leadId);
 this.saveLeads(filtered);
 }

 /**
 * Soft delete (move to trash)
 */
 public async softDeleteLead(leadId: string): Promise<Lead | null> {
 return this.updateLead(leadId, { deleted: true, deletedAt: new Date().toISOString() });
 }

 /**
 * Bulk soft delete
 */
 public async bulkSoftDeleteLeads(leadIds: string[]): Promise<void> {
 const promises = leadIds.map((id) => this.softDeleteLead(id));
 await Promise.all(promises);
 }

 /**
 * Restore from trash
 */
 public async restoreLead(leadId: string): Promise<Lead | null> {
 return this.updateLead(leadId, { deleted: false, deletedAt: undefined });
 }

 /**
 * Clears all leads completely
 */
 public async clearAllLeads(): Promise<void> {
 const leads = this.getLeads();
 const uid = this.getActiveUserId();
 
 if (isFirebaseConfigured() && uid) {
 const { db } = initializeFirebaseInstances();
 if (db) {
 const batch = writeBatch(db);
 leads.forEach((l) => {
 batch.delete(doc(db, 'users', uid, 'leads', l.id));
 });
 await batch.commit();
 }
 }

 this.saveLeads([]);
 }

 /**
 * Delete only demo leads
 */
 public async deleteDemoLeads(): Promise<{ deletedCount: number; remainingCount: number }> {
 const leads = this.getLeads();
 const demoIds = new Set(INITIAL_DEMO_LEADS.map((l) => l.id));
 
 const leadsToDelete = leads.filter((l) => demoIds.has(l.id));
 const leadsToKeep = leads.filter((l) => !demoIds.has(l.id));

 const uid = this.getActiveUserId();
 if (isFirebaseConfigured() && uid) {
 const { db } = initializeFirebaseInstances();
 if (db) {
 const batch = writeBatch(db);
 leadsToDelete.forEach((l) => {
 batch.delete(doc(db, 'users', uid, 'leads', l.id));
 });
 await batch.commit();
 }
 }

 this.saveLeads(leadsToKeep);
 return { deletedCount: leadsToDelete.length, remainingCount: leadsToKeep.length };
 }

 /**
 * Loads demo leads into storage
 */
 public async loadDemoLeads(): Promise<number> {
 const demoLeads = INITIAL_DEMO_LEADS.map((l) => normalizeFirestoreLead(l.id, l));
 const existing = this.getLeads();
 
 // Prevent exact ID duplicates
 const existingIds = new Set(existing.map((l) => l.id));
 const uniqueDemo = demoLeads.filter((l) => !existingIds.has(l.id));

 const uid = this.getActiveUserId();
 if (isFirebaseConfigured() && uid) {
 const { db } = initializeFirebaseInstances();
 if (db) {
 const batch = writeBatch(db);
 uniqueDemo.forEach((l) => {
 batch.set(doc(db, 'users', uid, 'leads', l.id), l);
 });
 await batch.commit();
 }
 }

 const updated = [...uniqueDemo, ...existing];
 this.saveLeads(updated);
 return uniqueDemo.length;
 }

 /**
 * Fixes all lead dates that are before createdAt or outdated
 */
 public async fixAllLeadsFollowUpDates(): Promise<number> {
 const leads = this.getLeads();
 let fixedCount = 0;
 
 for (const lead of leads) {
 const nowIso = new Date().toISOString();
 const todayDhaka = getDhakaDateString(nowIso);
 const createdDhaka = getDhakaDateString(lead.createdAt);
 const lastMsgDhaka = lead.lastMessageAt ? getDhakaDateString(lead.lastMessageAt) : createdDhaka;
 
 const currentFU = lead.followUpDate || lead.nextFollowUpDate;
 const fuDhaka = getDhakaDateString(currentFU || '');

 let needsFix = false;
 let newFU = fuDhaka;

 if (!fuDhaka || fuDhaka < createdDhaka) {
 needsFix = true;
 newFU = lastMsgDhaka >= todayDhaka ? lastMsgDhaka : todayDhaka;
 } else if (fuDhaka < todayDhaka && lastMsgDhaka === todayDhaka) {
 needsFix = true;
 newFU = todayDhaka;
 }

 if (needsFix) {
 await this.updateLead(lead.id, { followUpDate: newFU, nextFollowUpDate: newFU }, 'সিস্টেম অটো-ফিক্স');
 fixedCount++;
 }
 }
 
 return fixedCount;
 }

 /**
 * Calculates comprehensive dashboard statistics
 */
 public getSummaryStats(leads: Lead[], selectedMonthKey?: string): SummaryStats {
 const todayDhaka = getDhakaDateString(new Date().toISOString());
 const uid = this.getActiveUserId();

 // Filter out deleted leads for summary
 const active = leads.filter((l) => !l.deleted);

 // 1. Identify all months with leads to build availableMonths
 const monthMap: Record<string, { key: string; label: string; count: number; year: number; month: number }> = {};
 active.forEach(l => {
   const key = getMonthKey(l.createdAt);
   if (!key) return;
   if (!monthMap[key]) {
     const [year, month] = key.split('-').map(Number);
     monthMap[key] = {
       key,
       label: getBengaliMonthLabel(year, month),
       count: 0,
       year,
       month
     };
   }
   monthMap[key].count++;
 });

 const availableMonths: MonthOption[] = Object.values(monthMap).sort((a, b) => {
   if (a.year !== b.year) return b.year - a.year;
   return b.month - a.month;
 });

 // Current month as default if none selected
 const currentMonthKey = selectedMonthKey || getMonthKey(new Date().toISOString());
 const monthlyLeads = active.filter(l => getMonthKey(l.createdAt) === currentMonthKey);

 // Values for the selected month
 const totalLeadsInSelectedMonth = monthlyLeads.length;
 const pipelineValueInSelectedMonth = monthlyLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);

 // 9 "New" lead counts (using isLeadNew helper)
 const newLeads = active.filter(l => isLeadNew(l, uid));
 
 const stats: SummaryStats = {
 totalLeads: active.length,
 totalLeadsInSelectedMonth,
 pipelineValueInSelectedMonth,
 availableMonths,

 // Status based "New" counts
 newLeadsCount: newLeads.filter(l => l.status === 'new').length,
 totalNewStatusCount: active.filter(l => l.status === 'new').length,

 newFollowUpCount: newLeads.filter(l => {
  const fu = getDhakaDateString(l.followUpDate || l.nextFollowUpDate);
  return (l.status === 'followup' || (fu && fu <= todayDhaka)) && !['won', 'cancelled', 'hold'].includes(l.status);
 }).length,
 totalFollowUpCount: active.filter(l => {
  const fu = getDhakaDateString(l.followUpDate || l.nextFollowUpDate);
  return (l.status === 'followup' || (fu && fu <= todayDhaka)) && !['won', 'cancelled', 'hold'].includes(l.status);
 }).length,

 newWonCount: newLeads.filter(l => l.status === 'won' || l.status === 'confirmed').length,
 totalWonCount: active.filter(l => l.status === 'won' || l.status === 'confirmed').length,
 wonValue: active.filter(l => l.status === 'won' || l.status === 'confirmed').reduce((sum, l) => sum + (l.estimatedValue || 0), 0),

 newCancelledCount: newLeads.filter(l => l.status === 'cancelled').length,
 totalCancelledCount: active.filter(l => l.status === 'cancelled').length,
 cancelledValue: active.filter(l => l.status === 'cancelled').reduce((sum, l) => sum + (l.estimatedValue || 0), 0),

 // Source based "New" counts
 newFacebookCount: newLeads.filter(l => l.source === 'facebook').length,
 totalFacebookCount: active.filter(l => l.source === 'facebook').length,

 newMessengerCount: newLeads.filter(l => l.source === 'messenger').length,
 totalMessengerCount: active.filter(l => l.source === 'messenger').length,

 newWhatsappCount: newLeads.filter(l => l.source === 'whatsapp').length,
 totalWhatsappCount: active.filter(l => l.source === 'whatsapp').length,

 newWebsiteCount: newLeads.filter(l => l.source === 'website').length,
 totalWebsiteCount: active.filter(l => l.source === 'website').length,

 newManualCount: newLeads.filter(l => l.source === 'manual').length,
 totalManualCount: active.filter(l => l.source === 'manual').length,

 // 3 "Total" only boxes
 totalPendingCount: active.filter(l => ['new', 'contacted', 'followup', 'pending'].includes(l.status)).length,
 pendingValue: active.filter(l => ['new', 'contacted', 'followup', 'pending'].includes(l.status)).reduce((sum, l) => sum + (l.estimatedValue || 0), 0),

 totalHoldCount: active.filter(l => l.status === 'hold').length,
 holdValue: active.filter(l => l.status === 'hold').reduce((sum, l) => sum + (l.estimatedValue || 0), 0),

 // Legacy compatibility
 todayNewLeads: active.filter(l => getDhakaDateString(l.createdAt) === todayDhaka).length,
 todayFollowUpCount: active.filter(l => getDhakaDateString(l.followUpDate || l.nextFollowUpDate) === todayDhaka).length,
 overdueFollowUpCount: active.filter(l => {
  const fu = getDhakaDateString(l.followUpDate || l.nextFollowUpDate);
  return fu && fu < todayDhaka && !['won', 'cancelled', 'hold'].includes(l.status);
 }).length,
 facebookCount: active.filter(l => l.source === 'facebook').length,
 messengerCount: active.filter(l => l.source === 'messenger').length,
 whatsappCount: active.filter(l => l.source === 'whatsapp').length,
 websiteCount: active.filter(l => l.source === 'website').length,
 manualCount: active.filter(l => l.source === 'manual').length,
 wonCount: active.filter(l => l.status === 'won' || l.status === 'confirmed').length,
 cancelledCount: active.filter(l => l.status === 'cancelled').length,
 holdCount: active.filter(l => l.status === 'hold').length,
 pendingCount: active.filter(l => ['new', 'contacted', 'followup', 'pending'].includes(l.status)).length,
 totalEstimatedPipelineValue: active.reduce((sum, l) => sum + (l.estimatedValue || 0), 0),
 unreadCount: newLeads.length,
 totalUnreadNewLeadsCount: newLeads.length,
 };

 return stats;
 }

 /**
  * Team member management
  */
 public async addTeamMember(email: string, name: string, ownerUid: string, addedBy: string): Promise<void> {
   const { db } = initializeFirebaseInstances();
   if (!db) return;
   
   const lowerEmail = email.toLowerCase().trim();
   const memberDocRef = doc(db, 'teamMembers', lowerEmail);
   
   await setDoc(memberDocRef, {
     ownerUid,
     name,
     role: 'member',
     active: true,
     addedAt: new Date().toISOString(),
     addedBy
   });
 }

 public async updateTeamMemberStatus(email: string, active: boolean): Promise<void> {
   const { db } = initializeFirebaseInstances();
   if (!db) return;
   
   const lowerEmail = email.toLowerCase().trim();
   const memberDocRef = doc(db, 'teamMembers', lowerEmail);
   
   await setDoc(memberDocRef, { active }, { merge: true });
 }

 public async removeTeamMember(email: string): Promise<void> {
   const { db } = initializeFirebaseInstances();
   if (!db) return;
   
   const lowerEmail = email.toLowerCase().trim();
   const memberDocRef = doc(db, 'teamMembers', lowerEmail);
   
   await deleteDoc(memberDocRef);
 }

 public subscribeToTeamMembers(ownerUid: string, onUpdate: (members: any[]) => void): () => void {
   const { db } = initializeFirebaseInstances();
   if (!db) {
     onUpdate([]);
     return () => {};
   }
   
   const q = query(collection(db, 'teamMembers'), where('ownerUid', '==', ownerUid));
   
   return onSnapshot(q, (snapshot) => {
     const members: any[] = [];
     snapshot.forEach(doc => {
       members.push({ email: doc.id, ...doc.data() });
     });
     onUpdate(members);
   });
 }
  /**
   * Imports leads from an old user UID path (users/{oldUid}/leads) into sharedLeads without duplication.
   */
  public async importLeadsFromUserUid(oldUid: string): Promise<number> {
    const { db } = initializeFirebaseInstances();
    if (!db || !oldUid.trim()) return 0;

    const trimmedOldUid = oldUid.trim();
    const oldLeadsCol = collection(db, 'users', trimmedOldUid, 'leads');
    const oldSnap = await getDocs(oldLeadsCol);

    if (oldSnap.empty) return 0;

    const currentLeads = this.getLeads();
    const existingIds = new Set(currentLeads.map(l => l.id));
    const existingPhones = new Set(currentLeads.map(l => l.phone ? normalizeBdPhoneNumber(l.phone) : '').filter(Boolean));
    const existingMessengers = new Set(currentLeads.map(l => l.messengerId ? l.messengerId.trim() : '').filter(Boolean));

    let importedCount = 0;
    const batch = writeBatch(db);
    const newLeadsToAdd: Lead[] = [];

    oldSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const lead = normalizeFirestoreLead(docSnap.id, data);

      const normPhone = lead.phone ? normalizeBdPhoneNumber(lead.phone) : '';
      const cleanMsgId = lead.messengerId ? lead.messengerId.trim() : '';

      const isDuplicate = 
        existingIds.has(lead.id) ||
        (normPhone && existingPhones.has(normPhone)) ||
        (cleanMsgId && existingMessengers.has(cleanMsgId));

      if (!isDuplicate) {
        existingIds.add(lead.id);
        if (normPhone) existingPhones.add(normPhone);
        if (cleanMsgId) existingMessengers.add(cleanMsgId);

        newLeadsToAdd.push(lead);
        batch.set(doc(db, 'sharedLeads', lead.id), lead);
        importedCount++;
      }
    });

    if (importedCount > 0) {
      await batch.commit();
      const updated = [...newLeadsToAdd, ...currentLeads];
      this.saveLeads(updated);
    }

    return importedCount;
  }
}

export const leadService = new LeadService();
