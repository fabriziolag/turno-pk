import type { ButtonHTMLAttributes } from 'react'

const VARIANTS = {
  primary: 'bg-leaf text-white hover:bg-leaf-bright',
  gold: 'bg-gradient-to-br from-gold to-gold-deep text-[#1a1206] hover:brightness-105',
  ghost: 'bg-panel2 text-ink hover:bg-[#e9e4d3]',
  danger: 'bg-[#f4e3e3] text-[#b23a3a] hover:bg-[#eccccc]',
  wa: 'bg-[#1faa52] text-white hover:bg-[#159443]',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS
  sm?: boolean
}

export function Button({ variant = 'ghost', sm, className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
        sm ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'
      } ${VARIANTS[variant]} ${className}`}
    />
  )
}
