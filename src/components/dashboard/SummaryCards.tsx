import React from 'react';
import { 
  Users, 
  PhoneCall, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  X, 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight, 
  CalendarDays, 
  Check 
} from 'lucide-react';
import { SummaryStats } from '../../services/leadService';
import { toBengaliNumerals, formatTaka } from '../../utils/formatters';
import { FacebookIcon, MessengerIcon, WhatsAppIcon, WebsiteIcon, ManualIcon } from '../common/SourceBadge';
import { LeadStatus } from '../../types/lead';
import { CardFilterType } from './CardLeadPageView';

interface SummaryCardsProps {
  stats: SummaryStats;
  selectedSourceFilter: string;
  onSelectSource: (source: string) => void;
  onSelectTotalLeads?: () => void;
  isFollowUpFilterActive: boolean;
  onToggleFollowUpFilter: () => void;
  isTodayNewFilterActive: boolean;
  onToggleTodayNewFilter: () => void;
  isConfirmedFilterActive: boolean;
  onToggleConfirmedFilter: () => void;
  isPendingFilterActive: boolean;
  onTogglePendingFilter: () => void;
  statusFilter?: 'all' | LeadStatus;
  onStatusFilterChange?: (status: 'all' | LeadStatus) => void;
  selectedMonth: string;
  onMonthChange: (monthKey: string) => void;
  onOpenCardPage?: (cardType: CardFilterType) => void;
  onOpenCardModal?: (cardType: CardFilterType) => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  stats,
  selectedSourceFilter,
  onSelectSource,
  onSelectTotalLeads,
  isFollowUpFilterActive,
  onToggleFollowUpFilter,
  isTodayNewFilterActive,
  onToggleTodayNewFilter,
  isConfirmedFilterActive,
  onToggleConfirmedFilter,
  isPendingFilterActive,
  onTogglePendingFilter,
  statusFilter = 'all',
  onStatusFilterChange,
  selectedMonth,
  onMonthChange,
  onOpenCardPage,
  onOpenCardModal,
}) => {
  const [isMonthPopoverOpen, setIsMonthPopoverOpen] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsMonthPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenPage = (type: CardFilterType) => {
    if (onOpenCardPage) onOpenCardPage(type);
    else if (onOpenCardModal) onOpenCardModal(type);
  };

  const isCancelledActive = statusFilter === 'cancelled';
  const isHoldActive = statusFilter === 'hold';

  const baseCardClasses =
    'group flex flex-col justify-between cursor-pointer rounded-xl border p-4 sm:p-5 transition-all duration-200 hover:shadow-sm select-none min-h-[135px]';
  const activeClasses = 'border-[var(--accent)] ring-1 ring-[var(--accent)]';

  // Find selected month option and its index
  const availableMonths = stats.availableMonths || [];
  const selectedMonthOption = availableMonths.find(m => m.key === selectedMonth) || availableMonths[0] || { key: 'all', label: 'সব সময়', count: 0 };
  const selectedIndex = availableMonths.findIndex(m => m.key === selectedMonth);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex < availableMonths.length - 1) {
      onMonthChange(availableMonths[selectedIndex + 1].key);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex > 0) {
      onMonthChange(availableMonths[selectedIndex - 1].key);
    }
  };

  const handleMonthClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMonthPopoverOpen(!isMonthPopoverOpen);
  };

  const selectMonth = (key: string) => {
    onMonthChange(key);
    setIsMonthPopoverOpen(false);
  };

  // Helper for rendering the "Total Leads" Card with Month Picker
  const renderTotalLeadsCard = () => {
    // Tooltip shows top 2 months for quick glance
    const topMonths = availableMonths.slice(0, 2).map(m => `${m.label}: ${toBengaliNumerals(m.count)} লিড`).join(' · ');
    const tooltipText = topMonths || `মোট ${toBengaliNumerals(stats.totalLeads)} · ক্লিক করে সব দেখুন`;

    const isFirstMonth = selectedIndex === availableMonths.length - 1 || availableMonths.length <= 1;
    const isLatestMonth = selectedIndex <= 0;

    return (
      <div
        onClick={() => handleOpenPage('all')}
        title={tooltipText}
        className={`${baseCardClasses} relative ${
          selectedMonth !== 'all' ? activeClasses : 'border-[var(--border)] hover:border-[var(--accent)] bg-[var(--bg-surface)]'
        }`}
        role="button"
        aria-label="মোট লিড দেখতে ক্লিক করুন"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">মোট লিড</span>
          <div className={`rounded-full p-2 shrink-0 bg-[var(--neutral-bg)]`}>
            <Users className={`h-4 w-4 text-[var(--neutral)]`} />
          </div>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <span className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] tabular-nums tracking-tight">
            {toBengaliNumerals(stats.totalLeadsInSelectedMonth)}
          </span>
          <div className="flex flex-col items-end">
             <span className="text-[11px] text-[var(--text-secondary)] font-medium">পাইপলাইন ভ্যালু</span>
             <span className="text-[12px] font-bold text-[var(--text-primary)]">{formatTaka(stats.pipelineValueInSelectedMonth)}</span>
          </div>
        </div>

        {/* Month Selector Pill */}
        <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-[var(--border)]">
          <div className="flex items-center bg-[var(--bg-subtle)] rounded-full px-1.5 py-0.5 border border-[var(--border)] shadow-xs relative">
            <button
              onClick={handlePrevMonth}
              disabled={isFirstMonth}
              className={`p-0.5 rounded-full transition ${isFirstMonth ? 'text-[var(--text-muted)] cursor-not-allowed' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--accent)]'}`}
              aria-label="আগের মাস"
              title="আগের মাস"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={handleMonthClick}
              className="px-1.5 py-0.5 text-[11px] font-bold text-[var(--text-primary)] hover:text-[var(--accent)] transition truncate max-w-[100px]"
              aria-label="মাস বাছুন"
            >
              {selectedMonthOption.label}
            </button>

            <button
              onClick={handleNextMonth}
              disabled={isLatestMonth}
              className={`p-0.5 rounded-full transition ${isLatestMonth ? 'text-[var(--text-muted)] cursor-not-allowed' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--accent)]'}`}
              aria-label="পরের মাস"
              title="পরের মাস"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>

            {/* Popover */}
            {isMonthPopoverOpen && (
              <div
                ref={popoverRef}
                className="absolute bottom-full left-0 mb-2 w-56 max-h-64 overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-xl z-30 animate-in fade-in slide-in-from-bottom-2 duration-150"
              >
                <div className="p-2 space-y-1">
                  {availableMonths.map((m) => {
                    const isSelected = m.key === selectedMonth;
                    return (
                      <button
                        key={m.key}
                        onClick={(e) => { e.stopPropagation(); selectMonth(m.key); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition ${
                          isSelected
                            ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {m.key === 'all' ? <CalendarDays className="h-3.5 w-3.5" /> : null}
                          <span>{m.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[var(--text-secondary)]">{toBengaliNumerals(m.count)} লিড</span>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors ml-auto" aria-label="ক্লিক করে দেখুন">
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    );
  };

  // Helper for rendering 2 "Total" Cards (Pending, Hold)
  const renderTotalCard = (
    title: string,
    count: number,
    icon: React.ElementType,
    iconBgColor: string,
    iconColor: string,
    active: boolean,
    onClick: () => void,
    footerLeft?: React.ReactNode
  ) => {
    const tooltipText = `মোট ${toBengaliNumerals(count)} · ক্লিক করে সব দেখুন`;
    return (
      <div
        onClick={onClick}
        title={tooltipText}
        className={`${baseCardClasses} ${
          active ? activeClasses : 'border-[var(--border)] hover:border-[var(--accent)] bg-[var(--bg-surface)]'
        }`}
        role="button"
        aria-label={`${title} দেখতে ক্লিক করুন`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">{title}</span>
          <div className={`rounded-full p-2 shrink-0 ${iconBgColor}`}>
            {React.createElement(icon, { className: `h-4 w-4 ${iconColor}` })}
          </div>
        </div>
        <div className="flex items-baseline justify-between mt-2">
          <span className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] tabular-nums tracking-tight">
            {toBengaliNumerals(count)}
          </span>
          <span className="text-[13px] text-[var(--text-secondary)] font-medium">মোট</span>
        </div>
        <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-[var(--border)]">
          <span className="text-xs font-semibold text-[var(--text-secondary)] truncate">{footerLeft || ''}</span>
          <div className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors ml-auto" aria-label="ক্লিক করে দেখুন">
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    );
  };

  // Helper for rendering 9 "New" Lead Cards
  const renderNewCard = (
    title: string,
    newCount: number,
    totalCount: number,
    icon: React.ElementType,
    iconBgColor: string,
    iconColor: string,
    active: boolean,
    onClick: () => void
  ) => {
    const hasNew = newCount > 0;
    const tooltipText = `নতুন ${toBengaliNumerals(newCount)} · মোট ${toBengaliNumerals(totalCount)} · ক্লিক করে সব দেখুন`;

    return (
      <div
        onClick={onClick}
        title={tooltipText}
        className={`${baseCardClasses} ${
          active
            ? activeClasses
            : hasNew
            ? 'border-[var(--accent-soft)] hover:border-[var(--accent)] bg-[var(--bg-surface)] shadow-2xs'
            : 'border-[var(--border)] hover:border-[var(--accent)] bg-[var(--bg-surface)]'
        }`}
        role="button"
        aria-label={`${title} দেখতে ক্লিক করুন`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">{title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasNew && <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" title="নতুন লিড এসেছে" />}
            <div className={`rounded-full p-2 ${iconBgColor}`}>
              {React.createElement(icon, { className: `h-4 w-4 ${iconColor}` })}
            </div>
          </div>
        </div>

        <div className="flex items-baseline justify-between mt-2">
          <span
            className={`text-3xl sm:text-4xl tabular-nums tracking-tight ${
              hasNew ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-muted)]'
            }`}
          >
            {toBengaliNumerals(newCount)}
          </span>
          <span className="text-[13px] text-[var(--text-secondary)] font-medium">নতুন</span>
        </div>

        <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-[var(--border)]">
          <span className="text-xs font-semibold text-[var(--text-secondary)] truncate">
            মোট {toBengaliNumerals(totalCount)}
          </span>
          <div className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors ml-auto" aria-label="ক্লিক করে দেখুন">
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
      {/* 1. Total Leads Box with Month Selector */}
      {renderTotalLeadsCard()}

      {/* 9 New Lead Boxes */}
      {renderNewCard(
        'নতুন',
        stats.newLeadsCount,
        stats.totalNewStatusCount,
        TrendingUp,
        'bg-[var(--accent-soft)]',
        'text-[var(--accent)]',
        isTodayNewFilterActive,
        () => handleOpenPage('new')
      )}
      {renderNewCard(
        'ফলো-আপ',
        stats.newFollowUpCount,
        stats.totalFollowUpCount,
        PhoneCall,
        'bg-[var(--warning-bg)]',
        'text-[var(--warning)]',
        isFollowUpFilterActive,
        () => handleOpenPage('followup')
      )}
      {renderNewCard(
        'কনফার্ম',
        stats.newWonCount,
        stats.totalWonCount,
        CheckCircle2,
        'bg-[var(--success-bg)]',
        'text-[var(--success)]',
        isConfirmedFilterActive,
        () => handleOpenPage('won')
      )}

      {/* Pending Total Box */}
      {renderTotalCard(
        'পেন্ডিং',
        stats.totalPendingCount,
        Clock,
        'bg-[var(--warning-bg)]',
        'text-[var(--warning)]',
        isPendingFilterActive,
        () => handleOpenPage('pending'),
        formatTaka(stats.pendingValue)
      )}

      {/* Cancelled New Lead Box */}
      {renderNewCard(
        'ক্যান্সেল',
        stats.newCancelledCount,
        stats.totalCancelledCount,
        X,
        'bg-[var(--danger-bg)]',
        'text-[var(--danger)]',
        isCancelledActive,
        () => handleOpenPage('cancelled')
      )}

      {/* Hold Total Box */}
      {renderTotalCard(
        'হোল্ড',
        stats.totalHoldCount,
        Clock,
        'bg-[var(--neutral-bg)]',
        'text-[var(--neutral)]',
        false,
        () => handleOpenPage('hold')
      )}

      {/* 5 Source New Lead Boxes */}
      {renderNewCard(
        'Facebook',
        stats.newFacebookCount,
        stats.totalFacebookCount,
        FacebookIcon,
        'bg-[var(--badge-teal-bg)]',
        'text-[var(--badge-teal-text)]',
        selectedSourceFilter === 'facebook',
        () => handleOpenPage('facebook')
      )}
      {renderNewCard(
        'Messenger',
        stats.newMessengerCount,
        stats.totalMessengerCount,
        MessengerIcon,
        'bg-[var(--badge-teal-bg)]',
        'text-[var(--badge-teal-text)]',
        selectedSourceFilter === 'messenger',
        () => handleOpenPage('messenger')
      )}
      {renderNewCard(
        'WhatsApp',
        stats.newWhatsappCount,
        stats.totalWhatsappCount,
        WhatsAppIcon,
        'bg-[var(--badge-green-bg)]',
        'text-[var(--badge-green-text)]',
        selectedSourceFilter === 'whatsapp',
        () => handleOpenPage('whatsapp')
      )}
      {renderNewCard(
        'Website',
        stats.newWebsiteCount,
        stats.totalWebsiteCount,
        WebsiteIcon,
        'bg-[var(--badge-pink-bg)]',
        'text-[var(--badge-pink-text)]',
        selectedSourceFilter === 'website',
        () => handleOpenPage('website')
      )}
      {renderNewCard(
        'ম্যানুয়াল',
        stats.newManualCount,
        stats.totalManualCount,
        ManualIcon,
        'bg-[var(--badge-gray-bg)]',
        'text-[var(--badge-gray-text)]',
        selectedSourceFilter === 'manual',
        () => handleOpenPage('manual')
      )}
    </div>
  );
};
