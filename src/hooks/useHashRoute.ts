import { useSyncExternalStore } from 'react'

export type Route = 'overview' | 'add' | 'transactions' | 'ask'

const PATHS: Record<string, Route> = {
  '': 'overview',
  '/': 'overview',
  '/add': 'add',
  '/transactions': 'transactions',
  '/ask': 'ask',
}

function current(): Route {
  return PATHS[window.location.hash.replace(/^#/, '')] ?? 'overview'
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

// Hash routes (#/add) work offline and from any static host without rewrites.
export function useHashRoute(): Route {
  return useSyncExternalStore(subscribe, current, () => 'overview')
}

export function routeHref(route: Route): string {
  return route === 'overview' ? '#/' : `#/${route}`
}
