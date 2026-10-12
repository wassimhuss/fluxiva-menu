import { Archive, ArrowDown, ArrowUp, Folder, FolderOpen, FolderPlus, ImagePlus, Maximize2, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { clearGalleryImages, createGalleryCategory, createGalleryImage, deleteGalleryCategory, deleteGalleryImage, discardGalleryAssets, ITEM_IMAGE_HEIGHT, ITEM_IMAGE_WIDTH, listPlatformGalleryCategories, listPlatformGalleryImages, updateGalleryCategory, updateGalleryImage, uploadGalleryAssets, validateGalleryImage, validateGallerySource } from '../lib/api'
import { galleryText } from '../lib/galleryI18n'
import type { GalleryCategory, GalleryImage, Language } from '../lib/types'
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

export function PlatformGallery({ language = 'en' }: { language?: Language }) {
  const t = useCallback((text: string) => galleryText(language, text), [language])
  const name = (entry: { name_en: string; name_ar: string }) => language === 'ar' ? entry.name_ar : entry.name_en
  const count = (value: number) => value.toLocaleString(language === 'ar' ? 'ar-LB' : 'en-US')
  const cropReady = `${ITEM_IMAGE_WIDTH} × ${ITEM_IMAGE_HEIGHT} px · ${t('Cropped and ready to upload')}`
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
  useEffect(() => { refreshCategories().catch((caught) => setError(caught instanceof Error ? caught.message : t("Could not load the gallery"))).finally(() => setLoading(false)) }, [t])

  async function openFolderContents(category: GalleryCategory) {
    setSelectedFolder(category); setFolderImages([]); setFolderError(''); setFolderLoading(true)
    try { await refreshFolderImages(category.id) }
    catch (caught) { setFolderError(caught instanceof Error ? caught.message : t("Could not load this folder")) }
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
    setFileCheck({ state: 'checking', message: t("Preparing cropper…") })
    try {
      await validateGallerySource(file)
      setPendingCrop(file)
      setFileCheck({ state: 'idle', message: '' })
    } catch (caught) {
      setFileCheck({ state: 'invalid', message: caught instanceof Error ? caught.message : t("This image could not be checked.") })
    }
  }

  async function acceptCrop(file: File) {
    try {
      await validateGalleryImage(file)
      setDraft((current) => ({ ...current, file }))
      setPendingCrop(null)
      setFileCheck({ state: 'valid', message: cropReady })
    } catch (caught) {
      setFileCheck({ state: 'invalid', message: caught instanceof Error ? caught.message : t("This crop could not be prepared.") })
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
        if (!draft.file) throw new Error(t("Choose an image to upload."))
        urls = await uploadGalleryAssets(draft.category_id, id, draft.file)
        await createGalleryImage(id, input, urls)
      }
      await refreshVisibleGallery(input.category_id); closeImageForm(); setSuccess(editing ? t("Gallery details updated.") : t("Image added to the selected folder."))
    } catch (caught) {
      if (!editing && urls) await discardGalleryAssets(id, urls)
      setError(caught instanceof Error ? caught.message : t("Could not save this gallery image"))
    } finally { setSaving(false) }
  }

  async function toggleImage(image: GalleryImage) {
    setError(''); setSuccess('')
    try {
      await updateGalleryImage(image.id, { category_id: image.category_id, name_en: image.name_en, name_ar: image.name_ar, tags_en: image.tags_en, tags_ar: image.tags_ar, source: image.source, license_notes: image.license_notes, active: !image.active })
      await refreshVisibleGallery(image.category_id); setSuccess(image.active ? t("Image archived. Existing menu items keep using it.") : t("Image is available to owners again."))
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("Could not update this image")) }
  }

  async function removeImage(image: GalleryImage) {
    if (!window.confirm(`${t('Permanently delete this unused image?')} ${name(image)}`)) return
    setError(''); setSuccess('')
    try { await deleteGalleryImage(image); await refreshVisibleGallery(image.category_id); setSuccess(t("Gallery image deleted.")) }
    catch (caught) { setError(caught instanceof Error ? caught.message : t("Could not delete this image")) }
  }

  async function clearGallery() {
    setSaving(true); setError(''); setSuccess('')
    try {
      const allImages = await listPlatformGalleryImages()
      const deletedCount = await clearGalleryImages(allImages)
      await refreshCategories(); closeFolderContents(); setClearGalleryOpen(false)
      setSuccess(`${count(deletedCount)} · ${t('Images removed. Menu items that used them no longer have an image.')}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("Could not clear the gallery"))
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
      await refreshCategories(); closeFolderForm(); setSuccess(editingFolder ? t("Folder updated.") : t("Gallery folder created."))
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("Could not save this folder")) }
    finally { setSaving(false) }
  }

  async function toggleFolder(category: GalleryCategory) {
    setError(''); setSuccess('')
    try {
      await updateGalleryCategory(category.id, { name_en: category.name_en, name_ar: category.name_ar, active: !category.active, sort_order: category.sort_order })
      await refreshCategories(); setSuccess(category.active ? t("Folder archived. Existing image links remain safe.") : t("Folder restored for owners."))
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("Could not update this folder")) }
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
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("Could not reorder folders")) }
  }

  async function removeFolder(category: GalleryCategory) {
    if (!window.confirm(`${t('Permanently delete this empty folder?')} ${name(category)}`)) return
    setError(''); setSuccess('')
    try { await deleteGalleryCategory(category); await refreshCategories(); setSuccess(t("Gallery folder deleted.")) }
    catch (caught) { setError(caught instanceof Error ? caught.message : t("Could not delete this folder")) }
  }

  const totalImageCount = categories.reduce((total, category) => total + (category.image_count ?? 0), 0)

  return (
    <section className={styles.gallerySection}>
      <div className={styles.galleryHeading}><div><span>{t("Shared assets")}</span><h2>{t("Fluxiva Gallery")}</h2><p>{t("Organize reusable food photography into bilingual folders.")}</p></div><div className={styles.galleryHeadingActions}><button className={styles.action} disabled={!totalImageCount} onClick={() => setClearGalleryOpen(true)}><Trash2 /> {t("Clear gallery")}</button><button className={styles.action} onClick={() => openFolderForm()}><FolderPlus /> {t("New folder")}</button><button className={`${styles.action} ${styles.actionPrimary}`} disabled={!categories.some((category) => category.active)} onClick={() => openNewImage()}><Plus /> {t("Add image")}</button></div></div>
      {error && <p className={styles.galleryError}>{error}</p>}{success && <p className={styles.gallerySuccess}>{success}</p>}
      {loading ? <p className={styles.empty}>{t("Loading gallery…")}</p> : <>
        <div className={styles.folderSectionTitle}><Folder /><div><h3>{t("Folders")}</h3><p>{t("Owners browse these folders before choosing a photo.")}</p></div></div>
        {categories.length ? <div className={styles.folderCards}>{categories.map((category, index) => <article className={`${styles.folderCard} ${category.active ? '' : styles.galleryArchived}`} key={category.id}><button type="button" className={styles.folderOpenButton} onClick={() => void openFolderContents(category)} aria-label={`${t('Open folder')}: ${name(category)}`}><span className={styles.folderIcon}><Folder /></span><span className={styles.folderDetails}><b>{name(category)}</b><small dir={language === 'ar' ? 'ltr' : 'rtl'}>{language === 'ar' ? category.name_en : category.name_ar}</small><span>{count(category.image_count ?? 0)} {t('images')} · {category.active ? t("Active") : t("Archived")}</span></span><FolderOpen className={styles.folderOpenIcon} /></button><div className={styles.folderActions}><button disabled={index === 0} onClick={() => moveFolder(category, -1)} title={t("Move up")}><ArrowUp /></button><button disabled={index === categories.length - 1} onClick={() => moveFolder(category, 1)} title={t("Move down")}><ArrowDown /></button><button onClick={() => openFolderForm(category)} title={t("Edit folder")}><Pencil /></button><button onClick={() => toggleFolder(category)} title={category.active ? t("Archive folder") : t("Restore folder")}>{category.active ? <Archive /> : <RotateCcw />}</button><button disabled={Boolean(category.image_count)} onClick={() => removeFolder(category)} title={category.image_count ? t("Empty the folder before deleting it") : t("Delete folder")}><Trash2 /></button></div></article>)}</div> : <div className={styles.galleryEmpty}><FolderPlus /><h3>{t("No folders yet")}</h3><p>{t("Create a folder such as Cold Mezza or Hot Mezza before uploading photos.")}</p></div>}
      </>}

      {selectedFolder && <div className="modal-backdrop"><section className={`modal-card modal-large ${styles.galleryFolderModal}`} role="dialog" aria-modal="true" aria-labelledby="gallery-folder-title"><button type="button" aria-label={t('Close')} className="modal-close" onClick={closeFolderContents}><X /></button><div className={styles.galleryFolderHeader}><div><span className="eyebrow"><span /> {t("Gallery folder")}</span><h2 id="gallery-folder-title">{selectedFolder.name_en}</h2><p dir="rtl">{selectedFolder.name_ar}</p></div><button type="button" className={`${styles.action} ${styles.actionPrimary}`} disabled={!selectedFolder.active} onClick={() => openNewImage(selectedFolder.id)}><Plus /> {t("Add image")}</button></div>
        {folderLoading ? <p className={styles.empty}>{t("Loading folder images…")}</p> : folderError ? <p className={styles.galleryError}>{folderError}</p> : folderImages.length ? <div className={`${styles.galleryCards} ${styles.galleryFolderCards}`}>{folderImages.map((image) => <article className={`${styles.galleryCard} ${image.active ? '' : styles.galleryArchived}`} key={image.id}>
          <button type="button" className={styles.galleryCardMedia} onClick={() => setPreviewImage(image)} aria-label={`${t('View photo')}: ${name(image)}`}><img src={image.thumbnail_url} alt="" loading="lazy" /><span className={styles.galleryCardZoom}><Maximize2 /></span><span className={styles.galleryCardStatus}>{image.active ? t("Active") : t("Archived")}</span></button>
          <div className={styles.galleryCardBody}>
            <div className={styles.galleryCardTitle}><b>{name(image)}</b><small dir={language === 'ar' ? 'ltr' : 'rtl'}>{language === 'ar' ? image.name_en : image.name_ar}</small></div>
            <div className={styles.galleryCardMeta}><p><Folder /> <span>{image.category_en}</span><i>·</i><span dir="rtl">{image.category_ar}</span></p><small>{image.usage_count ? `${t('Used by')} ${count(image.usage_count)} ${t('menu items')}` : t("Not used by any menu item")}</small></div>
            <div className={styles.galleryCardActions}><button onClick={() => beginEdit(image)}><Pencil /> {t("Edit")}</button><button onClick={() => toggleImage(image)}>{image.active ? <><Archive /> {t("Archive")}</> : <><RotateCcw /> {t("Restore")}</>}</button><button className={styles.galleryDelete} disabled={Boolean(image.usage_count)} title={image.usage_count ? t("Archive images that are currently in use") : t("Permanently delete")} onClick={() => removeImage(image)}><Trash2 /> {t("Delete")}</button></div>
          </div>
        </article>)}</div> : <div className={styles.galleryEmpty}><ImagePlus /><h3>{t("No images in this folder")}</h3><p>{t('Add the first licensed food photo to')} {name(selectedFolder)}.</p></div>}
      </section></div>}

      {folderFormOpen && <div className="modal-backdrop"><form className={`modal-card ${styles.galleryForm}`} onSubmit={saveFolder}><button type="button" aria-label={t('Close')} className="modal-close" onClick={closeFolderForm}><X /></button><span className="eyebrow"><span /> {t("Super admin only")}</span><h2>{editingFolder ? t("Edit gallery folder") : t("Create gallery folder")}</h2><p>{t("Give the folder a name in both owner languages.")}</p><label>{t("English folder name")}<input required autoFocus value={folderDraft.name_en} onChange={(event) => setFolderDraft({ ...folderDraft, name_en: event.target.value })} placeholder="Cold Mezza" /></label><label dir="rtl">{t("Arabic folder name")}<input required dir="rtl" value={folderDraft.name_ar} onChange={(event) => setFolderDraft({ ...folderDraft, name_ar: event.target.value })} placeholder="مقبلات باردة" /></label><button className="button button-primary full" disabled={saving}>{saving ? t("Saving…") : editingFolder ? t("Save folder") : t("Create folder")}</button></form></div>}

      {imageFormOpen && <div className="modal-backdrop"><form className={`modal-card modal-large ${styles.galleryForm}`} onSubmit={saveImage}><button type="button" aria-label={t('Close')} className="modal-close" onClick={closeImageForm}><X /></button><span className="eyebrow"><span /> {t("Super admin only")}</span><h2>{editing ? t("Edit gallery image") : t("Add gallery image")}</h2><p>{t("Choose the folder first, then add paired names and searchable tags.")}</p><div className="form-grid">
        {!editing && <label className={`image-upload ${styles.galleryFile}`}>{t("Food photo")}<small>{t("Upload a clear food photo, then frame it in a 4:5 portrait.")}</small><span><ImagePlus /> {draft.file?.name ?? t("Choose JPG, PNG or WebP")}</span><input required={!draft.file} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.currentTarget.files?.[0] ?? null; event.currentTarget.value = ''; void chooseImage(file) }} />{fileCheck.state !== 'idle' && <small className={fileCheck.state === 'valid' ? styles.fileValid : fileCheck.state === 'invalid' ? styles.fileInvalid : styles.fileChecking} role="status">{fileCheck.message}</small>}</label>}
        <label className={styles.galleryFile}>{t("Folder")}<select required disabled={Boolean(editing)} value={draft.category_id} onChange={(event) => setDraft({ ...draft, category_id: event.target.value })}><option value="">{t("Choose a folder")}</option>{categories.map((category) => <option key={category.id} value={category.id} disabled={!category.active && category.id !== draft.category_id}>{category.name_en} · {category.name_ar}</option>)}</select>{editing && <small>{t("To keep Storage organized, an existing image stays in its original folder.")}</small>}</label>
        <label>{t("English name")}<input required value={draft.name_en} onChange={(event) => setDraft({ ...draft, name_en: event.target.value })} /></label><label dir="rtl">{t("Arabic name")}<input required dir="rtl" value={draft.name_ar} onChange={(event) => setDraft({ ...draft, name_ar: event.target.value })} /></label><label>{t("English tags")}<small>{t("Comma separated")}</small><input value={draft.tags_en} onChange={(event) => setDraft({ ...draft, tags_en: event.target.value })} /></label><label dir="rtl">{t("Arabic tags")}<small>{t('Comma separated')}</small><input dir="rtl" value={draft.tags_ar} onChange={(event) => setDraft({ ...draft, tags_ar: event.target.value })} /></label><label>{t("Source / owner")}<input value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} /></label><label>{t("License notes")}<input value={draft.license_notes} onChange={(event) => setDraft({ ...draft, license_notes: event.target.value })} /></label>
      </div><button className="button button-primary full" disabled={saving || (!editing && fileCheck.state !== 'valid')}>{saving ? t("Saving…") : editing ? t("Save details") : t("Upload to folder")}</button></form></div>}
      {clearGalleryOpen && <div className="modal-backdrop"><div className={`modal-card ${styles.galleryForm}`} role="dialog" aria-modal="true" aria-labelledby="clear-gallery-title"><button type="button" aria-label={t('Close')} className="modal-close" disabled={saving} onClick={() => setClearGalleryOpen(false)}><X /></button><span className="eyebrow"><span /> {t("Permanent action")}</span><h2 id="clear-gallery-title">{t("Clear all gallery images?")}</h2><p>{t("This permanently removes")}{' '}{count(totalImageCount)} {t('images')}{t(", including their thumbnails, and clears them from every menu item. Your bilingual gallery folders will stay ready for the replacement photos.")}</p><div className={styles.clearGalleryActions}><button type="button" className="button button-outline" disabled={saving} onClick={() => setClearGalleryOpen(false)}>{t("Cancel")}</button><button type="button" className={`button ${styles.clearGalleryButton}`} disabled={saving} onClick={() => void clearGallery()}><Trash2 /> {saving ? t("Removing…") : t("Remove all images")}</button></div></div></div>}
      {pendingCrop && <PortraitImageCropper language={language} file={pendingCrop} onCancel={() => { setPendingCrop(null); setFileCheck(draft.file ? { state: 'valid', message: cropReady } : { state: 'idle', message: '' }) }} onConfirm={(file) => void acceptCrop(file)} />}
      {previewImage && <ImageLightbox url={previewImage.image_url} name={name(previewImage)} closeLabel={t("Close image preview")} onClose={() => setPreviewImage(null)} />}
    </section>
  )
}
