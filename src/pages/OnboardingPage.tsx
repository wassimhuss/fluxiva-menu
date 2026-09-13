import { ArrowRight, Check } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { Notice } from '../components/Status'
import { createRestaurant } from '../lib/api'
import { useAuth } from '../lib/auth'
import { slugify } from '../lib/format'

export function OnboardingPage() {
  const { session, demoMode } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name_en: '', name_ar: '', slug: '', primary_color: '#b84d2f', phone: '', address_en: '', address_ar: '', default_language: 'en' as 'en' | 'ar' })

  if (demoMode) return <Navigate to="/dashboard" replace />
  if (!session) return null

  function update(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value, ...(key === 'name_en' && !current.slug ? { slug: slugify(value) } : {}) }))
  }

  async function finish() {
    if (!session) return
    setBusy(true); setError('')
    try { await createRestaurant(session, form); navigate('/dashboard') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not create restaurant') }
    finally { setBusy(false) }
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-header"><Brand /><span>Restaurant setup</span></header>
      <div className="onboarding-shell">
        <div className="progress"><i className={step >= 1 ? 'done' : ''} /><i className={step >= 2 ? 'done' : ''} /><i className={step >= 3 ? 'done' : ''} /></div>
        {error && <Notice tone="error">{error}</Notice>}
        {step === 1 && <section className="onboarding-card"><span className="step-label">Step 1 of 3</span><h1>Tell us about your restaurant.</h1><p>This information will appear at the top of your public menu.</p><div className="form-grid"><label>Restaurant name in English<input autoFocus required value={form.name_en} onChange={(e) => update('name_en', e.target.value)} placeholder="Cedar Oven" /></label><label dir="rtl">اسم المطعم بالعربية<input required value={form.name_ar} onChange={(e) => update('name_ar', e.target.value)} placeholder="فرن الأرز" /></label><label>Phone number<input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+961 70 123 456" /></label><label>Menu link<div className="slug-input"><span>/m/</span><input value={form.slug} onChange={(e) => update('slug', slugify(e.target.value))} placeholder="cedar-oven" /></div></label></div><button className="button button-primary" disabled={!form.name_en || !form.name_ar || !form.slug} onClick={() => setStep(2)}>Continue <ArrowRight /></button></section>}
        {step === 2 && <section className="onboarding-card"><span className="step-label">Step 2 of 3</span><h1>Make it feel like your brand.</h1><p>Choose the main color customers will see across your menu.</p><div className="color-picker"><input type="color" value={form.primary_color} onChange={(e) => update('primary_color', e.target.value)} /><div><b>Brand color</b><span>{form.primary_color.toUpperCase()}</span></div></div><label className="radio-label">Default menu language<div className="language-options"><button className={form.default_language === 'en' ? 'selected' : ''} onClick={() => update('default_language', 'en')}><Check /> English</button><button className={form.default_language === 'ar' ? 'selected' : ''} onClick={() => update('default_language', 'ar')}><Check /> العربية</button></div></label><div className="button-row"><button className="button button-ghost" onClick={() => setStep(1)}>Back</button><button className="button button-primary" onClick={() => setStep(3)}>Continue <ArrowRight /></button></div></section>}
        {step === 3 && <section className="onboarding-card"><span className="step-label">Step 3 of 3</span><h1>Where can customers find you?</h1><p>Add your address in both languages. You can change all these details later.</p><div className="form-grid"><label>Address in English<textarea value={form.address_en} onChange={(e) => update('address_en', e.target.value)} placeholder="Tripoli, Lebanon" /></label><label dir="rtl">العنوان بالعربية<textarea value={form.address_ar} onChange={(e) => update('address_ar', e.target.value)} placeholder="طرابلس، لبنان" /></label></div><div className="button-row"><button className="button button-ghost" onClick={() => setStep(2)}>Back</button><button className="button button-primary" disabled={busy} onClick={finish}>{busy ? 'Creating…' : 'Create my menu'} <ArrowRight /></button></div></section>}
      </div>
    </main>
  )
}
