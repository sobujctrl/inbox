import React from 'react';
import { Menu, Plus, Search, RotateCcw, Download, X, Sun, Moon, Monitor } from 'lucide-react';
import { ActiveNavTab } from './Sidebar';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface TopHeaderProps {
  activeTab: ActiveNavTab;
  onOpenMobileMenu: () => void;
  onOpenAddModal: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onExport: () => void;
  onResetFilters: () => void;
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}

const TAB_TITLES: Record<ActiveNavTab, { title: string; subtitle: string }> = {
  inbox: { title: 'ইউনিফাইড লিড ইনবক্স', subtitle: 'Facebook, Messenger ও WhatsApp-এর সব লিড এক জায়গায়' },
  pipeline: { title: 'সেলস পাইপলাইন কানবান', subtitle: 'লিডের বর্তমান অবস্থা ও ফলো-আপ স্ট্যাটাস ট্র্যাক করুন' },
  reports: { title: 'রিপোর্ট ও অ্যানালিটিক্স', subtitle: 'সোর্স বিতরণ, দৈনিক লিড গ্রোথ ও কনভার্সন রেট' },
  integrations: { title: 'ইমপোর্ট ও অটোমেশন ইন্টিগ্রেশন', subtitle: 'CSV থেকে লিড ইমপোর্ট ও Webhook কানেকশন' },
  settings: { title: 'সেটিংস ও ডেটা ব্যবস্থাপনা', subtitle: 'টিম মেম্বার, ট্যাগ ও ডেটা ব্যাকআপ কনফিগারেশন' },
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  onOpenMobileMenu,
  onOpenAddModal,
  searchQuery,
  onSearchChange,
  onExport,
  onResetFilters,
  themeMode,
  onThemeChange,
}) => {
  const currentTab = TAB_TITLES[activeTab];

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onOpenMobileMenu} className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] lg:hidden" title="মেনু খুলুন">
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-[var(--text-primary)] sm:text-lg">{currentTab.title}</h1>
          <p className="hidden text-xs text-[var(--text-secondary)] sm:block">{currentTab.subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {activeTab === 'inbox' && (
          <div className="relative w-36 sm:w-48 md:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input type="text" value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="নাম, ফোন বা ইমেইল..." className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-app)] pl-9 pr-8 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none" />
            {searchQuery && (
              <button type="button" onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]" title="সার্চ সাফ করুন">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        <button onClick={onExport} className="hidden items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] sm:inline-flex" title="CSV এক্সপোর্ট">
          <Download className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
          <span>এক্সপোর্ট</span>
        </button>
        <button onClick={onResetFilters} className="hidden items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] lg:inline-flex" title="ফিল্টার রিসেট">
          <RotateCcw className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
          <span>রিসেট</span>
        </button>

        {/* 3-Option Theme Segmented Control: Light (☀), Dark (☾), Auto (🖥) */}
        <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-0.5" role="group" aria-label="থিম বাছাই">
          <button
            type="button"
            onClick={() => onThemeChange('light')}
            title="লাইট"
            aria-label="লাইট থিম"
            className={`flex h-7 w-7 items-center justify-center rounded-md transition cursor-pointer ${
              themeMode === 'light'
                ? 'bg-[var(--bg-surface)] text-[var(--accent-solid)] shadow-xs font-bold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sun className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onThemeChange('dark')}
            title="ডার্ক"
            aria-label="ডার্ক থিম"
            className={`flex h-7 w-7 items-center justify-center rounded-md transition cursor-pointer ${
              themeMode === 'dark'
                ? 'bg-[var(--bg-surface)] text-[var(--accent-solid)] shadow-xs font-bold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Moon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onThemeChange('auto')}
            title="অটো (সিস্টেম)"
            aria-label="অটো সিস্টেম থিম"
            className={`flex h-7 w-7 items-center justify-center rounded-md transition cursor-pointer ${
              themeMode === 'auto'
                ? 'bg-[var(--bg-surface)] text-[var(--accent-solid)] shadow-xs font-bold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
        </div>

        <button onClick={onOpenAddModal} className="flex items-center gap-1.5 rounded-lg bg-[var(--accent-solid)] px-3 py-1.5 text-xs font-bold text-[var(--accent-contrast)] hover:opacity-90 transition-all shrink-0 cursor-pointer">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">নতুন লিড</span>
          <span className="sm:hidden">লিড</span>
        </button>
      </div>
    </header>
  );
};
