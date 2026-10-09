import { Link } from 'react-router-dom'

export function Brand({ light = false, homeLabel = 'Fluxiva Menu home' }: { light?: boolean; homeLabel?: string }) {
  return (
    <Link className={`brand ${light ? 'brand-light' : ''}`} to="/" aria-label={homeLabel}>
      <span className="brand-mark"><i /><i /><i /></span>
      <span lang="en" dir="ltr">fluxiva<em>menu</em></span>
    </Link>
  )
}
