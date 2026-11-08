import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle, Sparkles, Check, Phone } from 'lucide-react';
import { LeadSource, LeadStatus, Lead } from '../../types/lead';
import { normalizeBdPhoneNumber, formatBdPhoneNumber, isValidBdPhoneNumber } from '../../utils/phone';
import { SOURCE_LABELS, PRESET_TAGS, TEAM_MEMBERS } from '../../utils/formatters';
import { useWorkspace } from '../../context/WorkspaceContext';
import { authService } from '../../services/authService';
import { leadService } from '../../services/leadService';
import { ManualIcon } from '../common/SourceBadge';

interface AddLeadModalProps {
 isOpen: boolean;
 onClose: () => void;
 onLeadAdded: (result: { isDuplicate: boolean; notificationMessage: string; lead: Lead }) => void;
}

export const AddLeadModal: React.FC<AddLeadModalProps> = ({
 isOpen,
 onClose,
 onLeadAdded,
}) => {
 const { ownerUid } = useWorkspace();
 const currentUser = authService.getCurrentUser();
 const [teamMembers, setTeamMembers] = useState<any[]>([]);

 // Always declare all hooks unconditionally at the top
 const [name, setName] = useState('');
 const [email, setEmail] = useState('');
 const [productInterest, setProductInterest] = useState('');
 const [message, setMessage] = useState('');
 const [status, setStatus] = useState<LeadStatus>('new');
 const [tags, setTags] = useState<string[]>([]);
 const [nextFollowUpDate, setNextFollowUpDate] = useState(new Date().toISOString().split('T')[0]);
 const [assignedTo, setAssignedTo] = useState('');
 const [estimatedValue, setEstimatedValue] = useState<number | ''>('');
 const [errorMsg, setErrorMsg] = useState('');
 const [duplicateWarning, setDuplicateWarning] = useState<Lead | null>(null);

 // Subscribe to team members
 useEffect(() => {
  if (!ownerUid) return;
  return leadService.subscribeToTeamMembers(ownerUid, (members) => {
   setTeamMembers(members.filter(m => m.active));
  });
 }, [ownerUid]);

 // Real-time duplicate check when phone changes


 // Early return check strictly AFTER all hooks
 if (!isOpen) return null;

 const toggleTag = (t: string) => {
 if (tags.includes(t)) {
 setTags(tags.filter((item) => item !== t));
 } else {
 setTags([...tags, t]);
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setErrorMsg('');

  if (!name.trim()) {
   setErrorMsg('অনুগ্রহ করে গ্রাহকের নাম লিখুন');
   return;
  }

  const result = await leadService.addOrMergeLeadAsync({
   name: name.trim(),
   source: 'manual',
   productInterest: productInterest || 'সাধারণ অনুসন্ধান',
   message: message || 'নতুন ম্যানুয়াল লিড এন্ট্রি',
   status,
   assignedTo: assignedTo || null,
   estimatedValue: estimatedValue ? Number(estimatedValue) : 0,
  });

  onLeadAdded(result);
  onClose();
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 {/* Backdrop */}
 <div
 className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
 onClick={onClose}
 />

 <div className="relative w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
 {/* Header */}
 <div className="flex items-center justify-between border-b border-[var(--border)]/80 pb-4 ">
 <div className="flex items-center gap-2.5">
 <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-[var(--accent)] ">
 <UserPlus className="h-5 w-5" />
 </div>
 <div>
 <h2 className="text-base font-bold text-[var(--text-primary)] ">
 নতুন লিড যোগ করুন
 </h2>
 <p className="text-xs text-[var(--text-secondary)] ">
 সরাসরি ইনবক্সে নতুন কাস্টমার এন্ট্রি করুন
 </p>
 </div>
 </div>
 <button
 onClick={onClose}
 className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer"
 >
 <X className="h-5 w-5" />
 </button>
 </div>

 {/* Error message */}
 {errorMsg && (
 <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--danger-bg)] p-3 text-xs font-semibold text-[var(--danger)] ">
 <AlertCircle className="h-4 w-4 shrink-0" />
 <span>{errorMsg}</span>
 </div>
 )}

 {/* Real-time Duplicate Detection Alert */}
 {duplicateWarning && (
 <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50/80 p-3.5 text-xs text-purple-900 ">
 <div className="flex items-center gap-2 font-bold text-purple-800 mb-1">
 <Sparkles className="h-4 w-4 text-purple-600" />
 <span>ডুপ্লিকেট নম্বর শনাক্ত হয়েছে!</span>
 </div>
 <p className="text-[11px] leading-relaxed">
 এই ফোন নম্বরটি ইতিমধ্যে "<strong>{duplicateWarning.name}</strong>" নামে ইনবক্সে আছে (মূল সোর্স:{' '}
 {SOURCE_LABELS[duplicateWarning.source]})। সংরক্ষণ করলে নতুন লিড তৈরি না হয়ে বিদ্যমান লিডের সাথে <strong>স্বয়ংক্রিয়ভাবে মার্জ</strong> হবে।
 </p>
 </div>
 )}

 {/* Form Body */}
 <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
 {/* Source Tag Badge */}
 <div>
 <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-elevated)] px-3 py-1 text-[11px] font-semibold text-[var(--text-primary)] border border-[var(--border)] ">
 <ManualIcon className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
 <span>সোর্স: ম্যানুয়াল এন্ট্রি</span>
 </div>
 </div>

 {/* Name */}
 <div className="grid grid-cols-1 gap-3">
 <div>
 <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
 গ্রাহকের নাম <span className="text-rose-500">*</span>
 </label>
 <input
 type="text"
 required
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="যেমন: তানভীর আহমেদ"
 className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 />
 </div>
 </div>

 {/* Product & Value */}
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
 <div>
 <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
 আগ্রহের প্রোডাক্ট / সার্ভিস
 </label>
 <input
 type="text"
 value={productInterest}
 onChange={(e) => setProductInterest(e.target.value)}
 placeholder="যেমন: স্মার্ট ওয়াচ সিরিজ ৯"
 className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 />
 </div>
 <div>
 <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
 সম্ভাব্য ডিল মূল্য (টাকা)
 </label>
 <input
 type="number"
 value={estimatedValue}
 onChange={(e) => setEstimatedValue(e.target.value ? Number(e.target.value) : '')}
 placeholder="যেমন: ১৫০০"
 className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 />
 </div>
 </div>

 {/* First Message / Lead Note */}
 <div>
 <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
 প্রথম নোট / বিবরণ
 </label>
 <textarea
 rows={2}
 value={message}
 onChange={(e) => setMessage(e.target.value)}
 placeholder="গ্রাহক সম্পর্কে বা আলাপের সারসংক্ষেপ লিখুন..."
 className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 />
 </div>



 {/* Assigned */}
 <div className="grid grid-cols-1 gap-3">
 <div>
 <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
 টিম মেম্বার অ্যাসাইন করুন
 </label>
 <select
 value={assignedTo}
 onChange={(e) => setAssignedTo(e.target.value)}
 className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 >
 <option value="">অ্যাসাইন করবেন না</option>
 <option value="অ্যাডমিন">অ্যাডমিন</option>
 {teamMembers.map((m) => (
 <option key={m.email} value={m.name}>
 {m.name}
 </option>
 ))}
 </select>
 </div>
 </div>

 {/* Footer Submit */}
 <div className="mt-6 flex items-center justify-end gap-2 border-t border-[var(--border)]/80 pt-4 ">
 <button
 type="button"
 onClick={onClose}
 className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
 >
 বাতিল
 </button>
 <button
 type="submit"
 className="rounded-xl bg-[var(--accent-solid)] px-5 py-2 text-xs font-bold text-[var(--accent-contrast)] shadow-xs hover:opacity-90 transition cursor-pointer"
 >
 {duplicateWarning ? 'মার্জ করে সংরক্ষণ করুন' : 'লিড সংরক্ষণ করুন'}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};
