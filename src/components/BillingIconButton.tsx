import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'

export function BillingIconButton({ label, icon: Icon, danger = false, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string; icon: LucideIcon; danger?: boolean
}) {
  return <button type="button" {...props} className={`cash-icon-button${danger ? ' danger' : ''} ${className}`} aria-label={label} title={label}>
    <Icon size={19} aria-hidden="true" />
    <span className="cash-icon-tooltip" aria-hidden="true">{label}</span>
  </button>
}
