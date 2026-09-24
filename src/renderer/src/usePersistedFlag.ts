import { useState } from 'react'

// Boolean UI preference remembered in localStorage (falls back to the default if storage is unavailable).
export function usePersistedFlag(key: string, defaultValue: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? defaultValue : stored === 'true'
    } catch {
      return defaultValue
    }
  })

  function update(next: boolean): void {
    setValue(next)
    try {
      localStorage.setItem(key, String(next))
    } catch {
      // preference just won't persist
    }
  }

  return [value, update]
}
