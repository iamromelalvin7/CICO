import { useSyncExternalStore } from 'react'

export type Route = 'overview' | 'add' | 'transactions' | 'ask' | 'settings'

const PATHS: Record<string, Route> = {
  '': 'overview',
  '/': 'overview',
  '/add': 'add',
  '/transactions': 'transactions',
  '/ask': 'ask',
  '/settings': 'settings',
}

// "#/transactions?q=lunch" -> path "/transactions", query "q=lunch".
function parts(): { path: string; query: string } {
  const hash = window.location.hash.replace(/^#/, '')
  const i = hash.indexOf('?')
  return i === -1 ? { path: hash, query: '' } : { path: hash.slice(0, i), query: hash.slice(i + 1) }
}

function current(): Route {
  return PATHS[parts().path] ?? 'overview'
}

function currentQuery(): string {
  return parts().query
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

// Hash routes (#/add) work offline and from any static host without rewrites.
export function useHashRoute(): Route {
  return useSyncExternalStore(subscribe, current, () => 'overview')
}

// One query parameter from the hash, e.g. useHashParam('q').
export function useHashParam(name: string): string {
  const query = useSyncExternalStore(subscribe, currentQuery, () => '')
  return new URLSearchParams(query).get(name) ?? ''
}

export function routeHref(route: Route, params?: Record<string, string>): string {
  const base = route === 'overview' ? '#/' : `#/${route}`
  const query = params ? new URLSearchParams(params).toString() : ''
  return query ? `${base}?${query}` : base
}
