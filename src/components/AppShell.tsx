import {
  House,
  Menu,
  MessagesSquare,
  Plus,
  ReceiptText,
  Search,
  Settings,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { routeHref, type Route } from '../hooks/useHashRoute'
import { useDisplayName } from '../lib/profile'
import { SyncStatus } from './SyncStatus'

interface NavItem {
  route: Route
  label: string
  mobileLabel: string
  icon: LucideIcon
}

const MAIN_NAV: NavItem[] = [
  { route: 'overview', label: 'Overview', mobileLabel: 'Home', icon: House },
  { route: 'add', label: 'Add transaction', mobileLabel: 'Add', icon: Plus },
  { route: 'transactions', label: 'Transactions', mobileLabel: 'Activity', icon: ReceiptText },
  { route: 'ask', label: 'Ask CICO', mobileLabel: 'Ask', icon: MessagesSquare },
]
const SETTINGS: NavItem = { route: 'settings', label: 'Settings', mobileLabel: 'Settings', icon: Settings }

const COLLAPSED_KEY = 'cico:sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1')
      } catch {
        // Not remembered in private browsing; the toggle still works.
      }
      return !c
    })
  }

  return (
    <div className="min-h-dvh lg:flex">
      <SidebarNav route={route} collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <MobileTopBar onMenu={() => setDrawerOpen(true)} />
        <DesktopTopBar />
        <main>{children}</main>
      </div>
      <MobileBottomNav route={route} />
      <MobileDrawer route={route} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}

function Wordmark() {
  return <span className="font-serif text-2xl font-semibold tracking-tight text-deep">CICO</span>
}

function SidebarNav({ route, collapsed, onToggle }: { route: Route; collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface py-5 transition-[width] duration-200 ease-out lg:flex ${
        collapsed ? 'w-[76px] px-3' : 'w-60 px-4'
      }`}
    >
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between pl-3'}`}>
        {!collapsed && <Wordmark />}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex size-11 cursor-pointer items-center justify-center rounded-sm text-ink-muted transition-colors duration-150 hover:bg-surface-muted hover:text-ink"
        >
          <Menu aria-hidden className="size-5" />
        </button>
      </div>
      <nav aria-label="Main" className="mt-7">
        <NavList items={MAIN_NAV} route={route} collapsed={collapsed} />
      </nav>
      <div className="mt-auto flex flex-col gap-4">
        <NavList items={[SETTINGS]} route={route} collapsed={collapsed} />
        {collapsed ? <SyncStatus compact className="justify-center" /> : <SyncStatus className="px-3" />}
      </div>
    </aside>
  )
}

function NavList({
  items,
  route,
  collapsed = false,
  mobileLabels = false,
  onNavigate,
}: {
  items: NavItem[]
  route: Route
  collapsed?: boolean
  // The phone drawer uses the bottom bar's names, so each screen has one name per device.
  mobileLabels?: boolean
  onNavigate?: () => void
}) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ route: r, label: fullLabel, mobileLabel, icon: Icon }) => {
        const label = mobileLabels ? mobileLabel : fullLabel
        const active = r === route
        return (
          <li key={r}>
            <a
              href={routeHref(r)}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? label : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-sm text-sm font-medium transition-colors duration-150 ${
                collapsed ? 'justify-center' : 'px-3'
              } ${active ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'}`}
            >
              <Icon aria-hidden className="size-[18px] shrink-0" />
              <span className={collapsed ? 'sr-only' : ''}>{label}</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}

function DesktopTopBar() {
  const name = useDisplayName()
  const [query, setQuery] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    window.location.hash = routeHref('transactions', q ? { q } : undefined).slice(1)
    setQuery('')
  }

  return (
    <div className="hidden items-center justify-between gap-4 border-b border-border bg-surface/70 px-8 py-3 backdrop-blur lg:flex">
      <form role="search" onSubmit={submit} className="relative w-full max-w-md">
        <label htmlFor="global-search" className="sr-only">
          Search transactions
        </label>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
        <input
          id="global-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transactions…"
          autoComplete="off"
          className="block h-10 w-full rounded-sm border border-border bg-bg pr-3 pl-9 text-sm text-ink placeholder:text-ink-muted/80 transition-colors duration-150 hover:border-ink-muted/40 focus:border-primary focus:bg-surface focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
      </form>
      <div className="flex items-center gap-2">
        <a
          href={routeHref('add')}
          className="inline-flex h-10 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover"
        >
          <Plus aria-hidden className="size-4" />
          Add transaction
        </a>
        <a
          href={routeHref('settings')}
          aria-label="Settings"
          title="Settings"
          className="flex size-10 items-center justify-center rounded-full bg-deep text-sm font-semibold text-mint transition-opacity duration-150 hover:opacity-90"
        >
          {name ? name.charAt(0).toUpperCase() : <Settings aria-hidden className="size-[18px]" />}
        </a>
      </div>
    </div>
  )
}

function MobileTopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="flex size-11 cursor-pointer items-center justify-center rounded-sm text-ink transition-colors duration-150 hover:bg-surface-muted"
        >
          <Menu aria-hidden className="size-5" />
        </button>
        <Wordmark />
      </div>
      <SyncStatus className="pr-2" />
    </div>
  )
}

// A modal dialog: it covers the bottom bar and the page, traps focus, closes on Escape or a
// tap outside, and returns focus to the menu button when it closes.
function MobileDrawer({ route, open, onClose }: { route: Route; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // Focus the drawer itself rather than its first button, so no focus ring flashes on
      // the close button when the menu is opened by touch.
      dialog.focus()
    } else if (!open && dialog.open) dialog.close()
    if (!open) return
    // The page behind stays put while the drawer is open.
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previous
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label="Menu"
      tabIndex={-1}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="m-0 h-dvh max-h-none w-[min(320px,85vw)] max-w-none bg-surface p-0 text-ink shadow-lg outline-none backdrop:bg-black/35 open:motion-safe:animate-[drawer-in_200ms_ease-out] lg:hidden"
    >
      <div className="flex h-full flex-col overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between pl-3">
          <Wordmark />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex size-11 cursor-pointer items-center justify-center rounded-sm text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <nav aria-label="Menu" className="mt-6">
          <NavList items={[...MAIN_NAV, SETTINGS]} route={route} mobileLabels onNavigate={onClose} />
        </nav>
        <SyncStatus className="mt-auto px-3 pt-6" />
      </div>
    </dialog>
  )
}

function MobileBottomNav({ route }: { route: Route }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {MAIN_NAV.map(({ route: r, mobileLabel, icon: Icon }) => {
          const active = r === route
          const isAdd = r === 'add'
          return (
            <li key={r} className="flex-1">
              <a
                href={routeHref(r)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors duration-150 ${
                  active ? 'text-primary' : 'text-ink-muted'
                }`}
              >
                {/* Every icon sits in the same 40px box so the labels line up. */}
                <span className="flex h-10 items-center justify-center">
                  <span
                    className={
                      isAdd
                        ? `flex size-10 items-center justify-center rounded-full ${active ? 'bg-primary-hover' : 'bg-primary'} text-white shadow-card`
                        : `flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-150 ${active ? 'bg-primary-soft' : ''}`
                    }
                  >
                    <Icon aria-hidden className="size-5" />
                  </span>
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
