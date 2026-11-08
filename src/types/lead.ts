export type LeadSource = 'facebook' | 'messenger' | 'whatsapp' | 'website' | 'manual';

export type LeadStatus = 'new' | 'contacted' | 'followup' | 'won' | 'confirmed' | 'pending' | 'cancelled' | 'hold';

export interface LeadNote {
  id: string;
  content: string;
  createdAt: string;
  author: string;
}

export interface LeadActivity {
  id: string;
  type: 'created' | 'status_change' | 'note_added' | 'source_merged' | 'contacted' | 'followup_scheduled' | 'assigned' | 'comment' | 'messenger' | 'whatsapp' | (string & {});
  description: string;
  timestamp: string;
  details?: string;
  postLink?: string;
  channel?: 'comment' | 'messenger' | 'whatsapp' | string;
}

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string; // Normalized format: e.g., 01712345678 (optional for Messenger leads)
  originalPhone?: string; // As entered: e.g., +8801712-345678
  messengerId?: string; // Facebook PSID (Page-Scoped ID)
  profileLink?: string; // Facebook profile URL or Messenger link
  lastChannel?: 'comment' | 'messenger' | string; // 'comment' or 'messenger'
  lastMessage?: string; // Latest incoming message
  lastMessageAt?: string; // ISO string timestamp of the latest message
  lastPostId?: string; // Facebook Post ID from which lead commented
  lastPostLink?: string; // Facebook Post URL
  lastComment?: string; // Latest Facebook comment text
  lastCommentAt?: string; // ISO string timestamp of the latest Facebook comment
  commentUrl?: string; // Direct URL to the Facebook comment or post
  source: LeadSource; // Primary or first source
  sources: LeadSource[]; // All sources this lead has interacted through (for duplicate merges)
  productInterest: string; // Product/Service of interest
  message: string; // Initial message / lead note
  status: LeadStatus;
  tags: string[]; // e.g., 'গরম লিড', 'দাম জানতে চেয়েছে'
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  followUpDate?: string | null; // YYYY-MM-DD or ISO (n8n & standard)
  nextFollowUpDate?: string | null; // Legacy alias
  assignedTo: string | null; // Team member name
  notes: LeadNote[];
  activities: LeadActivity[];
  estimatedValue?: number; // Estimated deal value in BDT
  isStarred?: boolean;
  lastSeenAt?: string; // ISO string timestamp when admin last viewed/read latest message
  seenAt?: string | null; // ISO string timestamp when lead was viewed or marked as seen
  pageId?: string; // Facebook Page ID where interaction occurred
  pageName?: string; // Facebook Page Name
  deleted?: boolean;
  deletedAt?: string;
  seenBy?: Record<string, string>; // { uid: isoTimestamp }
  createdBy?: { uid: string; name: string };
  updatedBy?: { uid: string; name: string; timestamp: string };
}

export interface LeadFilterState {
  searchQuery: string;
  source: 'all' | LeadSource;
  status: 'all' | LeadStatus;
  tag: string;
  page: string;
  dateRange: 'all' | 'today' | 'this_week' | 'this_month' | 'custom';
  onlyFollowUpToday: boolean;
  sortBy: 'newest' | 'oldest' | 'name' | 'followup';
}

export interface WebhookPayload {
  name: string;
  phone?: string;
  messengerId?: string;
  profileLink?: string;
  lastChannel?: 'comment' | 'messenger' | string;
  lastMessage?: string;
  lastMessageAt?: string;
  lastComment?: string;
  lastCommentAt?: string;
  commentUrl?: string;
  lastPostId?: string;
  lastPostLink?: string;
  postLink?: string;
  source: string;
  message?: string;
  productInterest?: string;
  tag?: string;
  tags?: string[];
  assignedTo?: string;
  estimatedValue?: number;
}
