import { useSyncExternalStore } from 'react'

// The themes the user can pick from. Each one is a set of variables in styles/global.css under [data-theme='<id>'];
// the default dark theme is the plain :root block.
export const THEMES = [
  { id: 'dark', name: 'Dark (default)' },
  { id: 'light', name: 'Light' },
  { id: 'xp', name: 'Windows XP' },
  { id: 'mp', name: 'Mission Planner' },
  { id: 'contrast', name: 'High contrast' },
  { id: 'red', name: 'Red' },
  { id: 'green', name: 'Green' },
  { id: 'orange', name: 'Orange' }
] as const

export type ThemeId = (typeof THEMES)[number]['id']

const KEY = 'theme'
const DEFAULT_THEME: ThemeId = 'dark'

function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

function load(): ThemeId {
  try {
    const stored = localStorage.getItem(KEY)
    if (isThemeId(stored)) return stored
  } catch {
    // storage unavailable: use the default
  }
  return DEFAULT_THEME
}

let current: ThemeId = load()
const listeners = new Set<() => void>()

function apply(): void {
  document.documentElement.dataset.theme = current
}

// Call once at startup, before anything is drawn, so the first paint is already in the chosen theme.
export function initTheme(): void {
  apply()
}

export function setTheme(id: ThemeId): void {
  if (id === current) return
  current = id
  apply()
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // the choice just won't be remembered
  }
  for (const l of listeners) l()
}

export function useTheme(): ThemeId {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current
  )
}

export { isThemeId }
