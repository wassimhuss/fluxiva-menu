import { Archive, ImagePlus, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createGalleryImage, deleteGalleryImage, discardGalleryAssets, listPlatformGalleryImages, updateGalleryImage, uploadGalleryAssets } from '../lib/api'
import type { GalleryImage } from '../lib/types'
import styles from '../pages/Platform.module.css'

type Draft = {
  name_en: string; name_ar: string; category_en: string; category_ar: string
  tags_en: string; tags_ar: string; source: string; license_notes: string; file: File | null
}

const emptyDraft = (): Draft => ({ name_en: '', name_ar: '', category_en: '', category_ar: '', tags_en: '', tags_ar: '', source: '', license_notes: '', file: null })
const tags = (value: string) => value.split(',').map((tag) => tag.trim()).filter(Boolean)

export function PlatformGallery() {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [editing, setEditing] = useState<GalleryImage | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function refresh() { setImages(await listPlatformGalleryImages()) }
  useEffect(() => { refresh().catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load the gallery')).finally(() => setLoading(false)) }, [])

  function beginEdit(image: GalleryImage) {
    setEditing(image)
    setDraft({ name_en: image.name_en, name_ar: image.name_ar, category_en: image.category_en, category_ar: image.category_ar, tags_en: image.tags_en.join(', '), tags_ar: image.tags_ar.join('، '), source: image.source ?? '', license_notes: image.license_notes ?? '', file: null })
  }

  function closeForm() { setEditing(null); setDraft(emptyDraft()) }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('')
    const isEditing = Boolean(editing?.id)
    const input = { name_en: draft.name_en, name_ar: draft.name_ar, category_en: draft.category_en, category_ar: draft.category_ar, tags_en: tags(draft.tags_en), tags_ar: draft.tags_ar.split(/[،,]/).map((tag) => tag.trim()).filter(Boolean), source: draft.source, license_notes: draft.license_notes }
    const id = editing?.id ?? crypto.randomUUID()
    let urls: { image_url: string; thumbnail_url: string } | undefined
    try {
      if (isEditing && editing) await updateGalleryImage(editing.id, { ...input, active: editing.active })
      else {
        if (!draft.file) throw new Error('Choose an image to upload.')
        urls = await uploadGalleryAssets(id, draft.file)
        await createGalleryImage(id, input, urls)
      }
      await refresh(); closeForm(); setSuccess(isEditing ? 'Gallery details updated.' : 'Image added to the gallery.')
    } catch (caught) {
      if (!isEditing && urls) await discardGalleryAssets(id, urls)
      setError(caught instanceof Error ? caught.message : 'Could not save this gallery image')
    } finally { setSaving(false) }
  }

  async function toggleActive(image: GalleryImage) {
    setError(''); setSuccess('')
    try {
      await updateGalleryImage(image.id, { name_en: image.name_en, name_ar: image.name_ar, category_en: image.category_en, category_ar: image.category_ar, tags_en: image.tags_en, tags_ar: image.tags_ar, source: image.source, license_notes: image.license_notes, active: !image.active })
      await refresh(); setSuccess(image.active ? 'Image archived. Existing menu items keep using it.' : 'Image is available to owners again.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update this image') }
  }

  async function remove(image: GalleryImage) {
    if (!window.confirm(`Permanently delete “${image.name_en}”? This is allowed only when it is unused.`)) return
    setError(''); setSuccess('')
    try { await deleteGalleryImage(image); await refresh(); setSuccess('Gallery image deleted.') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not delete this image') }
  }

  return (
    <section className={styles.gallerySection}>
      <div className={styles.galleryHeading}><div><span>Shared assets</span><h2>Fluxiva Gallery</h2><p>Curated photos owners can reuse without creating copies.</p></div><button className={`${styles.action} ${styles.actionPrimary}`} onClick={() => { closeForm(); setEditing({} as GalleryImage) }}><Plus /> Add image</button></div>
      {error && <p className={styles.galleryError}>{error}</p>}{success && <p className={styles.gallerySuccess}>{success}</p>}
      {loading ? <p className={styles.empty}>Loading gallery…</p> : images.length ? <div className={styles.galleryCards}>{images.map((image) => <article className={`${styles.galleryCard} ${image.active ? '' : styles.galleryArchived}`} key={image.id}>
        <img src={image.thumbnail_url} alt="" loading="lazy" /><div className={styles.galleryCardBody}><div className={styles.galleryCardTitle}><div><b>{image.name_en}</b><small dir="rtl">{image.name_ar}</small></div><span>{image.active ? 'Active' : 'Archived'}</span></div><p>{image.category_en} · {image.category_ar}</p><small>{image.usage_count ?? 0} menu item{image.usage_count === 1 ? '' : 's'} using this</small><div className={styles.galleryCardActions}><button onClick={() => beginEdit(image)}><Pencil /> Edit</button><button onClick={() => toggleActive(image)}>{image.active ? <><Archive /> Archive</> : <><RotateCcw /> Restore</>}</button><button className={styles.galleryDelete} disabled={Boolean(image.usage_count)} title={image.usage_count ? 'Archive images that are currently in use' : 'Permanently delete'} onClick={() => remove(image)}><Trash2 /> Delete</button></div></div>
      </article>)}</div> : <div className={styles.galleryEmpty}><ImagePlus /><h3>No gallery images yet</h3><p>Add the first licensed food photo for restaurant owners.</p></div>}

      {editing && <div className="modal-backdrop"><form className={`modal-card modal-large ${styles.galleryForm}`} onSubmit={save}><button type="button" className="modal-close" onClick={closeForm}><X /></button><span className="eyebrow"><span /> Super admin only</span><h2>{editing.id ? 'Edit gallery image' : 'Add gallery image'}</h2><p>Names, categories and tags are paired so owners can search in English or Arabic.</p><div className="form-grid">
        {!editing.id && <label className={`image-upload ${styles.galleryFile}`}>Food photo<span><ImagePlus /> {draft.file?.name ?? 'Choose JPG, PNG or WebP'}</span><input required type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setDraft({ ...draft, file: event.target.files?.[0] ?? null })} /></label>}
        <label>English name<input required value={draft.name_en} onChange={(event) => setDraft({ ...draft, name_en: event.target.value })} /></label><label dir="rtl">Arabic name<input required dir="rtl" value={draft.name_ar} onChange={(event) => setDraft({ ...draft, name_ar: event.target.value })} /></label><label>English category<input required value={draft.category_en} onChange={(event) => setDraft({ ...draft, category_en: event.target.value })} /></label><label dir="rtl">Arabic category<input required dir="rtl" value={draft.category_ar} onChange={(event) => setDraft({ ...draft, category_ar: event.target.value })} /></label><label>English tags <small>Comma separated</small><input value={draft.tags_en} onChange={(event) => setDraft({ ...draft, tags_en: event.target.value })} /></label><label dir="rtl">Arabic tags <small>افصل بفاصلة</small><input dir="rtl" value={draft.tags_ar} onChange={(event) => setDraft({ ...draft, tags_ar: event.target.value })} /></label><label>Source / owner<input value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} /></label><label>License notes<input value={draft.license_notes} onChange={(event) => setDraft({ ...draft, license_notes: event.target.value })} /></label>
      </div><button className="button button-primary full" disabled={saving}>{saving ? 'Saving…' : editing.id ? 'Save details' : 'Upload to gallery'}</button></form></div>}
    </section>
  )
}
