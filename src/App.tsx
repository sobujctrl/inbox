import React, { useState, useEffect, useRef } from 'react';
import { Sidebar, ActiveNavTab } from './components/layout/Sidebar';
import { TopHeader, ThemeMode } from './components/layout/TopHeader';
import { SummaryCards } from './components/dashboard/SummaryCards';
import { SearchResultsView } from './components/dashboard/SearchResultsView';
import {
 CardLeadPageView,
 CardFilterType,
 CARD_TYPE_TO_ROUTE,
 ROUTE_TO_CARD_TYPE,
} from './components/dashboard/CardLeadPageView';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { ReportsView } from './components/reports/ReportsView';
import { ImportExportView } from './components/integrations/ImportExportView';
import { SettingsView } from './components/settings/SettingsView';
import { LeadDetailDrawer } from './components/detail/LeadDetailDrawer';
import { AddLeadModal } from './components/modals/AddLeadModal';
import { ResetOptionsModal } from './components/modals/ResetOptionsModal';
import { Lead, LeadStatus, LeadSource } from './types/lead';
import { leadService, FirestoreErrorPayload, FirestoreDebugInfo, getDhakaDateString, getDateRangeBoundaries, getMonthKey } from './services/leadService';
import { exportLeadsToCSV } from './utils/formatters';
import { authService, AdminUser } from './services/authService';
import { firebaseAuthService, AUTHORIZED_ADMIN_EMAIL } from './services/firebaseAuthService';
import { isEmailAllowed, PRIMARY_ADMIN_EMAIL } from './config/authConfig';
import { isFirebaseConfigured, initializeFirebaseInstances, getActiveDatabaseId } from './firebase/config';
import { AdminLoginView } from './components/auth/AdminLoginView';
import { CheckCircle2, Sparkles, X, AlertTriangle, Layers, UserX } from 'lucide-react';
import { useWorkspace } from './context/WorkspaceContext';

export default function App() {
 const { ownerUid, role, loading: workspaceLoading, error: workspaceError } = useWorkspace();
 const isFb = isFirebaseConfigured();
 const mainScrollRef = useRef<HTMLElement>(null);

 // Single Source of Truth Theme State ('light' | 'dark' | 'auto')
 const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
   try {
     const saved = localStorage.getItem('app-theme') as ThemeMode;
     if (saved === 'light' || saved === 'dark' || saved === 'auto') {
       return saved;
     }
     return 'light';
   } catch {
     return 'light';
   }
 });

 // Sync data-theme attribute on <html> with themeMode & system preference
 useEffect(() => {
   const applyTheme = () => {
     let resolvedTheme: 'light' | 'dark' = 'light';
     if (themeMode === 'auto') {
       const isSystemDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
       resolvedTheme = isSystemDark ? 'dark' : 'light';
     } else {
       resolvedTheme = themeMode;
     }
     document.documentElement.setAttribute('data-theme', resolvedTheme);
     try {
       localStorage.setItem('app-theme', themeMode);
     } catch {
       // ignore
     }
   };

  const renderDebugBanner = () => {
    const loginEmail = currentUser?.email || 'N/A';
    const dbId = getActiveDatabaseId();
    const docCount = firestoreDebug?.docCount ?? leads.length;
    const teamStatus = workspaceError ? 'ব্যর্থ (Error)' : 'সফল (Success)';
    const userRole = role === 'owner' ? 'অ্যাডমিন/মালিক (Admin)' : 'টিম মেম্বার (Member)';
    const errInfo = firestoreError ? `[${firestoreError.code}] ${firestoreError.message}` : 'কোনো এরর নেই (No Error)';
    const filteredCount = filteredLeads.length;

    return (
      <div className="bg-slate-900 text-slate-100 p-2.5 text-xs font-mono border-b border-slate-700 shadow-inner flex flex-wrap items-center justify-between gap-3 z-[999] w-full shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <span>📧 ইমেল: <strong className="text-emerald-400">{loginEmail}</strong></span>
          <span>🗄️ DB ID: <strong className="text-cyan-400">{dbId}</strong></span>
          <span>📦 SharedLeads docs: <strong className="text-amber-400">{docCount}</strong></span>
          <span>⚙️ Team/Config: <strong className={workspaceError ? 'text-rose-400' : 'text-emerald-400'}>{teamStatus} ({userRole})</strong></span>
          <span>🔍 ফিল্টার্ড লিড: <strong className="text-purple-400">{filteredCount}</strong></span>
        </div>
        <div>
          {firestoreError ? (
            <span className="text-rose-400 font-bold">⚠️ Error: {errInfo}</span>
          ) : (
            <span className="text-emerald-400 font-bold">🟢 সচল (No Error)</span>
          )}
        </div>
      </div>
    );
  };

   applyTheme();

   if (themeMode === 'auto' && typeof window !== 'undefined' && window.matchMedia) {
     const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
     const handleChange = () => applyTheme();
     mediaQuery.addEventListener('change', handleChange);
     return () => mediaQuery.removeEventListener('change', handleChange);
   }
 }, [themeMode]);

 const handleToggleTheme = () => {
   setThemeMode(() => {
     const currentTheme = document.documentElement.getAttribute('data-theme');
     return currentTheme === 'dark' ? 'light' : 'dark';
   });
 };

 // Authentication states
 const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
 if (isFb) return null; // When Firebase is configured, strictly wait for Firebase Auth
 return authService.getCurrentUser();
 });
 const [isAuthChecking, setIsAuthChecking] = useState<boolean>(() => isFb);
 const [authError, setAuthError] = useState<string | null>(null);

 // Firestore real-time error banner & diagnostics
 const [firestoreError, setFirestoreError] = useState<FirestoreErrorPayload | null>(null);
 const [firestoreDebug, setFirestoreDebug] = useState<FirestoreDebugInfo | null>(null);

 const [activeTab, setActiveTab] = useState<ActiveNavTab>('inbox');
 const [leads, setLeads] = useState<Lead[]>([]);
 const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
 const [isAddModalOpen, setIsAddModalOpen] = useState(false);
 const [isResetModalOpen, setIsResetModalOpen] = useState(false);
 const [activeCardPage, setActiveCardPage] = useState<CardFilterType | null>(() => {
 const hash = typeof window !== 'undefined' ? window.location.hash : '';
 return hash in ROUTE_TO_CARD_TYPE ? ROUTE_TO_CARD_TYPE[hash] : null;
 });
 
 // Filter states
 const [sourceFilter, setSourceFilter] = useState<string>('all');
 const [searchQuery, setSearchQuery] = useState('');
 const [isFollowUpFilterActive, setIsFollowUpFilterActive] = useState(false);
 const [isTodayNewFilterActive, setIsTodayNewFilterActive] = useState(false);
 const [isConfirmedFilterActive, setIsConfirmedFilterActive] = useState(false);
 const [isPendingFilterActive, setIsPendingFilterActive] = useState(false);
 const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom'>('all');
 const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
 const [followUpDateFilter, setFollowUpDateFilter] = useState<'all' | 'today' | 'tomorrow' | 'thisWeek' | 'overdue' | 'noDate'>('all');
 const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all');
 const [tagFilter, setTagFilter] = useState<string>('all');
 const [assignedFilter, setAssignedFilter] = useState<string>('all');
 const [postFilter, setPostFilter] = useState<string>('all');
 const [pageFilter, setPageFilter] = useState<string>('all');
 const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'value'>('newest');
 const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
 const [showDeleted, setShowDeleted] = useState(false);
 const [selectedMonth, setSelectedMonth] = useState<string>(() => getMonthKey(new Date().toISOString()));
 const [toastMessage, setToastMessage] = useState<{ text: string; isDuplicate?: boolean; type?: 'success' | 'error'; onUndo?: () => void } | null>(null);

 // Active leads based on trash/deleted toggle
 const activeLeads = React.useMemo(() => {
 return leads.filter((lead) => {
 if (lead.deleted && !showDeleted) return false;
 if (!lead.deleted && showDeleted) return false;
 return true;
 });
 }, [leads, showDeleted]);

 // Page ID to Name mapping for consistent page identity
 const idToNameMap = React.useMemo(() => {
 const map: Record<string, string> = {};
 activeLeads.forEach((l) => {
 if (l.pageId?.trim() && l.pageName?.trim()) {
 map[l.pageId.trim()] = l.pageName.trim();
 }
 });
 return map;
 }, [activeLeads]);

 // Page-scoped leads based on pageFilter
 const pageLeads = React.useMemo(() => {
 if (pageFilter === 'all') return activeLeads;
 if (pageFilter === 'no_page') {
 return activeLeads.filter((l) => {
 const pName = l.pageName?.trim();
 const pId = l.pageId?.trim();
 return !pName && !pId;
 });
 }
 return activeLeads.filter((l) => {
 const pName = l.pageName?.trim();
 const pId = l.pageId?.trim();
 if (pName === pageFilter) return true;
 if (pId === pageFilter) return true;
 if (pId && idToNameMap[pId] === pageFilter) return true;
 return false;
 });
 }, [activeLeads, pageFilter, idToNameMap]);

 // Compute filtered leads within pageLeads
 const filteredLeads = React.useMemo(() => {
 const todayDhaka = getDhakaDateString(new Date().toISOString());

 return pageLeads.filter((lead) => {
 // 1. Source Tab
 if (sourceFilter !== 'all') {
 const sources = Array.isArray(lead.sources) && lead.sources.length > 0 ? lead.sources : [lead.source || 'facebook'];
 const matchesSource = sources.includes(sourceFilter as LeadSource) || lead.source === sourceFilter;
 if (!matchesSource) return false;
 }

 // 2. Search Query
 if (searchQuery.trim()) {
 const q = searchQuery.toLowerCase().trim();
 const nameMatch = (lead.name || '').toLowerCase().includes(q);
 const phoneMatch = Boolean(
 (lead.phone && String(lead.phone).includes(q)) ||
 (lead.originalPhone && String(lead.originalPhone).includes(q))
 );
 const messengerMatch = Boolean(lead.messengerId && String(lead.messengerId).toLowerCase().includes(q));
 const productMatch = (lead.productInterest || '').toLowerCase().includes(q);
 if (!nameMatch && !phoneMatch && !messengerMatch && !productMatch) return false;
 }

 // 3. Status Filter
 if (statusFilter !== 'all' && lead.status !== statusFilter) return false;

 // 4. Tag Filter
 if (tagFilter !== 'all') {
 const tags = Array.isArray(lead.tags) ? lead.tags : [];
 if (!tags.includes(tagFilter)) return false;
 }

 // 5. Assigned Filter
 if (assignedFilter !== 'all') {
 if (assignedFilter === 'unassigned') {
 if (lead.assignedTo) return false;
 } else if (lead.assignedTo !== assignedFilter) {
 return false;
 }
 }

 // 6. Follow-up Filter (Today's Follow-up from Card)
 if (isFollowUpFilterActive) {
 const rawFollowUp = lead.followUpDate || lead.nextFollowUpDate;
 const followUpStr = typeof rawFollowUp === 'string' ? rawFollowUp : '';
 const followUpDateDhaka = getDhakaDateString(followUpStr);
 if (!followUpDateDhaka || followUpDateDhaka !== todayDhaka || lead.status === 'won') {
 return false;
 }
 }

 // 6.5. Today's New Filter (Asia/Dhaka timezone)
 if (isTodayNewFilterActive) {
 const leadDateDhaka = getDhakaDateString(lead.createdAt);
 if (!leadDateDhaka || leadDateDhaka !== todayDhaka) return false;
 }
 
 // 6.6. Confirmed Filter
 if (isConfirmedFilterActive && lead.status !== 'won') return false;
 
 // 6.7. Pending Filter
 if (isPendingFilterActive && !['new', 'contacted', 'followup'].includes(lead.status)) return false;

 // 7. Created Date Filter
 if (dateRangeFilter !== 'all') {
 const leadDateDhaka = getDhakaDateString(lead.createdAt);
 if (!leadDateDhaka) return false;
 
 let start = '', end = '';
 if (dateRangeFilter === 'custom') {
 start = customDateRange.start;
 end = customDateRange.end;
 } else {
 const range = getDateRangeBoundaries(dateRangeFilter as any);
 start = range.start;
 end = range.end;
 }
 if (start && end && (leadDateDhaka < start || leadDateDhaka > end)) return false;
 }

 // 7.5. Follow-Up Date Filter (Dropdown)
 if (followUpDateFilter !== 'all') {
 const rawFollowUp = lead.followUpDate || lead.nextFollowUpDate;
 const followUpStr = typeof rawFollowUp === 'string' ? rawFollowUp : '';
 const followUpDateDhaka = getDhakaDateString(followUpStr);

 if (followUpDateFilter === 'noDate') {
 if (followUpDateDhaka) return false;
 } else if (followUpDateFilter === 'today') {
 if (!followUpDateDhaka || followUpDateDhaka !== todayDhaka || lead.status === 'won') {
 return false;
 }
 } else if (followUpDateFilter === 'tomorrow') {
 const tom = new Date();
 tom.setDate(tom.getDate() + 1);
 const tomDhaka = getDhakaDateString(tom.toISOString());
 if (!followUpDateDhaka || followUpDateDhaka !== tomDhaka) return false;
 } else if (followUpDateFilter === 'thisWeek') {
 const now = new Date();
 const start = getDhakaDateString(now.toISOString());
 const endD = new Date(now);
 endD.setDate(endD.getDate() + 7);
 const end = getDhakaDateString(endD.toISOString());
 if (!followUpDateDhaka || followUpDateDhaka < start || followUpDateDhaka > end) return false;
 } else if (followUpDateFilter === 'overdue') {
 if (!followUpDateDhaka || followUpDateDhaka >= todayDhaka || lead.status === 'won') {
 return false;
 }
 }
 }

 // 8. Post Filter
 if (postFilter !== 'all' && lead.lastPostId !== postFilter) return false;

 return true;
 }).sort((a,b) => {
 if (sortBy === 'newest') {
 const timeA = new Date(a.lastMessageAt || a.createdAt).getTime() || 0;
 const timeB = new Date(b.lastMessageAt || b.createdAt).getTime() || 0;
 return timeB - timeA;
 }
 if (sortBy === 'oldest') {
 const timeA = new Date(a.lastMessageAt || a.createdAt).getTime() || 0;
 const timeB = new Date(b.lastMessageAt || b.createdAt).getTime() || 0;
 return timeA - timeB;
 }
 if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'bn');
 if (sortBy === 'value') return (b.estimatedValue || 0) - (a.estimatedValue || 0);
 return 0;
 });
 }, [pageLeads, sourceFilter, searchQuery, statusFilter, isFollowUpFilterActive, isTodayNewFilterActive, isConfirmedFilterActive, isPendingFilterActive, dateRangeFilter, customDateRange, followUpDateFilter, tagFilter, assignedFilter, postFilter, sortBy]);

 // Firebase Auth listener on startup (Multi-User Google Login)
 useEffect(() => {
 if (isFb) {
 setIsAuthChecking(true);
 const unsubscribe = firebaseAuthService.subscribeAuthState(async (firebaseUser) => {
 if (firebaseUser) {
 const userEmail = (firebaseUser.email || '').toLowerCase().trim();
 const admin: AdminUser = {
 uid: firebaseUser.uid,
 email: firebaseUser.email || userEmail,
 name: firebaseUser.displayName || userEmail.split('@')[0],
 role: userEmail === PRIMARY_ADMIN_EMAIL.toLowerCase() ? 'super_admin' : 'admin',
 lastLogin: new Date().toISOString(),
 };
 // Initial set - will be refined by WorkspaceProvider
 leadService.setActiveUserId(firebaseUser.uid);
 leadService.setCurrentOperator(firebaseUser.uid, admin.name);
 setCurrentUser(admin);
 setAuthError(null);
 } else {
 leadService.setActiveUserId(null);
 leadService.setCurrentOperator('', '');
 setCurrentUser(null);
 setLeads([]);
 }
 setIsAuthChecking(false);
 });

 return () => unsubscribe();
 } else {
 setIsAuthChecking(false);
 }
 }, [isFb]);

 // Real-time Firestore onSnapshot per-user subscription (users/{uid}/leads)
 useEffect(() => {
 if (!currentUser || workspaceLoading || workspaceError || !ownerUid) return;

 leadService.setWorkspaceOwnerId(ownerUid);
 leadService.setCurrentOperator(currentUser.uid || '', currentUser.name);

 const unsubscribe = leadService.subscribeToLeads(
 (updatedLeads, debugInfo) => {
 setLeads(updatedLeads);
 if (debugInfo) {
 setFirestoreDebug(debugInfo);
 }
 setFirestoreError(null); // Clear error on successful sync
 setSelectedLead((prev) => {
 if (!prev) return null;
 return updatedLeads.find((l) => l.id === prev.id) || null;
 });
 },
 (errorPayload, debugInfo) => {
 console.error('Firestore Error in App:', errorPayload);
 setFirestoreError(errorPayload);
 if (debugInfo) {
 setFirestoreDebug(debugInfo);
 }
 },
 ownerUid
 );

 return () => unsubscribe();
 }, [ownerUid, currentUser, workspaceLoading, workspaceError, isFb]);

 // Auth state listener event
 useEffect(() => {
 const onAuthChange = () => {
 if (!isFb) {
 setCurrentUser(authService.getCurrentUser());
 }
 };
 window.addEventListener('auth_state_changed', onAuthChange);
 return () => window.removeEventListener('auth_state_changed', onAuthChange);
 }, [isFb]);

 // Synchronize route with URL hash for browser Back/Forward & refresh support
 useEffect(() => {
 const syncRouteFromHash = () => {
 const hash = typeof window !== 'undefined' ? window.location.hash || '' : '';
 if (hash in ROUTE_TO_CARD_TYPE) {
 setActiveCardPage(ROUTE_TO_CARD_TYPE[hash]);
 setActiveTab('inbox');
 mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
 } else {
 setActiveCardPage(null);
 if (hash === '#/pipeline') setActiveTab('pipeline');
 else if (hash === '#/reports') setActiveTab('reports');
 else if (hash === '#/integrations') setActiveTab('integrations');
 else if (hash === '#/settings') setActiveTab('settings');
 else if (hash === '#/inbox' || hash === '' || hash === '#/') setActiveTab('inbox');
 }
 };

 syncRouteFromHash();
 window.addEventListener('hashchange', syncRouteFromHash);
 return () => window.removeEventListener('hashchange', syncRouteFromHash);
 }, []);

 const handleOpenCardPage = (cardType: CardFilterType) => {
 const route = CARD_TYPE_TO_ROUTE[cardType];
 window.location.hash = route;
 setActiveCardPage(cardType);
 mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
 };

 const handleReturnToDashboard = () => {
 window.location.hash = '#/inbox';
 setActiveCardPage(null);
 mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
 };

 // Summary statistics scoped to the selected page and month
 const stats = React.useMemo(() => {
 return leadService.getSummaryStats(pageLeads, selectedMonth);
 }, [pageLeads, selectedMonth, ownerUid]); // Re-calculate when ownerUid changes

 // Direct refresh helper
 const refreshLeads = () => {
 const updated = leadService.getLeads(ownerUid);
 setLeads(updated);
 if (selectedLead) {
 const found = updated.find((l) => l.id === selectedLead.id);
 setSelectedLead(found || null);
 }
 };

 // Toast Notification helper
 const showToast = (text: string, isDuplicate = false, type: 'success' | 'error' = 'success', onUndo?: () => void) => {
 setToastMessage({ text, isDuplicate, type, onUndo });
 setTimeout(() => {
 setToastMessage(null);
 }, 10000);
 };

 // Actions
 const handleStatusChange = (leadId: string, newStatus: LeadStatus) => {
 leadService.updateLead(leadId, { status: newStatus }, currentUser?.name || 'অ্যাডমিন');
 refreshLeads();
 };

 const handleConfirmedCardClick = () => {
 if (isConfirmedFilterActive) {
 setIsConfirmedFilterActive(false);
 setStatusFilter('all');
 } else {
 setIsConfirmedFilterActive(true);
 setIsPendingFilterActive(false);
 setStatusFilter('won');
 }
 };

 const handlePendingCardClick = () => {
 if (isPendingFilterActive) {
 setIsPendingFilterActive(false);
 } else {
 setIsPendingFilterActive(true);
 setIsConfirmedFilterActive(false);
 setStatusFilter('all');
 }
 };

 // Search leads matching query across all active leads
 const matchingSearchLeads = React.useMemo(() => {
 if (!searchQuery.trim()) return [];
 const q = searchQuery.toLowerCase().trim();
 return activeLeads.filter((lead) => {
 const nameMatch = (lead.name || '').toLowerCase().includes(q);
 const phoneMatch = Boolean(
 (lead.phone && String(lead.phone).includes(q)) ||
 (lead.originalPhone && String(lead.originalPhone).includes(q))
 );
 const emailMatch = Boolean(lead.email && String(lead.email).toLowerCase().includes(q));
 const messengerMatch = Boolean(lead.messengerId && String(lead.messengerId).toLowerCase().includes(q));
 const productMatch = (lead.productInterest || '').toLowerCase().includes(q);
 return nameMatch || phoneMatch || emailMatch || messengerMatch || productMatch;
 });
 }, [activeLeads, searchQuery]);

 const handleTotalLeadsCardClick = () => {
 handleOpenCardPage('all');
 };

 const handleToggleStar = (leadId: string) => {
 leadService.toggleStar(leadId);
 refreshLeads();
 };

 const handleUpdateLead = (id: string, updates: Partial<Lead>) => {
 leadService.updateLead(id, updates, currentUser?.name || 'অ্যাডমিন');
 refreshLeads();
 showToast('লিড সফলভাবে আপডেট করা হয়েছে!');
 };

 const handleAddNote = (leadId: string, content: string, author?: string) => {
 leadService.addNote(leadId, content, author || currentUser?.name || 'অ্যাডমিন');
 refreshLeads();
 showToast('নতুন নোট যোগ করা হয়েছে');
 };

 const handleDeleteLead = async (leadId: string): Promise<{ success: boolean; message: string }> => {
 if (role !== 'owner') {
   return { success: false, message: 'শুধুমাত্র মালিক লিড মুছতে পারবেন।' };
 }
 try {
 await leadService.softDeleteLead(leadId);
 refreshLeads();
 if (selectedLead?.id === leadId) setSelectedLead(null);
 
 showToast('লিড ট্র্যাশে পাঠানো হয়েছে', false, 'success', async () => {
 await leadService.restoreLead(leadId);
 refreshLeads();
 showToast('লিডটি ফেরত আনা হয়েছে');
 });
 
 return { success: true, message: 'সফলভাবে মুছে ফেলা হয়েছে' };
 } catch (err: any) {
 const msg = `লিড মুছতে সমস্যা হয়েছে: ${err?.message || err}`;
 showToast(msg, false, 'error');
 return { success: false, message: msg };
 }
 };

 const handleLeadAdded = (result: { isDuplicate: boolean; notificationMessage: string; lead: Lead }) => {
 refreshLeads();
 showToast(result.notificationMessage, result.isDuplicate);
 setSelectedLead(result.lead);
 };

 const handleExport = () => {
 if (role !== 'owner') {
   showToast('শুধুমাত্র মালিক লিড এক্সপোর্ট করতে পারবেন।', false, 'error');
   return;
 }
 exportLeadsToCSV(filteredLeads, `unified-leads-${new Date().toISOString().split('T')[0]}.csv`);
 showToast('সব লিড CSV ফরম্যাটে ডাউনলোড হয়েছে!');
 };

 const handleUpdateFollowUpDate = async (leadId: string, newFollowUpDate: string | null) => {
 await leadService.updateLead(leadId, {
 followUpDate: newFollowUpDate,
 nextFollowUpDate: newFollowUpDate,
 }, currentUser?.name || 'অ্যাডমিন');
 refreshLeads();
 if (newFollowUpDate) {
 showToast('ফলো-আপ তারিখ সফলভাবে সেট করা হয়েছে!');
 } else {
 showToast('ফলো-আপ তারিখ মুছে ফেলা হয়েছে');
 }
 };

 const handleResetFilters = () => {
 setSourceFilter('all');
 setSearchQuery('');
 setIsFollowUpFilterActive(false);
 setIsTodayNewFilterActive(false);
 setDateRangeFilter('all');
 setCustomDateRange({ start: '', end: '' });
 setFollowUpDateFilter('all');
 setStatusFilter('all');
 setTagFilter('all');
 setAssignedFilter('all');
 setPostFilter('all');
 setPageFilter('all');
 showToast('ফিল্টার রিসেট হয়েছে');
 };

 // 1. Loading Splash while checking Firebase Auth state or Workspace
 if (isAuthChecking || workspaceLoading) {
 return (
 <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[var(--bg-page)] font-sans text-[var(--text-primary)]">
 <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-xl animate-pulse">
 <Layers className="h-7 w-7" />
 </div>
 <p className="mt-4 text-[13px] font-bold text-[var(--text-secondary)]">
 {workspaceLoading ? 'ওয়ার্কস্পেস লোড হচ্ছে...' : 'Firebase Authentication যাচাই হচ্ছে...'}
 </p>
 </div>
 );
 }

 // 2. If not authenticated, render Clean Google Login Gate (Requirement 2)
 if (!currentUser) {
 return (
 <AdminLoginView
 onLoginSuccess={(user) => {
 setCurrentUser(user);
 setAuthError(null);
 }}
 initialError={authError || undefined}
 />
 );
 }

 // 3. Workspace Error / Unauthorized State
 if (workspaceError) {
 return (
 <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-[var(--bg-page)] p-6 text-center">
 <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-50 text-rose-500 shadow-sm">
 <UserX className="h-10 w-10" />
 </div>
 <h2 className="mb-2 text-xl font-black text-[var(--text-primary)]">প্রবেশাধিকার নেই</h2>
 <div className="max-w-md rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-sm font-medium text-rose-800">
 {workspaceError}
 <p className="mt-2 text-[12px] opacity-70">আপনার জিমেইল ({currentUser?.email}) টিমে যোগ করা হয়নি। মালিকের সাথে যোগাযোগ করুন।</p>
 </div>
 <button
 onClick={() => firebaseAuthService.logout()}
 className="mt-8 flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-slate-800 transition"
 >
 <span>অন্য অ্যাকাউন্টে ঢুকুন</span>
 </button>
 </div>
 );
 }

 return (
 <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)] font-sans">
 {/* Sidebar */}
 <Sidebar
 activeTab={activeTab}
 onTabChange={(tab) => {
 setActiveTab(tab);
 if (tab === 'inbox') {
 handleReturnToDashboard();
 } else {
 setActiveCardPage(null);
 window.location.hash = `#/${tab}`;
 mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
 }
 }}
 stats={stats}
 onOpenAddModal={() => setIsAddModalOpen(true)}
 isMobileOpen={isMobileSidebarOpen}
 onCloseMobile={() => setIsMobileSidebarOpen(false)}
 currentUser={{ ...currentUser, role: role === 'owner' ? 'super_admin' : 'admin' }} // Map to Sidebar expected roles
 onLogout={async () => {
 await firebaseAuthService.logout();
 setCurrentUser(null);
 setLeads([]);
 }}
 themeMode={themeMode}
 onToggleTheme={handleToggleTheme}
 />

 {/* Main Content Area */}
 <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-app)]">
 {/* Requirement 4: Firestore Error Banner */}
 {firestoreError && (
 <div className="flex items-center justify-between gap-3 bg-rose-600 px-4 py-2.5 text-xs text-white shadow-md animate-in fade-in duration-200">
 <div className="flex items-center gap-2">
 <AlertTriangle className="h-4 w-4 shrink-0" />
 <span>
 <strong>Firestore ত্রুটি [{firestoreError.code}]:</strong> {firestoreError.details}
 </span>
 </div>
 <button
 onClick={() => setFirestoreError(null)}
 className="shrink-0 rounded bg-rose-700 hover:bg-rose-800 px-2.5 py-1 text-[11px] font-bold"
 >
 বন্ধ করুন
 </button>
 </div>
 )}

 {/* Top Header */}
 <TopHeader
 activeTab={activeTab}
 onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
 onOpenAddModal={() => setIsAddModalOpen(true)}
 searchQuery={searchQuery}
 onSearchChange={setSearchQuery}
 onExport={handleExport}
 onResetFilters={() => setIsResetModalOpen(true)}
 themeMode={themeMode}
 onThemeChange={setThemeMode}
 />

 {/* Scrollable Viewport */}
 <main ref={mainScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
 {/* TAB 1: INBOX */}
 {activeTab === 'inbox' && (
 activeCardPage ? (
 <CardLeadPageView
 cardType={activeCardPage}
 allLeads={leads}
 onBack={handleReturnToDashboard}
 onSelectLead={(lead) => setSelectedLead(lead)}
 onQuickStatusChange={handleStatusChange}
 onToggleStar={handleToggleStar}
 onUpdateFollowUpDate={handleUpdateFollowUpDate}
 selectedMonth={selectedMonth}
 onMonthChange={setSelectedMonth}
 stats={stats}
 />
 ) : (
 <div className="space-y-4">
 {/* 12 Summary Boxes in 4+4+4 Grid */}
 <SummaryCards
 stats={stats}
 selectedSourceFilter={sourceFilter}
 onSelectSource={(src) => setSourceFilter(src)}
 onSelectTotalLeads={handleTotalLeadsCardClick}
 isFollowUpFilterActive={isFollowUpFilterActive}
 onToggleFollowUpFilter={() => setIsFollowUpFilterActive(!isFollowUpFilterActive)}
 isTodayNewFilterActive={isTodayNewFilterActive}
 onToggleTodayNewFilter={() => setIsTodayNewFilterActive(!isTodayNewFilterActive)}
 isConfirmedFilterActive={isConfirmedFilterActive}
 onToggleConfirmedFilter={handleConfirmedCardClick}
 isPendingFilterActive={isPendingFilterActive}
 onTogglePendingFilter={handlePendingCardClick}
 statusFilter={statusFilter}
 onStatusFilterChange={setStatusFilter}
 selectedMonth={selectedMonth}
 onMonthChange={setSelectedMonth}
 onOpenCardPage={handleOpenCardPage}
 />

 {/* Search Results: shown only when user searches */}
 {searchQuery.trim() && (
 <SearchResultsView
 searchQuery={searchQuery}
 matchingLeads={matchingSearchLeads}
 onSelectLead={(lead) => setSelectedLead(lead)}
 onClearSearch={() => setSearchQuery('')}
 onToggleStar={handleToggleStar}
 />
 )}
 </div>
 )
 )}

 {/* TAB 2: PIPELINE (KANBAN) */}
 {activeTab === 'pipeline' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-base font-bold text-[var(--text-primary)]">
 সেলস পাইপলাইন বোর্ড
 </h2>
 <p className="text-xs text-[var(--text-secondary)]">
 লিড কার্ড ড্র্যাগ করে অথবা তীরের বাটনে ক্লিক করে পরবর্তী ধাপে নিন
 </p>
 </div>
 </div>

 <KanbanBoard
 leads={leads}
 onSelectLead={(lead) => setSelectedLead(lead)}
 onStatusChange={handleStatusChange}
 />
 </div>
 )}

 {/* TAB 3: REPORTS & ANALYTICS */}
 {activeTab === 'reports' && <ReportsView leads={leads} stats={stats} />}

 {/* TAB 4: IMPORT & INTEGRATIONS */}
 {activeTab === 'integrations' && role === 'owner' && (
 <ImportExportView
 leads={leads}
 onLeadsUpdated={refreshLeads}
 onShowToast={showToast}
 currentUser={currentUser}
 />
 )}

 {/* TAB 5: SETTINGS */}
 {activeTab === 'settings' && (
 <SettingsView
 leads={leads}
 onLeadsUpdated={refreshLeads}
 onShowToast={showToast}
 currentUser={currentUser}
 showDeleted={showDeleted}
 onShowDeletedChange={setShowDeleted}
 />
 )}
 </main>
 </div>

 {/* Slide-in Lead Details Panel */}
 <LeadDetailDrawer
 lead={selectedLead}
 isOpen={Boolean(selectedLead)}
 onClose={() => setSelectedLead(null)}
 onUpdateLead={handleUpdateLead}
 onAddNote={handleAddNote}
 onDeleteLead={handleDeleteLead}
 />

 {/* Add Lead Modal */}
 <AddLeadModal
 isOpen={isAddModalOpen}
 onClose={() => setIsAddModalOpen(false)}
 onLeadAdded={handleLeadAdded}
 />
 <ResetOptionsModal
 isOpen={isResetModalOpen}
 onClose={() => setIsResetModalOpen(false)}
 onResetFilters={handleResetFilters}
 onLeadsUpdated={refreshLeads}
 onShowToast={showToast}
 leads={leads}
 />

 {/* Global Toast Notification */}
 {toastMessage && (
 <div
 className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border p-4 shadow-xl max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200 ${
 toastMessage.type === 'error'
 ? 'border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]'
 : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
 }`}
 >
 <div
 className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
 toastMessage.type === 'error'
 ? 'bg-[var(--danger-bg)] text-[var(--danger)]'
 : toastMessage.isDuplicate
 ? 'bg-purple-100 text-purple-600'
 : 'bg-emerald-100 text-[var(--success)]'
 }`}
 >
 {toastMessage.type === 'error' ? (
 <AlertTriangle className="h-4 w-4" />
 ) : toastMessage.isDuplicate ? (
 <Sparkles className="h-4 w-4" />
 ) : (
 <CheckCircle2 className="h-4 w-4" />
 )}
 </div>
 <div className="flex-1 text-xs font-medium leading-snug">
 {toastMessage.text}
 </div>
 {toastMessage.onUndo && (
 <button
 onClick={() => {
 toastMessage.onUndo?.();
 setToastMessage(null);
 }}
 className="text-xs font-bold text-[var(--accent)] hover underline"
 >
 আনডু
 </button>
 )}
 <button
 onClick={() => setToastMessage(null)}
 className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] p-1"
 >
 <X className="h-4 w-4" />
 </button>
 </div>
 )}
 </div>
 );
}
