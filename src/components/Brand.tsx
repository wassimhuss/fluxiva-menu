import { Link } from 'react-router-dom'

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link className={`brand ${light ? 'brand-light' : ''}`} to="/" aria-label="Fluxiva Menu home">
      <span className="brand-mark"><i /><i /><i /></span>
      <span>fluxiva<em>menu</em></span>
    </Link>
  )
}
