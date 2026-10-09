import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Languages,
  LayoutDashboard,
  MessageCircle,
  Palette,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { landingNumber, landingText, type LandingCopyKey } from '../lib/landingI18n'
import type { Language } from '../lib/types'

const features = [
  {
    icon: Languages,
    title: 'Arabic & English, together',
    copy: 'Serve every guest naturally with a menu that switches language in one tap.',
    className: 'lp-feature-language',
  },
  {
    icon: Palette,
    title: 'Made to feel like your brand',
    copy: 'Your logo, colors, cover photo and personality — never a generic template.',
    className: 'lp-feature-brand',
  },
  {
    icon: Zap,
    title: 'Update in seconds',
    copy: 'Change a price, hide a sold-out item or publish today’s special instantly.',
    className: 'lp-feature-speed',
  },
  {
    icon: BarChart3,
    title: 'A dashboard that stays simple',
    copy: 'Everything you need to manage your menu without the usual technical clutter.',
    className: 'lp-feature-dashboard',
  },
] as const

const benefits = [
  ['Unlimited edits', 'Change your menu whenever service demands it.'],
  ['Bilingual by design', 'Arabic and English live side by side.'],
  ['Personal setup help', 'We help you get the first version just right.'],
  ['Print-ready QR', 'Download once and use it everywhere.'],
] as const

function storedLanguage(): Language {
  try {
    return localStorage.getItem('fluxiva-landing-language') === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

export function LandingPage() {
  const [language, setLanguage] = useState<Language>(storedLanguage)
  const t = (english: LandingCopyKey) => landingText(language, english)
  const n = (value: number, options?: Intl.NumberFormatOptions) => landingNumber(language, value, options)

  useEffect(() => {
    try {
      localStorage.setItem('fluxiva-landing-language', language)
    } catch {
      // Language switching still works when browser storage is unavailable.
    }
  }, [language])

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('[data-reveal]')
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      }),
      { threshold: 0.14 },
    )

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  return (
    <main className="landing landing-v2" dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
      <div className="lp-nav-wrap">
        <nav className="lp-nav shell" aria-label={t('Main navigation')}>
          <Brand homeLabel={t('Fluxiva Menu home')} />
          <div className="lp-nav-links hide-tablet">
            <a href="#features">{t('Features')}</a>
            <a href="#how-it-works">{t('How it works')}</a>
            <a href="#pricing">{t('Pricing')}</a>
          </div>
          <div className="nav-actions">
            <button
              type="button"
              className="lp-language-switch"
              onClick={() => setLanguage((current) => current === 'en' ? 'ar' : 'en')}
              aria-label={language === 'en' ? t('Switch to Arabic') : t('Switch to English')}
            >
              <Languages aria-hidden="true" /> <span lang={language === 'en' ? 'ar' : 'en'}>{language === 'en' ? 'العربية' : 'English'}</span>
            </button>
            <Link className="text-link hide-mobile" to="/login">{t('Sign in')}</Link>
            <Link className="button button-small lp-nav-cta" to="/signup">
              {t('Start free')} <ArrowRight size={15} />
            </Link>
          </div>
        </nav>
      </div>

      <section className="lp-hero shell">
        <div className="lp-hero-glow lp-hero-glow-one" />
        <div className="lp-hero-glow lp-hero-glow-two" />
        <div className="lp-hero-copy">
          <div className="lp-kicker">
            <Sparkles size={14} />
            {t('Digital menus, beautifully simplified')}
          </div>
          <h1>
            {t('A menu that feels')}
            <span>{t('as good as your food.')}</span>
          </h1>
          <p className="lp-hero-lead">
            {t('Create a beautiful, bilingual QR menu your guests can open instantly — and your team can update in seconds.')}
          </p>
          <div className="lp-hero-actions">
            <Link className="button lp-primary-button" to="/signup">
              {t('Start your 14-day trial')} <ArrowRight size={18} />
            </Link>
            <Link className="button lp-secondary-button" to="/m/demo">
              <span className="lp-play-dot"><span /></span> {t('Explore live menu')}
            </Link>
          </div>
          <div className="lp-assurance">
            <span><CheckCircle2 /> {t('No card required')}</span>
            <span><CheckCircle2 /> {t('Setup included')}</span>
            <span><CheckCircle2 /> {t('Ready in minutes')}</span>
          </div>
          <div className="lp-hero-proof">
            <div className="lp-proof-avatars" aria-hidden="true">
              <span>{t('CO')}</span><span>{t('MO')}</span><span>{t('BA')}</span><span>+</span>
            </div>
            <p><strong>{t('Built for hospitality')}</strong><br />{t('Thoughtful on every screen, from kitchen to table.')}</p>
          </div>
        </div>

        <div className="lp-hero-stage" role="group" aria-label={t('Animated preview of a Fluxiva restaurant menu')}>
          <div className="lp-stage-ring lp-stage-ring-one" />
          <div className="lp-stage-ring lp-stage-ring-two" />
          <div className="lp-phone-wrap">
            <div className="lp-phone">
              <div className="lp-phone-top"><span /><i /></div>
              <div className="lp-phone-screen">
                <div className="lp-menu-cover">
                  <div className="lp-menu-logo">{t('CO')}</div>
                  <small>{t('CEDAR OVEN')}</small>
                  <strong>{t('Fresh from our oven')}</strong>
                  <span>{t('Beirut · Open now')}</span>
                </div>
                <div className="lp-menu-search">⌕&nbsp;&nbsp; {t('Search the menu')}</div>
                <div className="lp-menu-tabs"><b>{t('Popular')}</b><span>{t('Manakish')}</span><span>{t('Pizza')}</span></div>
                <div className="lp-menu-content">
                  <small>{t('POPULAR TODAY')}</small>
                  <div className="lp-demo-item">
                    <div><b>{t('Cheese Manoushe')}</b><span>{t('Akawi cheese, sesame')}</span><strong><bdi>{n(250000)} {t('LBP')}</bdi></strong></div>
                    <img src="/menu/manakish.jpg" alt={t('Cheese manoushe')} />
                  </div>
                  <div className="lp-demo-item">
                    <div><b>{t('Margherita')}</b><span>{t('Tomato, mozzarella, basil')}</span><strong><bdi>{n(420000)} {t('LBP')}</bdi></strong></div>
                    <img src="/menu/pizza.jpg" alt={t('Margherita pizza')} />
                  </div>
                </div>
              </div>
              <div className="lp-phone-home" />
            </div>
          </div>

          <div className="lp-float-card lp-language-card">
            <div><Languages size={17} /></div>
            <span><small>{t('One tap switch')}</small><b>{t('English / Arabic')}</b></span>
          </div>
          <div className="lp-float-card lp-status-card">
            <span className="lp-live-dot" />
            <span><small>{t('Menu status')}</small><b>{t('Live & ready to scan')}</b></span>
          </div>
          <div className="lp-qr-float">
            <QrCode />
            <span><b>{t('Scan to explore')}</b><small>{t('No app needed')}</small></span>
          </div>
        </div>
      </section>

      <section className="lp-trust-bar" aria-label={t('Product benefits')}>
        <div className="shell lp-trust-items">
          <div><Smartphone /><span><b>{t('Mobile first')}</b><small>{t('Beautiful on every phone')}</small></span></div>
          <div><Languages /><span><b>{t('Truly bilingual')}</b><small>{t('Arabic and English')}</small></span></div>
          <div><Palette /><span><b>{t('Always on brand')}</b><small>{t('Your identity, your menu')}</small></span></div>
          <div><QrCode /><span><b>{t('Scan & discover')}</b><small>{t('No download required')}</small></span></div>
        </div>
      </section>

      <section className="lp-story shell" id="features">
        <div className="lp-section-heading" data-reveal>
          <span className="lp-section-kicker">{t('Everything in one place')}</span>
          <h2>{t('Less menu admin.')}<br /><em>{t('More time for guests.')}</em></h2>
          <p>{t('Fluxiva keeps the experience polished for customers and refreshingly simple for your team.')}</p>
        </div>

        <div className="lp-dashboard-showcase" data-reveal>
          <div className="lp-dashboard-window" role="group" aria-label={t('Illustrative dashboard preview')}>
            <div className="lp-window-bar"><span /><span /><span /><b>{t('Menu overview')}</b></div>
            <aside className="lp-window-sidebar">
              <div className="lp-mini-brand"><UtensilsCrossed /> {t('CO')}</div>
              <span className="active"><LayoutDashboard /> {t('Overview')}</span>
              <span><UtensilsCrossed /> {t('Menu items')}</span>
              <span><Palette /> {t('Appearance')}</span>
              <span><QrCode /> {t('Your QR')}</span>
            </aside>
            <div className="lp-window-main">
              <div className="lp-window-title"><span><small>{t('GOOD AFTERNOON')}</small><b>{t('Your menu is looking great.')}</b></span><span className="lp-window-add">{t('+ Add item')}</span></div>
              <div className="lp-window-stats">
                <div><small>{t('Menu items')}</small><b>{n(28)}</b><span>{n(4)} {t('categories')}</span></div>
                <div><small>{t('Available now')}</small><b>{n(26)}</b><span className="positive">● {t('Live')}</span></div>
                <div><small>{t('Languages')}</small><b>{n(2)}</b><span>{t('EN + AR')}</span></div>
              </div>
              <div className="lp-window-list">
                <header><b>{t('Popular items')}</b><span>{t('View all')}</span></header>
                <div><img src="/menu/manakish.jpg" alt="" /><span><b>{t('Cheese Manoushe')}</b><small>{t('Manakish')} · {t('Available')}</small></span><strong><bdi>{n(250000)}</bdi></strong></div>
                <div><img src="/menu/pizza.jpg" alt="" /><span><b>{t('Margherita')}</b><small>{t('Pizza')} · {t('Available')}</small></span><strong><bdi>{n(420000)}</bdi></strong></div>
                <div><img src="/menu/croissants.jpg" alt="" /><span><b>{t('Almond Croissant')}</b><small>{t('Bakery')} · {t('Available')}</small></span><strong><bdi>{n(180000)}</bdi></strong></div>
              </div>
            </div>
          </div>
          <div className="lp-dashboard-note">
            <span><Check size={16} /></span>
            <div><b>{t('Changes are live')}</b><small>{t('Your menu updated just now')}</small></div>
          </div>
        </div>

        <div className="lp-feature-grid">
          {features.map(({ icon: Icon, title, copy, className }, index) => (
            <article className={`lp-feature-card ${className}`} data-reveal key={title} style={{ '--delay': `${index * 70}ms` } as CSSProperties}>
              <div className="lp-feature-icon"><Icon /></div>
              <h3>{t(title)}</h3>
              <p>{t(copy)}</p>
              {index === 0 && <div className="lp-language-pills"><b>{t('English')}</b><span lang="ar">{landingText('ar', 'Arabic')}</span></div>}
              {index === 1 && <div className="lp-color-palette"><span /><span /><span /><i>{t('CO')}</i></div>}
              {index === 2 && <div className="lp-speed-demo"><span>{t('Margherita')}</span><b><bdi>{n(420000)}</bdi></b><i>{t('Saved')}</i></div>}
              {index === 3 && <div className="lp-chart-demo"><span /><span /><span /><span /><span /><span /><span /></div>}
            </article>
          ))}
        </div>
      </section>

      <section className="lp-steps-section" id="how-it-works">
        <div className="shell">
          <div className="lp-section-heading lp-section-heading-light" data-reveal>
            <span className="lp-section-kicker">{t('From idea to table')}</span>
            <h2>{t('Live before the')}<br /><em>{t('next service.')}</em></h2>
          </div>
          <div className="lp-step-list">
            <article data-reveal>
              <span className="lp-step-number">{n(1, { minimumIntegerDigits: 2 })}</span>
              <div className="lp-step-icon"><UtensilsCrossed /></div>
              <h3>{t('Tell us about your place')}</h3>
              <p>{t('Add your restaurant name, brand colors and contact details.')}</p>
              <small>{t('About 2 minutes')}</small>
            </article>
            <article data-reveal style={{ '--delay': '100ms' } as CSSProperties}>
              <span className="lp-step-number">{n(2, { minimumIntegerDigits: 2 })}</span>
              <div className="lp-step-icon"><LayoutDashboard /></div>
              <h3>{t('Build your menu')}</h3>
              <p>{t('Add categories, items, photos and prices — in English, Arabic, or both.')}</p>
              <small>{t('We can help with setup')}</small>
            </article>
            <article data-reveal style={{ '--delay': '200ms' } as CSSProperties}>
              <span className="lp-step-number">{n(3, { minimumIntegerDigits: 2 })}</span>
              <div className="lp-step-icon"><QrCode /></div>
              <h3>{t('Put your QR on the table')}</h3>
              <p>{t('Download your print-ready code and welcome guests to their new menu.')}</p>
              <small>{t('Live instantly')}</small>
            </article>
          </div>
        </div>
      </section>

      <section className="lp-pricing-section shell" id="pricing">
        <div className="lp-pricing-card" data-reveal>
          <div className="lp-pricing-copy">
            <span className="lp-section-kicker">{t('Simple, honest pricing')}</span>
            <h2>{t('One plan.')}<br /><em>{t('Everything included.')}</em></h2>
            <p>{t('No setup fee, no hidden packages, and no limits on the number of times you update your menu.')}</p>
            <div className="lp-support-note"><MessageCircle /><span><b>{t('Real setup support')}</b><small>{t('We are here when you need a hand.')}</small></span></div>
          </div>
          <div className="lp-price-box">
            <span className="lp-popular-badge"><Sparkles /> {t('Complete plan')}</span>
            <div className="lp-price"><strong><bdi>{language === 'ar' ? n(60) : '$60'}</bdi></strong><span><b>{t('USD')}</b>{t('per year')}</span></div>
            <p>{t('Everything you need to launch and manage your digital menu.')}</p>
            <div className="lp-benefit-list">
              {benefits.map(([title, copy]) => (
                <div key={title}><Check /><span><b>{t(title)}</b><small>{t(copy)}</small></span></div>
              ))}
            </div>
            <Link className="button lp-primary-button full" to="/signup">{t('Start free for 14 days')} <ArrowRight /></Link>
            <small className="lp-price-footnote"><ShieldCheck /> {t('No card required to start')}</small>
          </div>
        </div>
      </section>

      <section className="lp-final-cta shell" data-reveal>
        <div className="lp-cta-orbit lp-cta-orbit-one" />
        <div className="lp-cta-orbit lp-cta-orbit-two" />
        <span className="lp-section-kicker">{t('Your next menu is ready')}</span>
        <h2>{t('Make every first scan')}<br /><em>{t('a beautiful one.')}</em></h2>
        <p>{t('Give your guests a faster, clearer and more memorable way to explore what you serve.')}</p>
        <div>
          <Link className="button lp-light-button" to="/signup">{t('Create your menu')} <ArrowRight /></Link>
          <Link className="lp-demo-link" to="/m/demo">{t('View the live demo')} <ChevronRight /></Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="shell lp-footer-top">
          <div><Brand light homeLabel={t('Fluxiva Menu home')} /><p>{t('Beautiful digital menus, made in Lebanon.')}</p></div>
          <div className="lp-footer-links"><b>{t('Product')}</b><a href="#features">{t('Features')}</a><a href="#how-it-works">{t('How it works')}</a><a href="#pricing">{t('Pricing')}</a></div>
          <div className="lp-footer-links"><b>{t('Get started')}</b><Link to="/m/demo">{t('Live demo')}</Link><Link to="/signup">{t('Create account')}</Link><Link to="/login">{t('Sign in')}</Link></div>
          <div className="lp-footer-promise"><Clock3 /><span><b>{t('Fast to launch')}</b><small>{t('Built for busy restaurants.')}</small></span></div>
        </div>
        <div className="shell lp-footer-bottom"><span>© <bdi>{n(new Date().getFullYear(), { useGrouping: false })}</bdi> {t('Fluxiva Menu')}</span><span>{t('Designed with care for hospitality.')}</span></div>
      </footer>
    </main>
  )
}
