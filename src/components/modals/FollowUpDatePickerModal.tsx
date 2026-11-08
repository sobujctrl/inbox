import React, { useState, useEffect } from 'react';
import {
 Calendar,
 Clock,
 X,
 Check,
 Trash2,
 Sparkles,
 CalendarDays,
 AlertCircle,
} from 'lucide-react';
import { Lead } from '../../types/lead';
import {
 formatBanglaFollowUpDateTime,
 getFollowUpStatusInfo,
 toBengaliNumerals,
} from '../../utils/formatters';
import { getDhakaDateString } from '../../services/leadService';

interface FollowUpDatePickerModalProps {
 isOpen: boolean;
 lead: Lead | null;
 onClose: () => void;
 onSave: (leadId: string, followUpDate: string | null) => Promise<void> | void;
}

export const FollowUpDatePickerModal: React.FC<FollowUpDatePickerModalProps> = ({
 isOpen,
 lead,
 onClose,
 onSave,
}) => {
 const [selectedDate, setSelectedDate] = useState<string>('');
 const [selectedTime, setSelectedTime] = useState<string>('');
 const [showCustomPicker, setShowCustomPicker] = useState<boolean>(false);
 const [isSubmitting, setIsSubmitting] = useState(false);

 // Initialize or reset when modal opens with a lead
 useEffect(() => {
 if (isOpen && lead) {
 const rawDate = lead.followUpDate || lead.nextFollowUpDate || '';
 if (rawDate) {
 const dateDhaka = getDhakaDateString(rawDate);
 setSelectedDate(dateDhaka);

 // Check if there's time in the string
 if (rawDate.includes('T') || (rawDate.includes(':') && rawDate.includes(' '))) {
 try {
 const d = new Date(rawDate);
 if (!isNaN(d.getTime())) {
 const timeStr = new Intl.DateTimeFormat('en-GB', {
 timeZone: 'Asia/Dhaka',
 hour: '2-digit',
 minute: '2-digit',
 hour12: false,
 }).format(d);
 setSelectedTime(timeStr);
 }
 } catch {
 setSelectedTime('');
 }
 } else {
 setSelectedTime('');
 }
 } else {
 setSelectedDate('');
 setSelectedTime('');
 }
 setShowCustomPicker(false);
 setIsSubmitting(false);
 }
 }, [isOpen, lead]);

 if (!isOpen || !lead) return null;

 // Preset quick picks
 const getDhakaOffsetDate = (offsetDays: number) => {
 const tz = 'Asia/Dhaka';
 const d = new Date();
 d.setDate(d.getDate() + offsetDays);
 return d.toLocaleString('en-CA', { timeZone: tz }).split(',')[0];
 };

 const handleQuickPick = (daysOffset: number, defaultTime?: string) => {
 const dateStr = getDhakaOffsetDate(daysOffset);
 setSelectedDate(dateStr);
 if (defaultTime !== undefined) {
 setSelectedTime(defaultTime);
 }
 };

 // Save handler
 const handleConfirmSave = async () => {
 if (!lead) return;
 setIsSubmitting(true);

 try {
 if (!selectedDate) {
 await onSave(lead.id, null);
 } else {
 let finalDateTime = selectedDate;
 if (selectedTime && selectedTime.trim()) {
 // Construct Asia/Dhaka ISO timestamp: e.g. 2026-11-08T16:00:00+06:00
 finalDateTime = `${selectedDate}T${selectedTime.trim()}:00+06:00`;
 }
 await onSave(lead.id, finalDateTime);
 }
 onClose();
 } catch (err) {
 console.error('Failed to save follow-up date:', err);
 } finally {
 setIsSubmitting(false);
 }
 };

 // Clear date handler
 const handleClearDate = async () => {
 if (!lead) return;
 setIsSubmitting(true);
 try {
 await onSave(lead.id, null);
 onClose();
 } catch (err) {
 console.error('Failed to clear follow-up date:', err);
 } finally {
 setIsSubmitting(false);
 }
 };

 const currentRaw = lead.followUpDate || lead.nextFollowUpDate;
 const currentStatusInfo = getFollowUpStatusInfo(currentRaw, lead.status);

 // Preview formatted for the currently selected date & time in the modal
 let previewStr = '';
 if (selectedDate) {
 const testIso = selectedTime ? `${selectedDate}T${selectedTime}:00+06:00` : selectedDate;
 previewStr = formatBanglaFollowUpDateTime(testIso);
 }
 const previewStatusInfo = selectedDate
 ? getFollowUpStatusInfo(
 selectedTime ? `${selectedDate}T${selectedTime}:00+06:00` : selectedDate,
 lead.status
 )
 : null;

 const todayDhaka = getDhakaDateString(new Date().toISOString());
 const isTodaySelected = selectedDate === todayDhaka;
 const isTomorrowSelected = selectedDate === getDhakaOffsetDate(1);
 const isThreeDaysSelected = selectedDate === getDhakaOffsetDate(3);
 const isOneWeekSelected = selectedDate === getDhakaOffsetDate(7);

 return (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
 onClick={onClose}
 >
 <div
 className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden transition-all "
 onClick={(e) => e.stopPropagation()}
 >
 {/* Header */}
 <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 ">
 <div className="flex items-center gap-2.5">
 <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] ">
 <Calendar className="h-5 w-5" />
 </div>
 <div>
 <h3 className="text-sm font-bold text-[var(--text-primary)] ">
 ফলো-আপ তারিখ নির্ধারণ
 </h3>
 <p className="text-[11px] font-medium text-[var(--text-secondary)] ">
 {lead.name} {lead.phone ? `(${lead.phone})` : ''}
 </p>
 </div>
 </div>
 <button
 onClick={onClose}
 className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)] transition"
 >
 <X className="h-4 w-4" />
 </button>
 </div>

 {/* Body */}
 <div className="p-5 space-y-4">
 {/* Current follow-up indicator */}
 <div className="flex items-center justify-between rounded-xl bg-[var(--bg-page)] p-3 text-xs border border-[var(--border)]/60 ">
 <div className="flex items-center gap-2">
 <Clock className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
 <div>
 <span className="block text-[11px] text-[var(--text-secondary)] ">
 বর্তমান নির্ধারিত ফলো-আপ:
 </span>
 <span className="font-semibold text-[var(--text-primary)] ">
 {currentRaw ? formatBanglaFollowUpDateTime(currentRaw) : 'কোনো তারিখ সেট নেই'}
 </span>
 </div>
 </div>
 {currentRaw && (
 <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${currentStatusInfo.badgeClass}`}>
 {currentStatusInfo.label}
 </span>
 )}
 </div>

 {/* Quick presets (Requirement 1) */}
 <div>
 <label className="block text-xs font-semibold text-[var(--text-primary)] mb-2">
 দ্রুত বাছাই করুন:
 </label>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
 <button
 type="button"
 onClick={() => {
 handleQuickPick(0);
 setShowCustomPicker(false);
 }}
 className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
 isTodaySelected && !showCustomPicker
 ? 'border-amber-500 bg-[var(--warning-bg)] text-[var(--warning)] ring-1 ring-amber-500 '
 : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-slate-300 hover:bg-[var(--bg-page)]'
 }`}
 >
 <span>আজ</span>
 </button>

 <button
 type="button"
 onClick={() => {
 handleQuickPick(1);
 setShowCustomPicker(false);
 }}
 className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
 isTomorrowSelected && !showCustomPicker
 ? 'border-blue-500 bg-[var(--accent-soft)] text-blue-800 ring-1 ring-blue-500 '
 : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-slate-300 hover:bg-[var(--bg-page)]'
 }`}
 >
 <span>আগামীকাল</span>
 </button>

 <button
 type="button"
 onClick={() => {
 handleQuickPick(3);
 setShowCustomPicker(false);
 }}
 className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
 isThreeDaysSelected && !showCustomPicker
 ? 'border-blue-500 bg-[var(--accent-soft)] text-blue-800 ring-1 ring-blue-500 '
 : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-slate-300 hover:bg-[var(--bg-page)]'
 }`}
 >
 <span>৩ দিন পর</span>
 </button>

 <button
 type="button"
 onClick={() => {
 handleQuickPick(7);
 setShowCustomPicker(false);
 }}
 className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
 isOneWeekSelected && !showCustomPicker
 ? 'border-blue-500 bg-[var(--accent-soft)] text-blue-800 ring-1 ring-blue-500 '
 : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-slate-300 hover:bg-[var(--bg-page)]'
 }`}
 >
 <span>১ সপ্তাহ পর</span>
 </button>
 </div>

 <div className="mt-2">
 <button
 type="button"
 onClick={() => setShowCustomPicker(true)}
 className={`w-full flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
 showCustomPicker
 ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500 '
 : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-page)] '
 }`}
 >
 <CalendarDays className="h-4 w-4" />
 <span>নিজে বাছুন (ক্যালেন্ডার ও সময়)</span>
 </button>
 </div>
 </div>

 {/* Custom Date & Time Picker */}
 {(showCustomPicker || (!isTodaySelected && !isTomorrowSelected && !isThreeDaysSelected && !isOneWeekSelected && selectedDate)) && (
 <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-page)]/50 p-3.5 space-y-3 animate-in fade-in duration-150">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {/* Date Input */}
 <div>
 <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
 তারিখ (ঐচ্ছিক নয়):
 </label>
 <input
 type="date"
 value={selectedDate}
 onChange={(e) => setSelectedDate(e.target.value)}
 className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 />
 </div>

 {/* Time Input */}
 <div>
 <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
 সময় (ঐচ্ছিক):
 </label>
 <input
 type="time"
 value={selectedTime}
 onChange={(e) => setSelectedTime(e.target.value)}
 className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-blue-500 focus:outline-hidden "
 />
 </div>
 </div>

 {/* Time quick chips */}
 <div>
 <span className="block text-[10px] font-medium text-[var(--text-secondary)] mb-1.5">
 দ্রুত সময়:
 </span>
 <div className="flex flex-wrap gap-1.5">
 {[
 { label: 'সকাল ১০:০০', val: '10:00' },
 { label: 'দুপুর ১২:০০', val: '12:00' },
 { label: 'বিকাল ৪:০০', val: '16:00' },
 { label: 'সন্ধ্যা ৭:০০', val: '19:00' },
 ].map((t) => (
 <button
 key={t.val}
 type="button"
 onClick={() => setSelectedTime(t.val)}
 className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
 selectedTime === t.val
 ? 'bg-[var(--accent)] text-white'
 : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] '
 }`}
 >
 {t.label}
 </button>
 ))}
 {selectedTime && (
 <button
 type="button"
 onClick={() => setSelectedTime('')}
 className="rounded-lg px-2 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] :text-rose-400 underline"
 >
 সময় মুছুন
 </button>
 )}
 </div>
 </div>
 </div>
 )}

 {/* New Selection Preview */}
 {selectedDate && (
 <div className="flex items-center justify-between rounded-xl bg-[var(--accent-soft)]/70 p-3 text-xs text-blue-900 border border-[var(--border)]/60 ">
 <div className="flex items-center gap-2">
 <Check className="h-4 w-4 text-[var(--accent)] shrink-0" />
 <div>
 <span className="text-[11px] text-[var(--accent)] block">
 নতুন ফলো-আপ হবে:
 </span>
 <span className="font-bold text-[var(--text-primary)] ">
 {previewStr}
 </span>
 </div>
 </div>
 {previewStatusInfo && (
 <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${previewStatusInfo.badgeClass}`}>
 {previewStatusInfo.label}
 </span>
 )}
 </div>
 )}
 </div>

 {/* Footer actions */}
 <div className="flex items-center justify-between border-t border-slate-100 bg-[var(--bg-page)]/60 px-5 py-3.5 ">
 <div>
 {currentRaw && (
 <button
 type="button"
 disabled={isSubmitting}
 onClick={handleClearDate}
 className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)] :bg-rose-950/50 transition disabled:opacity-50"
 >
 <Trash2 className="h-3.5 w-3.5" />
 <span>তারিখ মুছুন</span>
 </button>
 )}
 </div>

 <div className="flex items-center gap-2">
 <button
 type="button"
 disabled={isSubmitting}
 onClick={onClose}
 className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition"
 >
 বাতিল
 </button>
 <button
 type="button"
 disabled={isSubmitting || !selectedDate}
 onClick={handleConfirmSave}
 className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-[0.98] transition disabled:opacity-50"
 >
 <Check className="h-4 w-4" />
 <span>{isSubmitting ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</span>
 </button>
 </div>
 </div>
 </div>
 </div>
 );
};
