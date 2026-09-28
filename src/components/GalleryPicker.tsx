import { Check, ImageOff, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { GalleryImage, Language } from '../lib/types'

interface GalleryPickerProps {
  images: GalleryImage[]
  language: Language
  loading: boolean
  selectedId?: string | null
  onSelect: (image: GalleryImage) => void
  onRemove: () => void
  onClose: () => void
}

export function GalleryPicker({ images, language, loading, selectedId, onSelect, onRemove, onClose }: GalleryPickerProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const arabic = language === 'ar'
  const categories = useMemo(() => Array.from(new Map(images.map((image) => [image.category_en, arabic ? image.category_ar : image.category_en])).entries()), [images, arabic])
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(language)
    return images.filter((image) => {
      if (category !== 'all' && image.category_en !== category) return false
      if (!term) return true
      return [image.name_en, image.name_ar, image.category_en, image.category_ar, ...image.tags_en, ...image.tags_ar]
        .join(' ').toLocaleLowerCase(language).includes(term)
    })
  }, [images, search, category, language])

  return (
    <div className="gallery-picker-backdrop" role="presentation">
      <section className="gallery-picker" role="dialog" aria-modal="true" aria-labelledby="gallery-picker-title" dir={arabic ? 'rtl' : 'ltr'}>
        <header>
          <div><span>{arabic ? 'مكتبة Fluxiva' : 'Fluxiva Gallery'}</span><h2 id="gallery-picker-title">{arabic ? 'اختر صورة للصنف' : 'Choose an item photo'}</h2></div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={arabic ? 'إغلاق' : 'Close'}><X /></button>
        </header>
        <div className="gallery-picker-tools">
          <label className="gallery-search"><Search /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={arabic ? 'ابحث عن طبق أو مكوّن…' : 'Search dishes or ingredients…'} /></label>
          <div className="gallery-categories" aria-label={arabic ? 'التصنيفات' : 'Categories'}>
            <button type="button" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>{arabic ? 'الكل' : 'All'}</button>
            {categories.map(([id, label]) => <button type="button" className={category === id ? 'active' : ''} onClick={() => setCategory(id)} key={id}>{label}</button>)}
          </div>
        </div>
        {loading ? <p className="gallery-empty">{arabic ? 'جارٍ تحميل الصور…' : 'Loading gallery…'}</p> : filtered.length ? (
          <div className="gallery-grid">
            {filtered.map((image) => {
              const selected = selectedId === image.id
              return <button type="button" className={selected ? 'selected' : ''} onClick={() => onSelect(image)} key={image.id} aria-pressed={selected}>
                <span className="gallery-thumb"><img src={image.thumbnail_url} alt="" loading="lazy" />{selected && <i><Check /></i>}</span>
                <b>{arabic ? image.name_ar : image.name_en}</b><small>{arabic ? image.category_ar : image.category_en}</small>
              </button>
            })}
          </div>
        ) : <p className="gallery-empty">{arabic ? 'لا توجد صور مطابقة.' : 'No images match your search.'}</p>}
        <footer>
          {selectedId && <button type="button" className="gallery-remove" onClick={onRemove}><ImageOff /> {arabic ? 'إزالة الصورة' : 'Remove photo'}</button>}
          <button type="button" className="button button-outline button-small" onClick={onClose}>{arabic ? 'إغلاق' : 'Close'}</button>
        </footer>
      </section>
    </div>
  )
}
