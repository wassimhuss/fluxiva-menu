import { Archive, ArrowDown, ArrowUp, Folder, FolderOpen, FolderPlus, ImagePlus, Maximize2, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { clearGalleryImages, createGalleryCategory, createGalleryImage, deleteGalleryCategory, deleteGalleryImage, discardGalleryAssets, ITEM_IMAGE_HEIGHT, ITEM_IMAGE_WIDTH, listPlatformGalleryCategories, listPlatformGalleryImages, updateGalleryCategory, updateGalleryImage, uploadGalleryAssets, validateGalleryImage, validateGallerySource } from '../lib/api'
import type { GalleryCategory, GalleryImage } from '../lib/types'
import styles from '../pages/Platform.module.css'
import { ImageLightbox } from './ImageLightbox'
import { PortraitImageCropper } from './PortraitImageCropper'

type ImageDraft = {
  category_id: string; name_en: string; name_ar: string; tags_en: string; tags_ar: string
  source: string; license_notes: string; file: File | null
}
type FolderDraft = { name_en: string; name_ar: string }
type FileCheck = { state: 'idle' | 'checking' | 'valid' | 'invalid'; message: string }

const emptyImage = (): ImageDraft => ({ category_id: '', name_en: '', name_ar: '', tags_en: '', tags_ar: '', source: '', license_notes: '', file: null })
const emptyFolder = (): FolderDraft => ({ name_en: '', name_ar: '' })
const tags = (value: string) => value.split(',').map((tag) => tag.trim()).filter(Boolean)

export function PlatformGallery() {
  const [categories, setCategories] = useState<GalleryCategory[]>([])
  const [selectedFolder, setSelectedFolder] = useState<GalleryCategory | null>(null)
  const [folderImages, setFolderImages] = useState<GalleryImage[]>([])
  const [folderLoading, setFolderLoading] = useState(false)
  const [folderError, setFolderError] = useState('')
  const [draft, setDraft] = useState<ImageDraft>(emptyImage())
  const [editing, setEditing] = useState<GalleryImage | null>(null)
  const [imageFormOpen, setImageFormOpen] = useState(false)
  const [folderDraft, setFolderDraft] = useState<FolderDraft>(emptyFolder())
  const [editingFolder, setEditingFolder] = useState<GalleryCategory | null>(null)
  const [folderFormOpen, setFolderFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fileCheck, setFileCheck] = useState<FileCheck>({ state: 'idle', message: '' })
  const [pendingCrop, setPendingCrop] = useState<File | null>(null)
  const [clearGalleryOpen, setClearGalleryOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState<GalleryImage | null>(null)

  async function refreshCategories() {
    setCategories(await listPlatformGalleryCategories())
  }
  async function refreshFolderImages(categoryId: string) {
    setFolderImages(await listPlatformGalleryImages(categoryId))
  }
  useEffect(() => { refreshCategories().catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load the gallery')).finally(() => setLoading(false)) }, [])

  async function openFolderContents(category: GalleryCategory) {
    setSelectedFolder(category); setFolderImages([]); setFolderError(''); setFolderLoading(true)
    try { await refreshFolderImages(category.id) }
    catch (caught) { setFolderError(caught instanceof Error ? caught.message : 'Could not load this folder') }
    finally { setFolderLoading(false) }
  }
  function closeFolderContents() { setSelectedFolder(null); setFolderImages([]); setFolderError('') }
  async function refreshVisibleGallery(categoryId: string) {
    await Promise.all([
      refreshCategories(),
      selectedFolder?.id === categoryId ? refreshFolderImages(categoryId) : Promise.resolve(),
    ])
  }

  function openNewImage(categoryId?: string) {
    setEditing(null); setFileCheck({ state: 'idle', message: '' }); setDraft({ ...emptyImage(), category_id: categoryId ?? categories.find((category) => category.active)?.id ?? '' }); setImageFormOpen(true)
  }
  function beginEdit(image: GalleryImage) {
    setEditing(image); setImageFormOpen(true)
    setDraft({ category_id: image.category_id, name_en: image.name_en, name_ar: image.name_ar, tags_en: image.tags_en.join(', '), tags_ar: image.tags_ar.join('، '), source: image.source ?? '', license_notes: image.license_notes ?? '', file: null })
  }
  function closeImageForm() { setImageFormOpen(false); setEditing(null); setPendingCrop(null); setDraft(emptyImage()); setFileCheck({ state: 'idle', message: '' }) }

  async function chooseImage(file: File | null) {
    if (!file) { setFileCheck({ state: 'idle', message: '' }); return }
    setFileCheck({ state: 'checking', message: 'Preparing cropper…' })
    try {
      await validateGallerySource(file)
      setPendingCrop(file)
      setFileCheck({ state: 'idle', message: '' })
    } catch (caught) {
      setFileCheck({ state: 'invalid', message: caught instanceof Error ? caught.message : 'This image could not be checked.' })
    }
  }

  async function acceptCrop(file: File) {
    try {
      await validateGalleryImage(file)
      setDraft((current) => ({ ...current, file }))
      setPendingCrop(null)
      setFileCheck({ state: 'valid', message: `${ITEM_IMAGE_WIDTH} × ${ITEM_IMAGE_HEIGHT} px · Cropped and ready to upload` })
    } catch (caught) {
      setFileCheck({ state: 'invalid', message: caught instanceof Error ? caught.message : 'This crop could not be prepared.' })
    }
  }

  async function saveImage(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('')
    const input = { category_id: editing?.category_id ?? draft.category_id, name_en: draft.name_en, name_ar: draft.name_ar, tags_en: tags(draft.tags_en), tags_ar: draft.tags_ar.split(/[،,]/).map((tag) => tag.trim()).filter(Boolean), source: draft.source, license_notes: draft.license_notes }
    const id = editing?.id ?? crypto.randomUUID()
    let urls: { image_url: string; thumbnail_url: string } | undefined
    try {
      if (editing) await updateGalleryImage(editing.id, { ...input, active: editing.active })
      else {
        if (!draft.file) throw new Error('Choose an image to upload.')
        urls = await uploadGalleryAssets(draft.category_id, id, draft.file)
        await createGalleryImage(id, input, urls)
      }
      await refreshVisibleGallery(input.category_id); closeImageForm(); setSuccess(editing ? 'Gallery details updated.' : 'Image added to the selected folder.')
    } catch (caught) {
      if (!editing && urls) await discardGalleryAssets(id, urls)
      setError(caught instanceof Error ? caught.message : 'Could not save this gallery image')
    } finally { setSaving(false) }
  }

  async function toggleImage(image: GalleryImage) {
    setError(''); setSuccess('')
    try {
      await updateGalleryImage(image.id, { category_id: image.category_id, name_en: image.name_en, name_ar: image.name_ar, tags_en: image.tags_en, tags_ar: image.tags_ar, source: image.source, license_notes: image.license_notes, active: !image.active })
      await refreshVisibleGallery(image.category_id); setSuccess(image.active ? 'Image archived. Existing menu items keep using it.' : 'Image is available to owners again.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update this image') }
  }

  async function removeImage(image: GalleryImage) {
    if (!window.confirm(`Permanently delete “${image.name_en}”? This is allowed only when it is unused.`)) return
    setError(''); setSuccess('')
    try { await deleteGalleryImage(image); await refreshVisibleGallery(image.category_id); setSuccess('Gallery image deleted.') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not delete this image') }
  }

  async function clearGallery() {
    setSaving(true); setError(''); setSuccess('')
    try {
      const allImages = await listPlatformGalleryImages()
      const deletedCount = await clearGalleryImages(allImages)
      await refreshCategories(); closeFolderContents(); setClearGalleryOpen(false)
      setSuccess(`${deletedCount} gallery image${deletedCount === 1 ? '' : 's'} removed. Menu items that used them no longer have an image.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not clear the gallery')
    } finally { setSaving(false) }
  }

  function openFolderForm(category?: GalleryCategory) {
    setEditingFolder(category ?? null); setFolderDraft(category ? { name_en: category.name_en, name_ar: category.name_ar } : emptyFolder()); setFolderFormOpen(true)
  }
  function closeFolderForm() { setFolderFormOpen(false); setEditingFolder(null); setFolderDraft(emptyFolder()) }

  async function saveFolder(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('')
    try {
      if (editingFolder) await updateGalleryCategory(editingFolder.id, { ...folderDraft, active: editingFolder.active, sort_order: editingFolder.sort_order })
      else await createGalleryCategory({ ...folderDraft, sort_order: categories.length + 1 })
      await refreshCategories(); closeFolderForm(); setSuccess(editingFolder ? 'Folder updated.' : 'Gallery folder created.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save this folder') }
    finally { setSaving(false) }
  }

  async function toggleFolder(category: GalleryCategory) {
    setError(''); setSuccess('')
    try {
      await updateGalleryCategory(category.id, { name_en: category.name_en, name_ar: category.name_ar, active: !category.active, sort_order: category.sort_order })
      await refreshCategories(); setSuccess(category.active ? 'Folder archived. Existing image links remain safe.' : 'Folder restored for owners.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update this folder') }
  }

  async function moveFolder(category: GalleryCategory, delta: number) {
    const index = categories.findIndex((entry) => entry.id === category.id)
    const other = categories[index + delta]
    if (!other) return
    setError('')
    try {
      await Promise.all([
        updateGalleryCategory(category.id, { name_en: category.name_en, name_ar: category.name_ar, active: category.active, sort_order: other.sort_order }),
        updateGalleryCategory(other.id, { name_en: other.name_en, name_ar: other.name_ar, active: other.active, sort_order: category.sort_order }),
      ])
      await refreshCategories()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not reorder folders') }
  }

  async function removeFolder(category: GalleryCategory) {
    if (!window.confirm(`Permanently delete the empty folder “${category.name_en}”?`)) return
    setError(''); setSuccess('')
    try { await deleteGalleryCategory(category); await refreshCategories(); setSuccess('Gallery folder deleted.') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not delete this folder') }
  }

  const totalImageCount = categories.reduce((total, category) => total + (category.image_count ?? 0), 0)

  return (
    <section className={styles.gallerySection}>
      <div className={styles.galleryHeading}><div><span>Shared assets</span><h2>Fluxiva Gallery</h2><p>Organize reusable food photography into bilingual folders.</p></div><div className={styles.galleryHeadingActions}><button className={styles.action} disabled={!totalImageCount} onClick={() => setClearGalleryOpen(true)}><Trash2 /> Clear gallery</button><button className={styles.action} onClick={() => openFolderForm()}><FolderPlus /> New folder</button><button className={`${styles.action} ${styles.actionPrimary}`} disabled={!categories.some((category) => category.active)} onClick={() => openNewImage()}><Plus /> Add image</button></div></div>
      {error && <p className={styles.galleryError}>{error}</p>}{success && <p className={styles.gallerySuccess}>{success}</p>}
      {loading ? <p className={styles.empty}>Loading gallery…</p> : <>
        <div className={styles.folderSectionTitle}><Folder /><div><h3>Folders</h3><p>Owners browse these folders before choosing a photo.</p></div></div>
        {categories.length ? <div className={styles.folderCards}>{categories.map((category, index) => <article className={`${styles.folderCard} ${category.active ? '' : styles.galleryArchived}`} key={category.id}><button type="button" className={styles.folderOpenButton} onClick={() => void openFolderContents(category)} aria-label={`Open ${category.name_en} folder`}><span className={styles.folderIcon}><Folder /></span><span className={styles.folderDetails}><b>{category.name_en}</b><small dir="rtl">{category.name_ar}</small><span>{category.image_count ?? 0} image{category.image_count === 1 ? '' : 's'} · {category.active ? 'Active' : 'Archived'}</span></span><FolderOpen className={styles.folderOpenIcon} /></button><div className={styles.folderActions}><button disabled={index === 0} onClick={() => moveFolder(category, -1)} title="Move up"><ArrowUp /></button><button disabled={index === categories.length - 1} onClick={() => moveFolder(category, 1)} title="Move down"><ArrowDown /></button><button onClick={() => openFolderForm(category)} title="Edit folder"><Pencil /></button><button onClick={() => toggleFolder(category)} title={category.active ? 'Archive folder' : 'Restore folder'}>{category.active ? <Archive /> : <RotateCcw />}</button><button disabled={Boolean(category.image_count)} onClick={() => removeFolder(category)} title={category.image_count ? 'Empty the folder before deleting it' : 'Delete folder'}><Trash2 /></button></div></article>)}</div> : <div className={styles.galleryEmpty}><FolderPlus /><h3>No folders yet</h3><p>Create a folder such as Cold Mezza or Hot Mezza before uploading photos.</p></div>}
      </>}

      {selectedFolder && <div className="modal-backdrop"><section className={`modal-card modal-large ${styles.galleryFolderModal}`} role="dialog" aria-modal="true" aria-labelledby="gallery-folder-title"><button type="button" className="modal-close" onClick={closeFolderContents}><X /></button><div className={styles.galleryFolderHeader}><div><span className="eyebrow"><span /> Gallery folder</span><h2 id="gallery-folder-title">{selectedFolder.name_en}</h2><p dir="rtl">{selectedFolder.name_ar}</p></div><button type="button" className={`${styles.action} ${styles.actionPrimary}`} disabled={!selectedFolder.active} onClick={() => openNewImage(selectedFolder.id)}><Plus /> Add image</button></div>
        {folderLoading ? <p className={styles.empty}>Loading folder images…</p> : folderError ? <p className={styles.galleryError}>{folderError}</p> : folderImages.length ? <div className={`${styles.galleryCards} ${styles.galleryFolderCards}`}>{folderImages.map((image) => <article className={`${styles.galleryCard} ${image.active ? '' : styles.galleryArchived}`} key={image.id}>
          <button type="button" className={styles.galleryCardMedia} onClick={() => setPreviewImage(image)} aria-label={`View ${image.name_en} photo`}><img src={image.thumbnail_url} alt="" loading="lazy" /><span className={styles.galleryCardZoom}><Maximize2 /></span><span className={styles.galleryCardStatus}>{image.active ? 'Active' : 'Archived'}</span></button>
          <div className={styles.galleryCardBody}>
            <div className={styles.galleryCardTitle}><b>{image.name_en}</b><small dir="rtl">{image.name_ar}</small></div>
            <div className={styles.galleryCardMeta}><p><Folder /> <span>{image.category_en}</span><i>·</i><span dir="rtl">{image.category_ar}</span></p><small>{image.usage_count ? `Used by ${image.usage_count} menu item${image.usage_count === 1 ? '' : 's'}` : 'Not used by any menu item'}</small></div>
            <div className={styles.galleryCardActions}><button onClick={() => beginEdit(image)}><Pencil /> Edit</button><button onClick={() => toggleImage(image)}>{image.active ? <><Archive /> Archive</> : <><RotateCcw /> Restore</>}</button><button className={styles.galleryDelete} disabled={Boolean(image.usage_count)} title={image.usage_count ? 'Archive images that are currently in use' : 'Permanently delete'} onClick={() => removeImage(image)}><Trash2 /> Delete</button></div>
          </div>
        </article>)}</div> : <div className={styles.galleryEmpty}><ImagePlus /><h3>No images in this folder</h3><p>Add the first licensed food photo to {selectedFolder.name_en}.</p></div>}
      </section></div>}

      {folderFormOpen && <div className="modal-backdrop"><form className={`modal-card ${styles.galleryForm}`} onSubmit={saveFolder}><button type="button" className="modal-close" onClick={closeFolderForm}><X /></button><span className="eyebrow"><span /> Super admin only</span><h2>{editingFolder ? 'Edit gallery folder' : 'Create gallery folder'}</h2><p>Give the folder a name in both owner languages.</p><label>English folder name<input required autoFocus value={folderDraft.name_en} onChange={(event) => setFolderDraft({ ...folderDraft, name_en: event.target.value })} placeholder="Cold Mezza" /></label><label dir="rtl">Arabic folder name<input required dir="rtl" value={folderDraft.name_ar} onChange={(event) => setFolderDraft({ ...folderDraft, name_ar: event.target.value })} placeholder="مقبلات باردة" /></label><button className="button button-primary full" disabled={saving}>{saving ? 'Saving…' : editingFolder ? 'Save folder' : 'Create folder'}</button></form></div>}

      {imageFormOpen && <div className="modal-backdrop"><form className={`modal-card modal-large ${styles.galleryForm}`} onSubmit={saveImage}><button type="button" className="modal-close" onClick={closeImageForm}><X /></button><span className="eyebrow"><span /> Super admin only</span><h2>{editing ? 'Edit gallery image' : 'Add gallery image'}</h2><p>Choose the folder first, then add paired names and searchable tags.</p><div className="form-grid">
        {!editing && <label className={`image-upload ${styles.galleryFile}`}>Food photo <small>Upload a clear food photo, then frame it in a 4:5 portrait.</small><span><ImagePlus /> {draft.file?.name ?? 'Choose JPG, PNG or WebP'}</span><input required={!draft.file} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.currentTarget.files?.[0] ?? null; event.currentTarget.value = ''; void chooseImage(file) }} />{fileCheck.state !== 'idle' && <small className={fileCheck.state === 'valid' ? styles.fileValid : fileCheck.state === 'invalid' ? styles.fileInvalid : styles.fileChecking} role="status">{fileCheck.message}</small>}</label>}
        <label className={styles.galleryFile}>Folder<select required disabled={Boolean(editing)} value={draft.category_id} onChange={(event) => setDraft({ ...draft, category_id: event.target.value })}><option value="">Choose a folder</option>{categories.map((category) => <option key={category.id} value={category.id} disabled={!category.active && category.id !== draft.category_id}>{category.name_en} · {category.name_ar}</option>)}</select>{editing && <small>To keep Storage organized, an existing image stays in its original folder.</small>}</label>
        <label>English name<input required value={draft.name_en} onChange={(event) => setDraft({ ...draft, name_en: event.target.value })} /></label><label dir="rtl">Arabic name<input required dir="rtl" value={draft.name_ar} onChange={(event) => setDraft({ ...draft, name_ar: event.target.value })} /></label><label>English tags <small>Comma separated</small><input value={draft.tags_en} onChange={(event) => setDraft({ ...draft, tags_en: event.target.value })} /></label><label dir="rtl">Arabic tags <small>افصل بفاصلة</small><input dir="rtl" value={draft.tags_ar} onChange={(event) => setDraft({ ...draft, tags_ar: event.target.value })} /></label><label>Source / owner<input value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} /></label><label>License notes<input value={draft.license_notes} onChange={(event) => setDraft({ ...draft, license_notes: event.target.value })} /></label>
      </div><button className="button button-primary full" disabled={saving || (!editing && fileCheck.state !== 'valid')}>{saving ? 'Saving…' : editing ? 'Save details' : 'Upload to folder'}</button></form></div>}
      {clearGalleryOpen && <div className="modal-backdrop"><div className={`modal-card ${styles.galleryForm}`} role="dialog" aria-modal="true" aria-labelledby="clear-gallery-title"><button type="button" className="modal-close" disabled={saving} onClick={() => setClearGalleryOpen(false)}><X /></button><span className="eyebrow"><span /> Permanent action</span><h2 id="clear-gallery-title">Clear all gallery images?</h2><p>This permanently removes {totalImageCount} gallery image{totalImageCount === 1 ? '' : 's'}, including their thumbnails, and clears them from every menu item. Your bilingual gallery folders will stay ready for the replacement photos.</p><div className={styles.clearGalleryActions}><button type="button" className="button button-outline" disabled={saving} onClick={() => setClearGalleryOpen(false)}>Cancel</button><button type="button" className={`button ${styles.clearGalleryButton}`} disabled={saving} onClick={() => void clearGallery()}><Trash2 /> {saving ? 'Removing…' : 'Remove all images'}</button></div></div></div>}
      {pendingCrop && <PortraitImageCropper file={pendingCrop} onCancel={() => { setPendingCrop(null); setFileCheck(draft.file ? { state: 'valid', message: `${ITEM_IMAGE_WIDTH} × ${ITEM_IMAGE_HEIGHT} px · Cropped and ready to upload` } : { state: 'idle', message: '' }) }} onConfirm={(file) => void acceptCrop(file)} />}
      {previewImage && <ImageLightbox url={previewImage.image_url} name={previewImage.name_en} closeLabel="Close image preview" onClose={() => setPreviewImage(null)} />}
    </section>
  )
}
