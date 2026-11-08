import React, { useState, useEffect } from 'react';
import {
 Users,
 Tag,
 Database,
 RotateCcw,
 Download,
 Plus,
 Trash2,
 Flame,
 Check,
 HelpCircle,
 Copy,
 ChevronDown,
 ChevronUp,
 Mail,
 UserCheck,
 ShieldAlert,
 UserMinus,
 UserPlus,
 Power,
 PowerOff,
} from 'lucide-react';
import { Lead } from '../../types/lead';
import { leadService } from '../../services/leadService';
import { authService, AdminUser } from '../../services/authService';
import { exportLeadsToCSV, toBengaliNumerals, PRESET_TAGS } from '../../utils/formatters';
import {
 getSavedFirebaseConfig,
 saveFirebaseConfig,
 isFirebaseConfigured,
 FirebaseClientConfig,
} from '../../firebase/config';
import { PRIMARY_ADMIN_EMAIL } from '../../config/authConfig';
import { FacebookPageConnectSection } from './FacebookPageConnectSection';
import { useWorkspace } from '../../context/WorkspaceContext';

interface SettingsViewProps {
 leads: Lead[];
 onLeadsUpdated: () => void;
 onShowToast: (msg: string) => void;
 currentUser?: AdminUser | null;
 showDeleted: boolean;
 onShowDeletedChange: (show: boolean) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
 leads,
 onLeadsUpdated,
 onShowToast,
 currentUser,
 showDeleted,
 onShowDeletedChange,
}) => {
 const { ownerUid, role } = useWorkspace();
 const activeUser = currentUser || authService.getCurrentUser();
 
 // Team Members State (Firestore)
 const [dynamicTeamMembers, setDynamicTeamMembers] = useState<any[]>([]);
 const [isAddingMember, setIsAddingMember] = useState(false);
 const [newMemberName, setNewMemberName] = useState('');
 const [newMemberEmail, setNewMemberEmail] = useState('');

 // Local tags state (keeping as is for now, but could be moved to Firestore)
 const [tags, setTags] = useState<string[]>(PRESET_TAGS);
 const [newTag, setNewTag] = useState('');

 // Firebase Config State
 const savedConfig = getSavedFirebaseConfig();
 const [apiKey, setApiKey] = useState(savedConfig?.apiKey || '');
 const [authDomain, setAuthDomain] = useState(savedConfig?.authDomain || 'post-510005.firebaseapp.com');
 const [projectId, setProjectId] = useState(savedConfig?.projectId || 'post-510005');
 const [storageBucket, setStorageBucket] = useState(savedConfig?.storageBucket || 'post-510005.appspot.com');
 const [messagingSenderId, setMessagingSenderId] = useState(savedConfig?.messagingSenderId || '');
 const [appId, setAppId] = useState(savedConfig?.appId || '');
 const [isFirebaseConnected, setIsFirebaseConnected] = useState(true);
 const [showFirebaseGuide, setShowFirebaseGuide] = useState(false);
 const [isFirebaseSaving, setIsFirebaseSaving] = useState(false);
 const [copiedRules, setCopiedRules] = useState(false);

 // Admin Credentials State
 const initialCreds = authService.getCredentials();
 const [adminEmail, setAdminEmail] = useState(initialCreds.email);
 const [adminPassword, setAdminPassword] = useState(initialCreds.password);
 const [adminName, setAdminName] = useState(initialCreds.name);
 const [isCredsSaved, setIsCredsSaved] = useState(false);

 // Lead Import State
 const [importOldUid, setImportOldUid] = useState('PSkU59uy7KVKCCjJvAusiG5ED5y2');
 const [isImportingLeads, setIsImportingLeads] = useState(false);

 const handleImportOldLeads = async () => {
   if (!importOldUid.trim()) return;
   setIsImportingLeads(true);
   try {
     const count = await leadService.importLeadsFromUserUid(importOldUid.trim());
     onLeadsUpdated();
     onShowToast(`সফলভাবে ${toBengaliNumerals(count)} টি লিড sharedLeads কালেকশনে ইমপোর্ট করা হয়েছে!`);
     setImportOldUid('');
   } catch (err) {
     console.error('Import error:', err);
     alert('ইমপোর্ট করতে সমস্যা হয়েছে। UID ঠিক আছে কিনা পরীক্ষা করুন।');
   } finally {
     setIsImportingLeads(false);
   }
 };

 // Subscribe to team members if owner
 useEffect(() => {
   if (role === 'owner' && ownerUid) {
     const unsubscribe = leadService.subscribeToTeamMembers(ownerUid, (members) => {
       setDynamicTeamMembers(members);
     });
     return () => unsubscribe();
   }
 }, [role, ownerUid]);

 const handleSaveFirebaseConfig = (e: React.FormEvent) => {
 e.preventDefault();
 setIsFirebaseSaving(true);

 const config: FirebaseClientConfig = {
 apiKey: apiKey.trim(),
 authDomain: authDomain.trim(),
 projectId: projectId.trim(),
 storageBucket: storageBucket.trim(),
 messagingSenderId: messagingSenderId.trim(),
 appId: appId.trim(),
 };

 saveFirebaseConfig(config);

 // CRITICAL: Clear legacy localStorage mock leads & session
 localStorage.removeItem('unified_lead_inbox_leads_v1');
 localStorage.removeItem('unified_lead_inbox_firestore_v2');
 localStorage.removeItem('unified_lead_admin_auth_v1');

 setIsFirebaseConnected(true);
 setIsFirebaseSaving(false);
 onShowToast('Firebase কনফিগারেশন সংরক্ষিত! এখন Google দিয়ে লগইন করুন।');

 // Notify auth change
 window.dispatchEvent(new CustomEvent('auth_state_changed'));
 };

 const handleUpdateCreds = (e: React.FormEvent) => {
 e.preventDefault();
 authService.updateCredentials(adminEmail, adminPassword, adminName);
 setIsCredsSaved(true);
 setTimeout(() => setIsCredsSaved(false), 2500);
 onShowToast('অ্যাডমিন তথ্য সফলভাবে আপডেট করা হয়েছে!');
 };

 const handleAddTeamMember = async (e: React.FormEvent) => {
   e.preventDefault();
   if (!ownerUid || !currentUser) return;
   
   const email = newMemberEmail.toLowerCase().trim();
   if (!email || !newMemberName.trim()) return;

   if (dynamicTeamMembers.some(m => m.email === email)) {
     alert('এই ইমেইলটি ইতিমধ্যে টিমে যোগ করা আছে।');
     return;
   }

   try {
     await leadService.addTeamMember(email, newMemberName.trim(), ownerUid, currentUser?.uid || currentUser?.email || 'admin');
     setNewMemberName('');
     setNewMemberEmail('');
     setIsAddingMember(false);
     onShowToast(`টিম মেম্বার "${newMemberName}" যোগ করা হয়েছে।`);
   } catch (err) {
     console.error('Add team member error:', err);
     alert('টিম মেম্বার যোগ করতে সমস্যা হয়েছে।');
   }
 };

 const handleToggleMemberStatus = async (email: string, currentStatus: boolean) => {
   if (!window.confirm(`আপনি কি এই মেম্বারের অ্যাক্সেস ${currentStatus ? 'বন্ধ' : 'চালু'} করতে চান?`)) return;
   try {
     await leadService.updateTeamMemberStatus(email, !currentStatus);
     onShowToast('স্ট্যাটাস আপডেট করা হয়েছে।');
   } catch (err) {
     alert('আপডেট করতে সমস্যা হয়েছে।');
   }
 };

 const handleRemoveTeamMember = async (email: string) => {
   if (!window.confirm('আপনি কি নিশ্চিত যে এই মেম্বারকে টিম থেকে চিরতরে বাদ দিতে চান?')) return;
   try {
     await leadService.removeTeamMember(email);
     onShowToast('টিম থেকে বাদ দেওয়া হয়েছে।');
   } catch (err) {
     alert('মুছে ফেলতে সমস্যা হয়েছে।');
   }
 };

 const handleAddTag = (e: React.FormEvent) => {
 e.preventDefault();
 if (newTag.trim() && !tags.includes(newTag.trim())) {
 setTags([...tags, newTag.trim()]);
 setNewTag('');
 onShowToast(`ট্যাগ "${newTag.trim()}" তৈরি হয়েছে`);
 }
 };

 const handleRemoveTag = (tag: string) => {
 setTags(tags.filter((t) => t !== tag));
 onShowToast(`ট্যাগ "${tag}" মুছে ফেলা হয়েছে`);
 };

 // Requirement 5: Load demo leads on explicit button click
 const handleLoadDemoLeads = async () => {
 if (window.confirm('আপনি কি ১৬টি ডেমো লিড লোড করতে চান?')) {
 const count = await leadService.loadDemoLeads();
 onLeadsUpdated();
 onShowToast(`সফলভাবে ${toBengaliNumerals(count)} টি ডেমো লিড লোড করা হয়েছে!`);
 }
 };

 const handleFixDates = async () => {
 if (window.confirm('সকল লিডের ভুল বা পুরনো ফলো-আপ তারিখ ও সময় পরীক্ষা করে সঠিক (আজ বা সর্বশেষ মেসেজ অনুযায়ী) ঠিক করতে চান?')) {
 const fixed = await leadService.fixAllLeadsFollowUpDates();
 onLeadsUpdated();
 onShowToast(`সফলভাবে ${toBengaliNumerals(fixed)} টি লিডের তারিখ ও ফলো-আপ সংশোধন করা হয়েছে!`);
 }
 };

 // Requirement 5: Delete only demo leads, preserving real user-added leads
 const handleDeleteDemoLeads = async () => {
 if (
 window.confirm(
 'আপনি কি নিশ্চিত যে ডেমো লিডগুলো মুছে ফেলতে চান? আপনার তৈরি করা বা ইমপোর্ট করা আসল লিডগুলো অক্ষত থাকবে।'
 )
 ) {
 const res = await leadService.deleteDemoLeads();
 onLeadsUpdated();
 onShowToast(
 `সফলভাবে ${toBengaliNumerals(res.deletedCount)} টি ডেমো লিড মুছে ফেলা হয়েছে! বর্তমান আসল লিড: ${toBengaliNumerals(
 res.remainingCount
 )} টি।`
 );
 }
 };

 // Clear all leads completely
 const handleClearAllLeads = async () => {
 if (window.confirm('সতর্কতা: আপনি কি ইনবক্সের সমস্ত লিড স্থায়ীভাবে মুছে ফেলতে চান?')) {
 await leadService.clearAllLeads();
 onLeadsUpdated();
 onShowToast('সমস্ত লিড মুছে ফেলা হয়েছে!');
 }
 };

 // Export full JSON database backup
 const handleExportJSON = () => {
 const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(leads, null, 2));
 const downloadAnchor = document.createElement('a');
 downloadAnchor.setAttribute('href', dataStr);
 downloadAnchor.setAttribute('download', `leads-backup-${new Date().toISOString().split('T')[0]}.json`);
 document.body.appendChild(downloadAnchor);
 downloadAnchor.click();
 downloadAnchor.remove();
 onShowToast('সম্পূর্ণ ডাটাবেজ ব্যাকআপ ডাউনলোড সম্পন্ন!');
 };

 const firestoreRulesText = (ownerUid || 'OWNER_UID');

 return (
 <div className="space-y-6 max-w-4xl">
  {role === 'owner' && (
  <>
  {/* 1. Firebase Integration & Setup Card */}
  <div className="rounded-xl border border-[var(--border)]/80 bg-[var(--bg-surface)] p-5 shadow-2xs ">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border)]/80 pb-3 ">
  <div className="flex items-center gap-2.5">
  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600 ">
  <Flame className="h-5 w-5" />
  </div>
  <div>
  <div className="flex items-center gap-2">
  <h3 className="text-sm font-bold text-[var(--text-primary)] ">
  Firebase Firestore ও Auth ইন্টিগ্রেশন
  </h3>
  {isFirebaseConnected ? (
  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--success)] ">
  <Check className="h-3 w-3" />
  সংযুক্ত
  </span>
  ) : (
  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--warning)] ">
  কনফিগারেশন বাকি
  </span>
  )}
  </div>
  <p className="text-xs text-[var(--text-secondary)] ">
  Google Authentication ও ক্লাউড ফায়ারস্টোর রিয়েল-টাইম ডেটাবেজ
  </p>
  </div>
  </div>

  <button
  onClick={() => setShowFirebaseGuide(!showFirebaseGuide)}
  className="flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent)] "
  >
  <HelpCircle className="h-4 w-4" />
  <span>কীভাবে সেটআপ করবেন?</span>
  {showFirebaseGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
  </button>
  </div>

  {/* Step-by-Step Setup Guide Accordion */}
  {showFirebaseGuide && (
  <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--accent-soft)]/70 p-4 text-xs text-[var(--text-primary)] space-y-3">
  <h4 className="font-bold text-blue-900 ">
  Firebase সেটআপ করার সহজ ৪টি ধাপ:
  </h4>
  <ol className="list-decimal pl-5 space-y-2 text-[12px] leading-relaxed">
  <li>
  <strong>প্রজেক্ট তৈরি:</strong>{' '}
  <a
  href="https://console.firebase.google.com"
  target="_blank"
  rel="noopener noreferrer"
  className="text-[var(--accent)] underline font-semibold"
  >
  console.firebase.google.com
  </a>
  -এ গিয়ে "Add project"-এ ক্লিক করে একটি প্রজেক্ট তৈরি করুন।
  </li>
  <li>
  <strong>Authentication চালু:</strong> বাম পাশের মেনু থেকে <strong>Build &gt; Authentication</strong>-এ যান। <strong>Sign-in method</strong> ট্যাবে গিয়ে <strong>Google</strong> সিলেক্ট করে Enable করুন এবং আপনার সাপোর্ট ইমেইল ({PRIMARY_ADMIN_EMAIL}) দিন।
  </li>
  <li>
  <strong>Authorized Domains যোগ:</strong> Authentication-এর <strong>Settings &gt; Authorized domains</strong> ট্যাবে গিয়ে <strong>Add domain</strong>-এ ক্লিক করে আপনার বর্তমান অ্যাপ ডোমেনটি (<code className="font-mono bg-blue-100 px-1 py-0.5 rounded text-[11px]">{typeof window !== 'undefined' ? window.location.hostname : ''}</code>) যোগ করুন। এটি না করলে <code>auth/unauthorized-domain</code> এরর আসবে।
  </li>
  <li>
  <strong>Firestore Database তৈরি:</strong> <strong>Build &gt; Firestore Database</strong>-এ ক্লিক করে "Create database" করুন।
  </li>
  </ol>
  </div>
  )}

  {/* Firebase Config Form */}
  <form onSubmit={handleSaveFirebaseConfig} className="mt-4 space-y-3 text-xs">
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
  <div>
  <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
  API Key <span className="text-rose-500">*</span>
  </label>
  <input
  type="text"
  required
  value={apiKey}
  onChange={(e) => setApiKey(e.target.value)}
  placeholder="AIzaSy..."
  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2 font-mono text-xs "
  />
  </div>

  <div>
  <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
  Auth Domain <span className="text-rose-500">*</span>
  </label>
  <input
  type="text"
  required
  value={authDomain}
  onChange={(e) => setAuthDomain(e.target.value)}
  placeholder="your-app.firebaseapp.com"
  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2 font-mono text-xs "
  />
  </div>

  <div>
  <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
  Project ID <span className="text-rose-500">*</span>
  </label>
  <input
  type="text"
  required
  value={projectId}
  onChange={(e) => setProjectId(e.target.value)}
  placeholder="your-project-id"
  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2 font-mono text-xs "
  />
  </div>
  </div>

  <div className="flex justify-end pt-2">
  <button
  type="submit"
  disabled={isFirebaseSaving}
  className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
  >
  <span>{isFirebaseSaving ? 'কানেক্ট হচ্ছে...' : 'Firebase কনফিগারেশন সংরক্ষণ করুন'}</span>
  </button>
  </div>
  </form>
  </div>

  {/* 2. Facebook Page Connect Section */}
  <FacebookPageConnectSection
  currentUserId={activeUser?.uid || currentUser?.uid}
  onShowToast={(msg) => onShowToast(msg)}
  />
  </>
  )}

  {/* 3. Team Management Section */}
  <div className="rounded-xl border border-[var(--border)]/80 bg-[var(--bg-surface)] p-5 shadow-2xs space-y-4">
    <div className="flex items-center justify-between border-b border-[var(--border)]/80 pb-3 ">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] ">টিম ওয়ার্কস্পেস</h3>
          <p className="text-xs text-[var(--text-secondary)] ">
            {role === 'owner' ? 'আপনার টিমে মেম্বার যোগ করুন ও পরিচালনা করুন' : 'টিম মেম্বারদের তালিকা'}
          </p>
        </div>
      </div>
      {role === 'owner' && (
        <button
          onClick={() => setIsAddingMember(!isAddingMember)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-blue-700 transition"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>নতুন মেম্বার</span>
        </button>
      )}
    </div>

    {isAddingMember && role === 'owner' && (
      <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 animate-in slide-in-from-top-2 duration-200">
        <form onSubmit={handleAddTeamMember} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-blue-900 mb-1">পুরো নাম</label>
            <input
              type="text"
              required
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="যেমন: রহিম আহমেদ"
              className="w-full rounded-lg border border-blue-200 bg-[var(--bg-surface)] p-2 text-xs focus:border-blue-500 focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-blue-900 mb-1">জিমেইল অ্যাড্রেস</label>
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="rahim@gmail.com"
                className="flex-1 rounded-lg border border-blue-200 bg-[var(--bg-surface)] p-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700"
              >
                যোগ করুন
              </button>
            </div>
          </div>
        </form>
      </div>
    )}

    <div className="space-y-2 pt-1">
      {/* Show Owner */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--border)]/60 bg-[var(--bg-elevated)]/30 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <ShieldAlert className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-primary)]">{activeUser?.name} (আপনি)</span>
              <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-700 uppercase">মালিক</span>
            </div>
            <span className="text-[10px] text-[var(--text-secondary)] font-mono">{activeUser?.email}</span>
          </div>
        </div>
        <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">সক্রিয়</div>
      </div>

      {/* Show Dynamic Members */}
      {dynamicTeamMembers.map((member) => (
        <div key={member.email} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 hover:bg-[var(--bg-page)] transition">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${member.active ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
              <Users className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${member.active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] line-through'}`}>{member.name}</span>
                <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[9px] font-bold text-blue-700 uppercase">সেলস</span>
              </div>
              <span className="text-[10px] text-[var(--text-secondary)] font-mono">{member.email}</span>
            </div>
          </div>
          
          {role === 'owner' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleMemberStatus(member.email, member.active)}
                className={`p-1.5 rounded-lg border transition-colors ${member.active ? 'border-rose-100 text-rose-500 hover:bg-rose-50' : 'border-emerald-100 text-emerald-500 hover:bg-emerald-50'}`}
                title={member.active ? 'সাময়িক বন্ধ করুন' : 'আবার চালু করুন'}
              >
                {member.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => handleRemoveTeamMember(member.email)}
                className="p-1.5 rounded-lg border border-slate-100 text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-50 transition-colors"
                title="টিম থেকে বাদ দিন"
              >
                <UserMinus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          
          {role === 'member' && (
            <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${member.active ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
              {member.active ? 'সক্রিয়' : 'বন্ধ'}
            </div>
          )}
        </div>
      ))}
      
      {role === 'owner' && dynamicTeamMembers.length === 0 && (
        <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl">
          <p className="text-[11px] text-[var(--text-secondary)]">আপনার ওয়ার্কস্পেসে কোনো টিম মেম্বার নেই।</p>
        </div>
      )}
    </div>
  </div>

  {/* 4. Multi-User Session Card (Only for owners to see their UID etc) */}
  {role === 'owner' && (
  <div className="rounded-xl border border-[var(--border)]/80 bg-[var(--accent-soft)]/20 p-4 space-y-2">
  <div className="text-[11px] font-bold text-blue-900 ">
  ওয়ার্কস্পেস ও সেশন তথ্য:
  </div>
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
  <div className="space-y-0.5">
  <div className="font-bold text-[var(--text-primary)] ">
  {activeUser?.name || 'লগইনকৃত ইউজার'}
  </div>
  <div className="font-mono text-[11px] text-[var(--text-secondary)] ">
  {activeUser?.email || 'অজানা ইমেইল'}
  </div>
  {activeUser?.uid && (
  <div className="font-mono text-[10px] text-[var(--text-secondary)] ">
  Owner UID: {activeUser.uid}
  </div>
  )}
  </div>
  <span className="inline-flex self-start sm:self-center items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 ">
  মালিকানা মুড সক্রিয়
  </span>
  </div>
  </div>
  )}

  {/* 5. Demo Leads & Database Controls (Owner Only) */}
  {role === 'owner' && (
  <div className="rounded-xl border border-[var(--border)]/80 bg-[var(--bg-surface)] p-5 shadow-2xs space-y-4">
  <div className="flex items-center gap-2 border-b border-[var(--border)]/80 pb-3 ">
  <Database className="h-4 w-4 text-emerald-500" />
  <div>
  <h3 className="text-sm font-bold text-[var(--text-primary)] ">
  ডেমো লিড ও ডেটাবেজ ব্যবস্থাপনা
  </h3>
  <p className="text-[11px] text-[var(--text-secondary)] ">
  ডেমো ডেটা লোড করুন অথবা এক ক্লিকে সম্পূর্ণ খালি করুন
  </p>
  </div>
  </div>

  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
  <button
  onClick={handleFixDates}
  className="flex flex-col items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 text-center hover:border-indigo-500 hover:bg-indigo-50 transition "
  >
  <RotateCcw className="h-5 w-5 text-indigo-600 mb-1.5" />
  <span className="text-xs font-bold text-indigo-900 ">তারিখ ঠিক করুন</span>
  </button>

  <button
  onClick={handleLoadDemoLeads}
  className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--accent-soft)]/40 p-4 text-center hover:border-blue-500 hover:bg-[var(--accent-soft)] transition "
  >
  <RotateCcw className="h-5 w-5 text-[var(--accent)] mb-1.5" />
  <span className="text-xs font-bold text-blue-900 ">ডেমো ডেটা</span>
  </button>

  <button
  onClick={handleDeleteDemoLeads}
  className="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-[var(--warning-bg)]/40 p-4 text-center hover:border-amber-500 hover:bg-[var(--warning-bg)] transition "
  >
  <Trash2 className="h-5 w-5 text-amber-600 mb-1.5" />
  <span className="text-xs font-bold text-amber-900 ">ডেমো মুছুন</span>
  </button>

  <button
  onClick={handleClearAllLeads}
  className="flex flex-col items-center justify-center rounded-xl border border-rose-200 bg-[var(--danger-bg)]/40 p-4 text-center hover:border-rose-500 hover:bg-[var(--danger-bg)] transition "
  >
  <Trash2 className="h-5 w-5 text-[var(--danger)] mb-1.5" />
  <span className="text-xs font-bold text-[var(--danger)] ">সব মুছুন</span>
  </button>

  <button
  onClick={handleExportJSON}
  className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] p-4 text-center hover:border-slate-400 hover:bg-[var(--bg-page)] transition"
  >
  <Download className="h-5 w-5 text-[var(--text-secondary)] mb-1.5 " />
  <span className="text-xs font-bold text-[var(--text-primary)] ">JSON ব্যাকআপ</span>
  </button>
  </div>
  </div>
  )}

  {/* 6. Lead Tags */}
  <div className="rounded-xl border border-[var(--border)]/80 bg-[var(--bg-surface)] p-5 shadow-2xs ">
  <div className="flex items-center gap-2 border-b border-[var(--border)]/80 pb-3 ">
  <Tag className="h-4 w-4 text-amber-500" />
  <h3 className="text-sm font-bold text-[var(--text-primary)] ">লিড ট্যাগসমূহ</h3>
  </div>

  <div className="mt-3 flex flex-wrap gap-2">
  {tags.map((tag) => (
  <div
  key={tag}
  className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-[var(--warning-bg)]/70 px-2.5 py-1 text-xs font-semibold text-amber-900 "
  >
  <span>{tag}</span>
  {role === 'owner' && (
    <button
    onClick={() => handleRemoveTag(tag)}
    className="text-amber-500 hover:text-[var(--danger)]"
    title="মুছে ফেলুন"
    >
    <Trash2 className="h-3 w-3" />
    </button>
  )}
  </div>
  ))}
  </div>

  {role === 'owner' && (
    <form onSubmit={handleAddTag} className="mt-4 flex max-w-sm gap-2">
    <input
    type="text"
    value={newTag}
    onChange={(e) => setNewTag(e.target.value)}
    placeholder="নতুন ট্যাগ..."
    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
    />
    <button
    type="submit"
    className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xs"
    >
    <Plus className="h-3.5 w-3.5" />
    <span>যোগ করুন</span>
    </button>
    </form>
  )}
  </div>

  {/* 7. Trash Section (Owner Only) */}
  {role === 'owner' && (
  <div className="rounded-xl border border-rose-200/50 bg-[var(--danger-bg)]/20 p-5 shadow-2xs space-y-4">
  <div className="flex items-center justify-between border-b border-rose-200/50 pb-3 ">
  <div className="flex items-center gap-2">
  <Trash2 className="h-4 w-4 text-[var(--danger)]" />
  <h3 className="text-sm font-bold text-[var(--text-primary)] ">ট্র্যাশ</h3>
  </div>
  {leads.filter(l => l.deleted).length > 0 && (
  <button onClick={async () => {
  for (const lead of leads.filter(l => l.deleted)) {
  await leadService.restoreLead(lead.id);
  }
  onLeadsUpdated();
  onShowToast('সব লিড ফেরত আনা হয়েছে!');
  }} className="text-xs font-bold text-[var(--accent)]">সব ফেরত আনুন</button>
  )}
  </div>
  <div className="space-y-2">
  {leads.filter(l => l.deleted).map(lead => (
  <div key={lead.id} className="flex justify-between items-center text-xs p-2 bg-[var(--bg-surface)] rounded-lg">
  <span className="font-semibold">{lead.name}</span>
  <div className="flex gap-3">
  <button onClick={async () => {
  await leadService.restoreLead(lead.id);
  onLeadsUpdated();
  onShowToast('লিডটি ফেরত আনা হয়েছে!');
  }} className="text-[var(--accent)] font-bold">ফেরত আনুন</button>
  <button onClick={async () => {
  if (window.confirm('স্থায়ীভাবে মুছে যাবে। নিশ্চিত?')) {
  await leadService.permanentlyDeleteLead(lead.id);
  onLeadsUpdated();
  onShowToast('লিডটি চিরতরে মুছে ফেলা হয়েছে।');
  }
  }} className="text-[var(--danger)] font-bold">স্থায়ীভাবে মুছুন</button>
  </div>
  </div>
  ))}
  {leads.filter(l => l.deleted).length === 0 && (
  <p className="text-xs text-[var(--text-secondary)] italic">ট্র্যাশ খালি</p>
  )}
  </div>
  </div>
  )}
 </div>
 );
};
