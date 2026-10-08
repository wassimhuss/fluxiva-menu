import { ArrowLeft, ArrowRight, Check, FolderOpen, ImageOff, Maximize2, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { GalleryCategory, GalleryImage, Language } from '../lib/types'
import { ImageLightbox } from './ImageLightbox'

interface GalleryPickerProps {
  images: GalleryImage[]
  categories: GalleryCategory[]
  language: Language
  loading: boolean
  selectedId?: string | null
  onSelect: (image: GalleryImage) => void
  onRemove: () => void
  onClose: () => void
}

export function GalleryPicker({ images, categories, language, loading, selectedId, onSelect, onRemove, onClose }: GalleryPickerProps) {
  const [search, setSearch] = useState('')
  const [folderId, setFolderId] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<GalleryImage | null>(null)
  const arabic = language === 'ar'

  useEffect(() => {
    if (!selectedId || folderId) return
    const selected = images.find((image) => image.id === selectedId)
    if (selected) setFolderId(selected.category_id)
  }, [images, selectedId, folderId])

  const selectedFolder = categories.find((category) => category.id === folderId)
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(language)
    if (!folderId && !term) return []
    return images.filter((image) => {
      if (!term && image.category_id !== folderId) return false
      if (!term) return true
      return [image.name_en, image.name_ar, image.category_en, image.category_ar, ...image.tags_en, ...image.tags_ar]
        .join(' ').toLocaleLowerCase(language).includes(term)
    })
  }, [images, search, folderId, language])

  return (
    <div className="gallery-picker-backdrop" role="presentation">
      <section className="gallery-picker" role="dialog" aria-modal="true" aria-labelledby="gallery-picker-title" dir={arabic ? 'rtl' : 'ltr'}>
        <header>
          <div><span>{arabic ? 'مكتبة Fluxiva' : 'Fluxiva Gallery'}</span><h2 id="gallery-picker-title">{selectedFolder ? (arabic ? selectedFolder.name_ar : selectedFolder.name_en) : arabic ? 'اختر مجلداً' : 'Choose a folder'}</h2></div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={arabic ? 'إغلاق' : 'Close'}><X /></button>
        </header>
        <div className="gallery-picker-tools">
          <label className="gallery-search"><Search /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={arabic ? 'ابحث في كل المجلدات…' : 'Search every folder…'} /></label>
          {folderId && !search && <button type="button" className="gallery-folder-back" onClick={() => setFolderId(null)}>{arabic ? <ArrowRight /> : <ArrowLeft />} {arabic ? 'كل المجلدات' : 'All folders'}</button>}
        </div>
        {loading ? <p className="gallery-empty">{arabic ? 'جارٍ تحميل الصور…' : 'Loading gallery…'}</p> : !folderId && !search ? (
          categories.length ? <div className="gallery-folder-grid">{categories.map((category) => {
            const cover = images.find((image) => image.category_id === category.id)
            return <button type="button" onClick={() => setFolderId(category.id)} key={category.id}>
              <span>{cover ? <img src={cover.thumbnail_url} alt="" loading="lazy" /> : <FolderOpen />}</span>
              <b>{arabic ? category.name_ar : category.name_en}</b>
              <small>{category.image_count ?? images.filter((image) => image.category_id === category.id).length} {arabic ? 'صور' : 'images'}</small>
            </button>
          })}</div> : <p className="gallery-empty">{arabic ? 'لا توجد مجلدات متاحة.' : 'No gallery folders are available.'}</p>
        ) : filtered.length ? (
          <div className="gallery-grid">
            {filtered.map((image) => {
              const selected = selectedId === image.id
              const name = arabic ? image.name_ar : image.name_en
              return <article className={selected ? 'selected' : ''} key={image.id}>
                <button type="button" className="gallery-thumb gallery-preview-trigger" onClick={() => setPreviewImage(image)} aria-label={`${arabic ? 'عرض الصورة' : 'View photo'}: ${name}`}><img src={image.thumbnail_url} alt="" loading="lazy" /><span><Maximize2 /></span>{selected && <i><Check /></i>}</button>
                <button type="button" className="gallery-image-select" onClick={() => onSelect(image)} aria-pressed={selected}><b>{name}</b><small>{arabic ? image.category_ar : image.category_en}</small></button>
              </article>
            })}
          </div>
        ) : <p className="gallery-empty">{arabic ? 'لا توجد صور مطابقة.' : 'No images match your search.'}</p>}
        <footer>
          {selectedId && <button type="button" className="gallery-remove" onClick={onRemove}><ImageOff /> {arabic ? 'إزالة الصورة' : 'Remove photo'}</button>}
          <button type="button" className="button button-outline button-small" onClick={onClose}>{arabic ? 'إغلاق' : 'Close'}</button>
        </footer>
      </section>
      {previewImage && <ImageLightbox url={previewImage.image_url} name={arabic ? previewImage.name_ar : previewImage.name_en} closeLabel={arabic ? 'إغلاق معاينة الصورة' : 'Close image preview'} loadingLabel={arabic ? 'جارٍ تحميل الصورة بالحجم الكامل' : 'Loading full-size image'} actionLabel={arabic ? 'استخدم هذه الصورة' : 'Use this photo'} onAction={() => onSelect(previewImage)} onClose={() => setPreviewImage(null)} />}
    </div>
  )
}
