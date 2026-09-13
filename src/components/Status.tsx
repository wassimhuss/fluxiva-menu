import { LoaderCircle } from 'lucide-react'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="state-message"><LoaderCircle className="spin" size={22} />{label}</div>
}

export function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'error' | 'success' }) {
  return <div className={`notice notice-${tone}`}>{children}</div>
}
