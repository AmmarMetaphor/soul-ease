import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Logo } from '@/components/brand/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import {
  GoalIcon,
  HomeIcon,
  JournalIcon,
  PersonIcon,
  SessionsIcon,
  SettingsIcon,
  ShieldIcon,
  ToolkitIcon,
  WaveIcon,
} from '@/components/ui/Icons';
import { ROUTES } from '@/config/app';
import { useData } from '@/data/DataContext';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  labelKey:
    | 'nav.home'
    | 'nav.sessions'
    | 'nav.journal'
    | 'nav.goals'
    | 'nav.toolkit'
    | 'nav.humanSupport'
    | 'nav.settings'
    | 'nav.safety';
  icon: typeof HomeIcon;
  end?: boolean;
  mobile?: boolean;
}

const NAV: NavItem[] = [
  { to: ROUTES.dashboard, labelKey: 'nav.home', icon: HomeIcon, end: true, mobile: true },
  { to: ROUTES.sessions, labelKey: 'nav.sessions', icon: SessionsIcon, mobile: true },
  { to: ROUTES.journal, labelKey: 'nav.journal', icon: JournalIcon, mobile: true },
  { to: ROUTES.goals, labelKey: 'nav.goals', icon: GoalIcon },
  { to: ROUTES.toolkit, labelKey: 'nav.toolkit', icon: ToolkitIcon, mobile: true },
  { to: ROUTES.humanSupport, labelKey: 'nav.humanSupport', icon: PersonIcon },
  { to: ROUTES.safety, labelKey: 'nav.safety', icon: ShieldIcon },
  { to: ROUTES.settings, labelKey: 'nav.settings', icon: SettingsIcon, mobile: true },
];

export function AppShell() {
  const t = useT();
  const navigate = useNavigate();
  const { signOut, isDemo } = useAuth();
  const { profile } = useData();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-e border-ink-900/5 bg-ivory-50/70 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:px-5 lg:py-6">
        <Logo to={ROUTES.dashboard} />
        <button
          type="button"
          onClick={() => navigate(ROUTES.session)}
          className="mt-8 flex items-center gap-3 rounded-2xl bg-emerald-700 px-4 py-3.5 text-start text-ivory-50 shadow-soft transition-colors hover:bg-emerald-800"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
            <WaveIcon size={18} />
          </span>
          <span>
            <span className="block text-sm font-semibold">{t('nav.talk')}</span>
            <span className="block text-xs text-ivory-50/70">{t('dashboard.talkSubtitle')}</span>
          </span>
        </button>
        <nav className="mt-6 flex flex-1 flex-col gap-1" aria-label="App">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-white text-emerald-800 shadow-soft' : 'text-ink-700 hover:bg-ink-900/[0.04]',
                )
              }
            >
              <item.icon size={18} className="shrink-0 text-current opacity-80" />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6 space-y-3 border-t border-ink-900/5 pt-5">
          <LanguageSwitcher />
          <div className="flex items-center justify-between text-sm">
            <span className="truncate text-ink-500">{profile?.displayName ?? (isDemo ? t('common.demoBadge') : '')}</span>
            <button
              type="button"
              onClick={() => void signOut().then(() => navigate(ROUTES.home))}
              className="text-ink-500 hover:text-ink-900"
            >
              {t('common.signOut')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between px-5 py-4 lg:hidden">
          <Logo to={ROUTES.dashboard} />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-28 pt-2 sm:px-8 lg:px-10 lg:pb-16 lg:pt-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-900/5 bg-ivory-50/90 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="App"
      >
        <ul className="grid grid-cols-5">
          {NAV.filter((n) => n.mobile).map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium',
                    isActive ? 'text-emerald-800' : 'text-ink-500',
                  )
                }
              >
                <item.icon size={20} />
                <span className="truncate">{t(item.labelKey)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
