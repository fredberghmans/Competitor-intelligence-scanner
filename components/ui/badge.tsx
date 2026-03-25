type BadgeVariant = 'indigo' | 'emerald' | 'amber' | 'slate' | 'red'

const variantClasses: Record<BadgeVariant, string> = {
  indigo: 'bg-indigo-100 text-indigo-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  slate: 'bg-slate-100 text-slate-600',
  red: 'bg-red-100 text-red-700',
}

type Props = {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export default function Badge({ children, variant = 'slate', className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

export function competitorTypeBadge(type: string) {
  const map: Record<string, BadgeVariant> = {
    crypto_exchange: 'indigo',
    bank: 'emerald',
    hybrid: 'amber',
  }
  return map[type] ?? 'slate'
}

export function competitorTypeLabel(type: string) {
  const map: Record<string, string> = {
    crypto_exchange: 'Crypto Exchange',
    bank: 'Bank',
    hybrid: 'Hybrid',
  }
  return map[type] ?? type
}
