import type { Family } from './types'

export const FAM_COLORS = [
  '#e0884f', '#5aa85a', '#a463a4', '#5b8bb0', '#c2693f', '#8a9a3a', '#3a8a8a', '#b8607a',
]

export function famColor(i: number): string {
  return FAM_COLORS[i % FAM_COLORS.length]
}

/** id corto aleatorio para nuevas familias. */
export function uid(): string {
  return 'f' + Math.random().toString(36).slice(2, 9)
}

export function initials(name: string): string {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
}

/** "Fabrizio Álvarez · papá de Baltazar" para el selector de conductor. */
export function driverLabel(f: Family | undefined, parentIdx?: number | null): string {
  if (!f) return '—'
  const p =
    parentIdx != null && f.parents[parentIdx]
      ? f.parents[parentIdx]
      : f.parents.find((x) => x && x.name) || null
  const who = p && p.name ? p.name : f.famName ? 'Familia ' + f.famName : '—'
  const role = p && p.role ? p.role : 'apoderado/a'
  return `${who} · ${role} de ${f.kidName || '—'}`
}

/** Versión corta: solo el nombre del apoderado o de la familia. */
export function driverShort(f: Family | undefined, parentIdx?: number | null): string {
  if (!f) return '—'
  const p =
    parentIdx != null && f.parents[parentIdx]
      ? f.parents[parentIdx]
      : f.parents.find((x) => x && x.name) || null
  return p && p.name ? p.name : f.famName || f.kidName || '—'
}
