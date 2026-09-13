import { ChevronRight, ExternalLink, Eye, EyeOff, LayoutDashboard, LogOut, Menu, Plus, QrCode, Settings, Store, Trash2, X } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { Loading, Notice } from '../components/Status'
import { cleanVariants, createCategory, createItem, deleteCategory, deleteItem, getOwnerMenu, updateItem, updateRestaurant, uploadRestaurantAsset } from '../lib/api'
import { useAuth } from '../lib/auth'
import { demoMenu } from '../lib/demo'
import { formatLbp } from '../lib/format'
import type { Category, MenuItem, RestaurantMenu, Variant } from '../lib/types'

type Panel = 'overview' | 'menu' | 'settings'
type ItemDraft = { category_id: string; name_en: string; name_ar: string; description_en: string; description_ar: string; price_lbp: string; variants: Variant[] }
const emptyItem = (categoryId = ''): ItemDraft => ({ category_id: categoryId, name_en: '', name_ar: '', description_en: '', description_ar: '', price_lbp: '', variants: [] })

export function DashboardPage() {
  const { session, demoMode, signOut } = useAuth()
  const navigate = useNavigate()
  const [menu, setMenu] = useState<RestaurantMenu | null>(null)
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState<Panel>('overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [error, setError] = useState('')
  const [categoryModal, setCategoryModal] = useState(false)
  const [itemModal, setItemModal] = useState(false)
  const [qrModal, setQrModal] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState({ name_en: '', name_ar: '' })
  const [itemDraft, setItemDraft] = useState<ItemDraft>(emptyItem())
  const [qrData, setQrData] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (demoMode) { setMenu(structuredClone(demoMenu)); setLoading(false); return }
    if (!session) return
    getOwnerMenu(session).then((data) => data ? setMenu(data) : navigate('/onboarding')).catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load restaurant')).finally(() => setLoading(false))
  }, [session, demoMode, navigate])

  const menuUrl = useMemo(() => menu ? `${import.meta.env.VITE_APP_URL || window.location.origin}/m/${menu.restaurant.slug}` : '', [menu])

  async function openQr() {
    setQrModal(true)
    setQrData(await QRCode.toDataURL(menuUrl, { width: 800, margin: 2, color: { dark: '#173f35', light: '#ffffff' } }))
  }

  function downloadQr() {
    const link = document.createElement('a'); link.href = qrData; link.download = `${menu?.restaurant.slug}-menu-qr.png`; link.click()
  }

  async function addCategory(event: React.FormEvent) {
    event.preventDefault(); if (!menu) return
    setSaving(true); setError('')
    try {
      const category = await createCategory({ restaurant_id: menu.restaurant.id, ...categoryDraft, sort_order: menu.categories.length + 1 })
      setMenu({ ...menu, categories: [...menu.categories, category] }); setCategoryModal(false); setCategoryDraft({ name_en: '', name_ar: '' })
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not add category') }
    finally { setSaving(false) }
  }

  async function removeCategory(category: Category) {
    if (!menu || !window.confirm(`Delete ${category.name_en} and all items inside it?`)) return
    try { await deleteCategory(category.id); setMenu({ ...menu, categories: menu.categories.filter((entry) => entry.id !== category.id), items: menu.items.filter((item) => item.category_id !== category.id) }) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not delete category') }
  }

  async function addItem(event: React.FormEvent) {
    event.preventDefault(); if (!menu) return
    setSaving(true); setError('')
    try {
      const item = await createItem({ restaurant_id: menu.restaurant.id, category_id: itemDraft.category_id, name_en: itemDraft.name_en, name_ar: itemDraft.name_ar, description_en: itemDraft.description_en, description_ar: itemDraft.description_ar, price_lbp: Number(itemDraft.price_lbp) || 0, variants: cleanVariants(itemDraft.variants), available: true, sort_order: menu.items.filter((entry) => entry.category_id === itemDraft.category_id).length + 1 })
      setMenu({ ...menu, items: [...menu.items, item] }); setItemModal(false); setItemDraft(emptyItem(menu.categories[0]?.id))
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not add item') }
    finally { setSaving(false) }
  }

  async function toggleAvailability(item: MenuItem) {
    if (!menu) return
    const available = !item.available
    setMenu({ ...menu, items: menu.items.map((entry) => entry.id === item.id ? { ...entry, available } : entry) })
    try { await updateItem(item.id, { available }) } catch { setMenu(menu) }
  }

  async function saveRestaurant(event: React.FormEvent) {
    event.preventDefault(); if (!menu) return
    setSaving(true); setError('')
    try {
      const { name_en, name_ar, description_en, description_ar, primary_color, phone, instagram, address_en, address_ar, default_language } = menu.restaurant
      await updateRestaurant(menu.restaurant.id, { name_en, name_ar, description_en, description_ar, primary_color, phone, instagram, address_en, address_ar, default_language })
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save restaurant') }
    finally { setSaving(false) }
  }

  async function uploadLogo(file: File) {
    if (!menu) return
    setSaving(true); setError('')
    try {
      const logo_url = await uploadRestaurantAsset(menu.restaurant.id, file)
      await updateRestaurant(menu.restaurant.id, { logo_url })
      setMenu({ ...menu, restaurant: { ...menu.restaurant, logo_url } })
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not upload logo') }
    finally { setSaving(false) }
  }

  function restaurantField(key: keyof RestaurantMenu['restaurant'], value: string) {
    if (!menu) return
    setMenu({ ...menu, restaurant: { ...menu.restaurant, [key]: value } })
  }

  async function removeItem(item: MenuItem) {
    if (!menu || !window.confirm(`Delete ${item.name_en}?`)) return
    try { await deleteItem(item.id); setMenu({ ...menu, items: menu.items.filter((entry) => entry.id !== item.id) }) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not delete item') }
  }

  function openItem(categoryId = menu?.categories[0]?.id ?? '') { setItemDraft(emptyItem(categoryId)); setItemModal(true) }
  function addVariant() { setItemDraft((current) => ({ ...current, variants: [...current.variants, { id: crypto.randomUUID(), name_en: '', name_ar: '', price_lbp: 0 }] })) }
  function updateVariant(index: number, key: keyof Variant, value: string | number) { setItemDraft((current) => ({ ...current, variants: current.variants.map((variant, position) => position === index ? { ...variant, [key]: value } : variant) })) }

  if (loading || !menu) return <main className="dashboard-loading"><Loading label="Loading your restaurant…" />{error && <Notice tone="error">{error}</Notice>}</main>
  const trialDays = menu.restaurant.trial_ends_at ? Math.max(0, Math.ceil((new Date(menu.restaurant.trial_ends_at).getTime() - Date.now()) / 86400000)) : 14

  return (
    <main className="dashboard-layout">
      <aside className={`dashboard-sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="sidebar-top"><Brand light /><button className="mobile-close" onClick={() => setMobileNav(false)}><X /></button></div>
        <div className="restaurant-switcher"><span className="mini-monogram" style={{ backgroundColor: menu.restaurant.primary_color }}>{menu.restaurant.name_en.slice(0, 2).toUpperCase()}</span><span><b>{menu.restaurant.name_en}</b><small>Owner workspace</small></span><ChevronRight /></div>
        <nav>
          <button className={panel === 'overview' ? 'selected' : ''} onClick={() => { setPanel('overview'); setMobileNav(false) }}><LayoutDashboard /> Overview</button>
          <button className={panel === 'menu' ? 'selected' : ''} onClick={() => { setPanel('menu'); setMobileNav(false) }}><Menu /> Menu editor</button>
          <button className={panel === 'settings' ? 'selected' : ''} onClick={() => { setPanel('settings'); setMobileNav(false) }}><Settings /> Restaurant settings</button>
        </nav>
        <div className="sidebar-bottom"><Link to={`/m/${menu.restaurant.slug}`} target="_blank"><ExternalLink /> Open public menu</Link><button onClick={async () => { await signOut(); navigate('/') }}><LogOut /> Sign out</button>{demoMode && <Link className="platform-link" to="/platform">Fluxiva control</Link>}</div>
      </aside>
      {mobileNav && <button className="sidebar-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}

      <section className="dashboard-main">
        <header className="dashboard-header"><button className="mobile-menu" onClick={() => setMobileNav(true)}><Menu /></button><div><span>Restaurant dashboard</span><b>{menu.restaurant.name_en}</b></div><div className="header-actions"><Link className="button button-small button-outline" to={`/m/${menu.restaurant.slug}`} target="_blank">View menu <ExternalLink /></Link><button className="button button-small button-primary" onClick={openQr}><QrCode /> QR code</button></div></header>
        <div className="dashboard-content">
          {error && <Notice tone="error">{error}</Notice>}
          {demoMode && <Notice>This preview uses sample data. Connect Supabase to save changes and create owner accounts.</Notice>}

          {panel === 'overview' && <>
            <div className="page-heading"><div><span className="eyebrow"><span /> Good to see you</span><h1>Your menu at a glance.</h1></div><button className="button button-primary" onClick={() => { setPanel('menu'); openItem() }}><Plus /> Add menu item</button></div>
            <div className="overview-grid">
              <article className="stat-card"><span>Menu items</span><strong>{menu.items.length}</strong><small>{menu.items.filter((item) => item.available).length} currently visible</small></article>
              <article className="stat-card"><span>Categories</span><strong>{menu.categories.length}</strong><small>Organize your menu</small></article>
              <article className="stat-card accent"><span>{menu.restaurant.subscription_status === 'trial' ? 'Free trial' : 'Subscription'}</span><strong>{menu.restaurant.subscription_status === 'trial' ? `${trialDays} days` : menu.restaurant.subscription_status}</strong><small>{menu.restaurant.subscription_status === 'trial' ? 'remaining in your trial' : 'Restaurant access'}</small></article>
            </div>
            <div className="overview-columns">
              <article className="dashboard-card"><div className="card-heading"><div><h2>Quick actions</h2><p>The most common menu tasks.</p></div></div><div className="quick-actions"><button onClick={() => { setPanel('menu'); openItem() }}><span><Plus /></span><div><b>Add an item</b><small>Name, price and size options</small></div><ChevronRight /></button><button onClick={() => { setPanel('menu'); setCategoryModal(true) }}><span><Menu /></span><div><b>Add a category</b><small>Group your menu items</small></div><ChevronRight /></button><button onClick={openQr}><span><QrCode /></span><div><b>Download QR code</b><small>Ready to print and share</small></div><ChevronRight /></button></div></article>
              <article className="dashboard-card qr-preview"><div className="card-heading"><div><h2>Your menu link</h2><p>Share this link anywhere.</p></div></div><div className="link-preview"><span>{menuUrl.replace(/^https?:\/\//, '')}</span><Link to={`/m/${menu.restaurant.slug}`} target="_blank"><ExternalLink /></Link></div><div className="phone-mini"><div className="phone-mini-cover" style={{ backgroundColor: menu.restaurant.primary_color }}><span>{menu.restaurant.name_en.slice(0, 2).toUpperCase()}</span><b>{menu.restaurant.name_en}</b></div><div><i /><i /><i /></div></div></article>
            </div>
          </>}

          {panel === 'menu' && <>
            <div className="page-heading"><div><span className="eyebrow"><span /> Menu editor</span><h1>Categories and items.</h1><p>Changes appear on your public menu immediately.</p></div><div className="button-row"><button className="button button-outline" onClick={() => setCategoryModal(true)}><Plus /> Category</button><button className="button button-primary" onClick={() => openItem()}><Plus /> Item</button></div></div>
            {!menu.categories.length ? <div className="empty-card"><Store /><h2>Create your first category</h2><p>Start with Pizza, Drinks, Desserts or any section that fits your menu.</p><button className="button button-primary" onClick={() => setCategoryModal(true)}><Plus /> Add category</button></div> : <div className="category-list">{menu.categories.map((category) => <section className="dashboard-card category-card" key={category.id}><div className="category-heading"><div><h2>{category.name_en}<small>{category.name_ar}</small></h2><span>{menu.items.filter((item) => item.category_id === category.id).length} items</span></div><div><button className="icon-button danger" onClick={() => removeCategory(category)} title="Delete category"><Trash2 /></button><button className="button button-small button-outline" onClick={() => openItem(category.id)}><Plus /> Add item</button></div></div><div className="dashboard-items">{menu.items.filter((item) => item.category_id === category.id).map((item) => <article key={item.id} className={!item.available ? 'unavailable' : ''}><div className="item-icon">{item.image_url ? <img src={item.image_url} alt="" /> : item.name_en.slice(0, 1)}</div><div className="dashboard-item-info"><b>{item.name_en}<small>{item.name_ar}</small></b><span>{item.variants.length ? `${item.variants.length} sizes · from ${formatLbp(Math.min(...item.variants.map((variant) => variant.price_lbp)))}` : formatLbp(item.price_lbp)}</span></div><button className="visibility" onClick={() => toggleAvailability(item)}>{item.available ? <><Eye /> Visible</> : <><EyeOff /> Hidden</>}</button><button className="icon-button danger" onClick={() => removeItem(item)}><Trash2 /></button></article>)}{!menu.items.some((item) => item.category_id === category.id) && <p className="empty-row">No items in this category yet.</p>}</div></section>)}</div>}
          </>}

          {panel === 'settings' && <>
            <div className="page-heading"><div><span className="eyebrow"><span /> Settings</span><h1>Restaurant details.</h1><p>Update the branding and contact details shown to customers.</p></div></div>
            <form className="dashboard-card restaurant-settings-form" onSubmit={saveRestaurant}>
              <div className="settings-brand">
                <label className="logo-uploader" style={{ backgroundColor: menu.restaurant.primary_color }}>
                  {menu.restaurant.logo_url ? <img src={menu.restaurant.logo_url} alt="Restaurant logo" /> : menu.restaurant.name_en.slice(0, 2).toUpperCase()}
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                </label>
                <div><h2>{menu.restaurant.name_en}</h2><p>{menu.restaurant.name_ar}</p><code>/m/{menu.restaurant.slug}</code><small>Tap the logo to upload a new image.</small></div>
              </div>
              <div className="form-grid">
                <label>English name<input required value={menu.restaurant.name_en} onChange={(e) => restaurantField('name_en', e.target.value)} /></label>
                <label dir="rtl">الاسم بالعربية<input required value={menu.restaurant.name_ar} onChange={(e) => restaurantField('name_ar', e.target.value)} /></label>
                <label>English tagline<input value={menu.restaurant.description_en ?? ''} onChange={(e) => restaurantField('description_en', e.target.value)} placeholder="Fresh from our oven" /></label>
                <label dir="rtl">الوصف بالعربية<input value={menu.restaurant.description_ar ?? ''} onChange={(e) => restaurantField('description_ar', e.target.value)} placeholder="طازج من فرننا" /></label>
                <label>Phone<input value={menu.restaurant.phone ?? ''} onChange={(e) => restaurantField('phone', e.target.value)} /></label>
                <label>Instagram<input value={menu.restaurant.instagram ?? ''} onChange={(e) => restaurantField('instagram', e.target.value)} placeholder="@restaurant" /></label>
                <label>English address<textarea value={menu.restaurant.address_en ?? ''} onChange={(e) => restaurantField('address_en', e.target.value)} /></label>
                <label dir="rtl">العنوان بالعربية<textarea value={menu.restaurant.address_ar ?? ''} onChange={(e) => restaurantField('address_ar', e.target.value)} /></label>
                <label>Brand color<input className="settings-color" type="color" value={menu.restaurant.primary_color} onChange={(e) => restaurantField('primary_color', e.target.value)} /></label>
                <label>Default language<select value={menu.restaurant.default_language} onChange={(e) => restaurantField('default_language', e.target.value)}><option value="en">English</option><option value="ar">العربية</option></select></label>
              </div>
              <button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save restaurant details'}</button>
            </form>
          </>}
        </div>
      </section>

      {categoryModal && <div className="modal-backdrop"><form className="modal-card" onSubmit={addCategory}><button type="button" className="modal-close" onClick={() => setCategoryModal(false)}><X /></button><span className="eyebrow"><span /> New section</span><h2>Add a category</h2><p>Give it a name in both menu languages.</p><label>English name<input required autoFocus value={categoryDraft.name_en} onChange={(e) => setCategoryDraft({ ...categoryDraft, name_en: e.target.value })} placeholder="Pizza" /></label><label dir="rtl">الاسم بالعربية<input required value={categoryDraft.name_ar} onChange={(e) => setCategoryDraft({ ...categoryDraft, name_ar: e.target.value })} placeholder="بيتزا" /></label><button className="button button-primary full" disabled={saving}>{saving ? 'Adding…' : 'Add category'}</button></form></div>}

      {itemModal && <div className="modal-backdrop"><form className="modal-card modal-large" onSubmit={addItem}><button type="button" className="modal-close" onClick={() => setItemModal(false)}><X /></button><span className="eyebrow"><span /> New item</span><h2>Add a menu item</h2><div className="form-grid"><label>Category<select required value={itemDraft.category_id} onChange={(e) => setItemDraft({ ...itemDraft, category_id: e.target.value })}><option value="">Choose category</option>{menu.categories.map((category) => <option value={category.id} key={category.id}>{category.name_en}</option>)}</select></label><span /><label>English name<input required value={itemDraft.name_en} onChange={(e) => setItemDraft({ ...itemDraft, name_en: e.target.value })} placeholder="Margherita" /></label><label dir="rtl">الاسم بالعربية<input required value={itemDraft.name_ar} onChange={(e) => setItemDraft({ ...itemDraft, name_ar: e.target.value })} placeholder="مارغريتا" /></label><label>English description<textarea value={itemDraft.description_en} onChange={(e) => setItemDraft({ ...itemDraft, description_en: e.target.value })} placeholder="Tomato, mozzarella and basil" /></label><label dir="rtl">الوصف بالعربية<textarea value={itemDraft.description_ar} onChange={(e) => setItemDraft({ ...itemDraft, description_ar: e.target.value })} placeholder="طماطم، موزاريلا وريحان" /></label></div><div className="price-section"><label>Base price (LBP)<input required={itemDraft.variants.length === 0} min="0" type="number" value={itemDraft.price_lbp} onChange={(e) => setItemDraft({ ...itemDraft, price_lbp: e.target.value })} placeholder="350000" /></label><div className="variant-title"><div><b>Size options</b><small>Optional — add sizes when prices differ.</small></div><button type="button" onClick={addVariant}><Plus /> Add size</button></div>{itemDraft.variants.map((variant, index) => <div className="variant-row" key={variant.id}><input required placeholder="S" value={variant.name_en} onChange={(e) => updateVariant(index, 'name_en', e.target.value)} /><input placeholder="ص" dir="rtl" value={variant.name_ar} onChange={(e) => updateVariant(index, 'name_ar', e.target.value)} /><input required min="1" type="number" placeholder="Price LBP" value={variant.price_lbp || ''} onChange={(e) => updateVariant(index, 'price_lbp', Number(e.target.value))} /><button type="button" onClick={() => setItemDraft((current) => ({ ...current, variants: current.variants.filter((_, position) => position !== index) }))}><X /></button></div>)}</div><button className="button button-primary full" disabled={saving || !menu.categories.length}>{saving ? 'Adding…' : 'Add menu item'}</button></form></div>}

      {qrModal && <div className="modal-backdrop"><div className="modal-card qr-modal"><button className="modal-close" onClick={() => setQrModal(false)}><X /></button><span className="eyebrow"><span /> Ready to scan</span><h2>Your menu QR code</h2><p>Print it on table cards, packaging or your storefront.</p>{qrData && <img src={qrData} alt="Restaurant menu QR code" />}<code>{menuUrl}</code><button className="button button-primary full" onClick={downloadQr}><QrCode /> Download PNG</button></div></div>}
    </main>
  )
}
