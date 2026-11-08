import React from 'react';
import {
  Inbox,
  Kanban,
  BarChart3,
  Webhook,
  Settings,
  PlusCircle,
  Layers,
  Sparkles,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { SummaryStats } from '../../services/leadService';
import { toBengaliNumerals } from '../../utils/formatters';
import { AdminUser } from '../../services/authService';
import { PRIMARY_ADMIN_EMAIL } from '../../config/authConfig';
import { ThemeMode } from './TopHeader';

export type ActiveNavTab = 'inbox' | 'pipeline' | 'reports' | 'integrations' | 'settings';

interface SidebarProps {
  activeTab: ActiveNavTab;
  onTabChange: (tab: ActiveNavTab) => void;
  stats: SummaryStats;
  onOpenAddModal: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  currentUser?: AdminUser | null;
  onLogout?: () => void;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  stats,
  onOpenAddModal,
  isMobileOpen,
  onCloseMobile,
  currentUser,
  onLogout,
  themeMode = 'light',
  onToggleTheme,
}) => {
  const navItems = [
    { id: 'inbox' as ActiveNavTab, label: 'ইনবক্স', sublabel: 'সব সোর্সের লিড তালিকা', icon: Inbox, badge: stats.totalUnreadNewLeadsCount > 0 ? `${toBengaliNumerals(stats.totalUnreadNewLeadsCount)} নতুন` : undefined },
    { id: 'pipeline' as ActiveNavTab, label: 'পাইপলাইন', sublabel: 'কানবান সেলস বোর্ড', icon: Kanban, badge: stats.totalLeads > 0 ? toBengaliNumerals(stats.totalLeads) : undefined },
    { id: 'reports' as ActiveNavTab, label: 'রিপোর্ট ও অ্যানালিটিক্স', sublabel: 'গ্রাফ ও কনভার্সন চার্ট', icon: BarChart3 },
    { id: 'integrations' as ActiveNavTab, label: 'ইমপোর্ট ও ইন্টিগ্রেশন', sublabel: 'CSV ও Webhook ইনটেক', icon: Webhook },
    { id: 'settings' as ActiveNavTab, label: 'সেটিংস', sublabel: 'টিম ও ডেটা ব্যাকআপ', icon: Settings },
  ];

  const handleNavClick = (tab: ActiveNavTab) => {
    onTabChange(tab);
    onCloseMobile();
  };

  return (
    <>
      {isMobileOpen && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden" onClick={onCloseMobile} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[var(--border)] bg-[var(--bg-surface)] shadow-xs transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white shadow-sm">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-base font-bold text-[var(--text-primary)]">লিড ইনবক্স</span>
              <span className="block text-[11px] font-medium text-[var(--text-secondary)]">Unified Lead CRM</span>
            </div>
          </div>
        </div>
        <div className="p-4">
          <button onClick={onOpenAddModal} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-solid)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] shadow-xs transition hover:bg-[var(--accent-hover)] active:scale-[0.99]">
            <PlusCircle className="h-4 w-4" />
            <span>নতুন লিড যোগ করুন</span>
          </button>
        </div>
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => handleNavClick(item.id)} className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-all ${isActive ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)] font-bold border-l-3 border-[var(--accent-solid)] pl-2.5' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] font-medium'}`}>
                <div className="flex items-center gap-3 truncate">
                  <Icon className={`h-4.5 w-4.5 shrink-0 transition-colors ${isActive ? 'text-[var(--accent-solid)]' : 'text-[var(--text-secondary)]'}`} />
                  <div className="truncate">
                    <span className="block truncate leading-tight">{item.label}</span>
                    <span className="block truncate text-[11px] text-[var(--text-muted)]">{item.sublabel}</span>
                  </div>
                </div>
                {item.badge && <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${isActive ? 'bg-[var(--accent-solid)] text-[var(--accent-contrast)]' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'}`}>{item.badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="mx-3 mb-3 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
            <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-[var(--accent-solid)]" /> সোর্স সারসংক্ষেপ</span>
            <span className="text-[11px] font-normal text-[var(--text-secondary)]">মোট {toBengaliNumerals(stats.totalLeads)}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--badge-teal-bg)] border border-[var(--badge-teal-border)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--badge-teal-text)]">
              FB {toBengaliNumerals(stats.facebookCount)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--badge-teal-bg)] border border-[var(--badge-teal-border)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--badge-teal-text)]">
              Msg {toBengaliNumerals(stats.messengerCount)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--badge-green-bg)] border border-[var(--badge-green-border)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--badge-green-text)]">
              WA {toBengaliNumerals(stats.whatsappCount)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--badge-pink-bg)] border border-[var(--badge-pink-border)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--badge-pink-text)]">
              Web {toBengaliNumerals(stats.websiteCount)}
            </span>
          </div>
        </div>
        <div className="border-t border-[var(--border)] p-3 bg-[var(--bg-surface)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-bold text-[var(--accent-soft-text)] text-xs">{currentUser?.name ? currentUser.name.charAt(0) : 'অ'}</div>
              <div className="text-xs truncate">
                <div className="flex items-center gap-1.5">
                  <span className="block font-semibold text-[var(--text-primary)] truncate">{currentUser?.name || 'অ্যাডমিন'}</span>
                  <span className={`inline-flex items-center rounded px-1 py-0.2 text-[9px] font-bold ${
                    currentUser?.role === 'super_admin' 
                      ? 'bg-amber-100 text-amber-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {currentUser?.role === 'super_admin' ? 'মালিক' : 'সেলস'}
                  </span>
                </div>
                <span className="block text-[10px] text-[var(--text-muted)] font-mono truncate">{currentUser?.email || PRIMARY_ADMIN_EMAIL}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  title={themeMode === 'dark' ? 'লাইট মোডে পরিবর্তন করুন' : 'ডার্ক মোডে পরিবর্তন করুন'}
                  aria-label="থিম পরিবর্তন"
                >
                  {themeMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              )}
              {onLogout && (
                <button onClick={onLogout} className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)] transition-colors cursor-pointer" title="লগআউট" aria-label="লগআউট">
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
