import React, { useState } from 'react';
import { AlertTriangle, Trash2, RotateCcw, X } from 'lucide-react';
import { Lead } from '../../types/lead';
import { exportLeadsToCSV } from '../../utils/formatters';
import { leadService } from '../../services/leadService';

interface ResetOptionsModalProps {
 isOpen: boolean;
 onClose: () => void;
 onResetFilters: () => void;
 onLeadsUpdated: () => void;
 onShowToast: (msg: string) => void;
 leads: Lead[];
}

export const ResetOptionsModal: React.FC<ResetOptionsModalProps> = ({
 isOpen,
 onClose,
 onResetFilters,
 onLeadsUpdated,
 onShowToast,
 leads,
}) => {
 const [step, setStep] = useState<'options' | 'confirm'>('options');
 const [confirmText, setConfirmText] = useState('');
 const [isDeleting, setIsDeleting] = useState(false);

 if (!isOpen) return null;

 const handleResetFilters = () => {
 onResetFilters();
 onClose();
 };

 const handleConfirmDelete = async () => {
 if (confirmText !== 'মুছুন') return;
 
 setIsDeleting(true);
 try {
 // 1. Backup
 exportLeadsToCSV(leads, `lead-backup-${new Date().toISOString().split('T')[0]}.csv`);
 
 // 2. Delete all
 await leadService.clearAllLeads();
 
 onLeadsUpdated();
 onShowToast('সব লিড মুছে ফেলা হয়েছে। ব্যাকআপ ফাইল ডাউনলোড হয়েছে।');
 setStep('options');
 setConfirmText('');
 onClose();
 } catch (error) {
 onShowToast('ব্যাকআপ বা মোছার সময় সমস্যা হয়েছে।');
 } finally {
 setIsDeleting(false);
 }
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
 <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-surface)] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-bold text-[var(--text-primary)] ">রিসেট অপশন</h2>
 <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
 <X className="h-5 w-5" />
 </button>
 </div>

 {step === 'options' ? (
 <div className="space-y-3">
 <button
 onClick={handleResetFilters}
 className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-page)] py-3 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
 >
 <RotateCcw className="h-4 w-4" />
 শুধু ফিল্টার রিসেট করুন
 </button>
 <button
 onClick={() => setStep('confirm')}
 className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-[var(--danger-bg)] py-3 text-sm font-bold text-[var(--danger)] hover:bg-[var(--danger-bg)] :bg-rose-950"
 >
 <Trash2 className="h-4 w-4" />
 সব লিড ডেটা মুছুন
 </button>
 </div>
 ) : (
 <div className="space-y-4">
 <div className="rounded-lg bg-[var(--danger-bg)] p-4 text-rose-800 ">
 <p className="text-sm font-bold flex items-center gap-2">
 <AlertTriangle className="h-4 w-4" />
 আপনি কি নিশ্চিত?
 </p>
 <p className="mt-1 text-xs">সব লিড স্থায়ীভাবে মুছে যাবে। এটি আর ফেরত আনা যাবে না।</p>
 </div>
 <input
 type="text"
 value={confirmText}
 onChange={(e) => setConfirmText(e.target.value)}
 placeholder="মুছুন টাইপ করুন..."
 className="w-full rounded-lg border border-slate-300 p-3 text-sm "
 />
 <div className="flex gap-2">
 <button
 onClick={() => { setStep('options'); setConfirmText(''); }}
 className="flex-1 rounded-lg bg-[var(--bg-elevated)] py-2 text-sm font-bold text-[var(--text-secondary)] hover "
 >
 বাতিল করুন
 </button>
 <button
 onClick={handleConfirmDelete}
 disabled={confirmText !== 'মুছুন' || isDeleting}
 className="flex-1 rounded-lg bg-rose-600 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled disabled:cursor-not-allowed"
 >
 {isDeleting ? 'মুছছি...' : 'নিশ্চিত করুন ও মুছুন'}
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};
