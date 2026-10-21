import { House, Plus, ReceiptText } from 'lucide-react'
import type { ReactNode } from 'react'
import { routeHref, type Route } from '../hooks/useHashRoute'
import { SyncStatus } from './SyncStatus'

// Only screens that exist are listed; Ask CICO and Settings join as they are built.
const NAV: Array<{ route: Route; label: string; mobileLabel: string; icon: typeof House }> = [
  { route: 'overview', label: 'Overview', mobileLabel: 'Home', icon: House },
  { route: 'add', label: 'Add transaction', mobileLabel: 'Add', icon: Plus },
  { route: 'transactions', label: 'Transactions', mobileLabel: 'Activity', icon: ReceiptText },
]

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:flex">
      <SidebarNav route={route} />
      <div className="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <MobileTopBar />
        <main>{children}</main>
      </div>
      <MobileBottomNav route={route} />
    </div>
  )
}

function Wordmark() {
  return <span className="font-serif text-2xl font-semibold tracking-tight text-deep">CICO</span>
}

function SidebarNav({ route }: { route: Route }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
      <div className="px-3">
        <Wordmark />
      </div>
      <nav aria-label="Main" className="mt-8">
        <ul className="flex flex-col gap-1">
          {NAV.map(({ route: r, label, icon: Icon }) => {
            const active = r === route
            return (
              <li key={r}>
                <a
                  href={routeHref(r)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-sm px-3 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? 'bg-primary-soft text-primary'
                      : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                  }`}
                >
                  <Icon aria-hidden className="size-[18px]" />
                  {label}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
      <SyncStatus className="mt-auto px-3" />
    </aside>
  )
}

function MobileTopBar() {
  return (
    <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] lg:hidden">
      <Wordmark />
      <SyncStatus />
    </div>
  )
}

function MobileBottomNav({ route }: { route: Route }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {NAV.map(({ route: r, mobileLabel, icon: Icon }) => {
          const active = r === route
          const isAdd = r === 'add'
          return (
            <li key={r} className="flex-1">
              <a
                href={routeHref(r)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                  active ? 'text-primary' : 'text-ink-muted'
                }`}
              >
                <span
                  className={
                    isAdd
                      ? `flex size-9 items-center justify-center rounded-full ${active ? 'bg-primary-hover' : 'bg-primary'} text-white`
                      : 'flex size-9 items-center justify-center'
                  }
                >
                  <Icon aria-hidden className="size-5" />
                </span>
                {mobileLabel}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
