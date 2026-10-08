import { LoaderCircle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ImageLightboxProps {
  url: string
  name: string
  closeLabel: string
  loadingLabel?: string
  onClose: () => void
  actionLabel?: string
  onAction?: () => void
}

export function ImageLightbox({ url, name, closeLabel, loadingLabel = 'Loading full-size image', onClose, actionLabel, onAction }: ImageLightboxProps) {
  const [loading, setLoading] = useState(true)

  useEffect(() => { setLoading(true) }, [url])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])

  return createPortal(<div className="image-lightbox" role="dialog" aria-modal="true" aria-label={name} onClick={onClose}>
    <div className="image-lightbox-card" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="image-lightbox-close" autoFocus aria-label={closeLabel} onClick={onClose}><X /></button>
      <div className="image-lightbox-media">
        {loading && <span className="image-lightbox-loading" role="status" aria-label={loadingLabel}><LoaderCircle /></span>}
        <img className={loading ? 'is-loading' : ''} src={url} alt={name} onLoad={() => setLoading(false)} onError={() => setLoading(false)} />
      </div>
      <div className="image-lightbox-footer"><p>{name}</p>{actionLabel && onAction && <button type="button" className="button button-primary" onClick={onAction}>{actionLabel}</button>}</div>
    </div>
  </div>, document.body)
}
