import { useEffect } from 'react'
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
]

const benefits = [
  ['Unlimited edits', 'Change your menu whenever service demands it.'],
  ['Bilingual by design', 'Arabic and English live side by side.'],
  ['Personal setup help', 'We help you get the first version just right.'],
  ['Print-ready QR', 'Download once and use it everywhere.'],
]

export function LandingPage() {
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
    <main className="landing landing-v2">
      <div className="lp-nav-wrap">
        <nav className="lp-nav shell" aria-label="Main navigation">
          <Brand />
          <div className="lp-nav-links hide-tablet">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="nav-actions">
            <Link className="text-link hide-mobile" to="/login">Sign in</Link>
            <Link className="button button-small lp-nav-cta" to="/signup">
              Start free <ArrowRight size={15} />
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
            Digital menus, beautifully simplified
          </div>
          <h1>
            A menu that feels
            <span>as good as your food.</span>
          </h1>
          <p className="lp-hero-lead">
            Create a beautiful, bilingual QR menu your guests can open instantly — and your team can update in seconds.
          </p>
          <div className="lp-hero-actions">
            <Link className="button lp-primary-button" to="/signup">
              Start your 14-day trial <ArrowRight size={18} />
            </Link>
            <Link className="button lp-secondary-button" to="/m/demo">
              <span className="lp-play-dot"><span /></span> Explore live menu
            </Link>
          </div>
          <div className="lp-assurance">
            <span><CheckCircle2 /> No card required</span>
            <span><CheckCircle2 /> Setup included</span>
            <span><CheckCircle2 /> Ready in minutes</span>
          </div>
          <div className="lp-hero-proof">
            <div className="lp-proof-avatars" aria-hidden="true">
              <span>CO</span><span>MO</span><span>BA</span><span>+</span>
            </div>
            <p><strong>Built for hospitality</strong><br />Thoughtful on every screen, from kitchen to table.</p>
          </div>
        </div>

        <div className="lp-hero-stage" aria-label="Animated preview of a Fluxiva restaurant menu">
          <div className="lp-stage-ring lp-stage-ring-one" />
          <div className="lp-stage-ring lp-stage-ring-two" />
          <div className="lp-phone-wrap">
            <div className="lp-phone">
              <div className="lp-phone-top"><span /><i /></div>
              <div className="lp-phone-screen">
                <div className="lp-menu-cover">
                  <div className="lp-menu-logo">CO</div>
                  <small>CEDAR OVEN</small>
                  <strong>Fresh from our oven</strong>
                  <span>Beirut · Open now</span>
                </div>
                <div className="lp-menu-search">⌕&nbsp;&nbsp; Search the menu</div>
                <div className="lp-menu-tabs"><b>Popular</b><span>Manakish</span><span>Pizza</span></div>
                <div className="lp-menu-content">
                  <small>POPULAR TODAY</small>
                  <div className="lp-demo-item">
                    <div><b>Cheese Manoushe</b><span>Akawi cheese, sesame</span><strong>250,000 LBP</strong></div>
                    <img src="/menu/manakish.jpg" alt="Cheese manoushe" />
                  </div>
                  <div className="lp-demo-item">
                    <div><b>Margherita</b><span>Tomato, mozzarella, basil</span><strong>420,000 LBP</strong></div>
                    <img src="/menu/pizza.jpg" alt="Margherita pizza" />
                  </div>
                </div>
              </div>
              <div className="lp-phone-home" />
            </div>
          </div>

          <div className="lp-float-card lp-language-card">
            <div><Languages size={17} /></div>
            <span><small>One tap switch</small><b>English&nbsp; / &nbsp;العربية</b></span>
          </div>
          <div className="lp-float-card lp-status-card">
            <span className="lp-live-dot" />
            <span><small>Menu status</small><b>Live & ready to scan</b></span>
          </div>
          <div className="lp-qr-float">
            <QrCode />
            <span><b>Scan to explore</b><small>No app needed</small></span>
          </div>
        </div>
      </section>

      <section className="lp-trust-bar" aria-label="Product benefits">
        <div className="shell lp-trust-items">
          <div><Smartphone /><span><b>Mobile first</b><small>Beautiful on every phone</small></span></div>
          <div><Languages /><span><b>Truly bilingual</b><small>Arabic and English</small></span></div>
          <div><Palette /><span><b>Always on brand</b><small>Your identity, your menu</small></span></div>
          <div><QrCode /><span><b>Scan & discover</b><small>No download required</small></span></div>
        </div>
      </section>

      <section className="lp-story shell" id="features">
        <div className="lp-section-heading" data-reveal>
          <span className="lp-section-kicker">Everything in one place</span>
          <h2>Less menu admin.<br /><em>More time for guests.</em></h2>
          <p>Fluxiva keeps the experience polished for customers and refreshingly simple for your team.</p>
        </div>

        <div className="lp-dashboard-showcase" data-reveal>
          <div className="lp-dashboard-window">
            <div className="lp-window-bar"><span /><span /><span /><b>Menu overview</b></div>
            <aside className="lp-window-sidebar">
              <div className="lp-mini-brand"><UtensilsCrossed /> CO</div>
              <span className="active"><LayoutDashboard /> Overview</span>
              <span><UtensilsCrossed /> Menu items</span>
              <span><Palette /> Appearance</span>
              <span><QrCode /> Your QR</span>
            </aside>
            <div className="lp-window-main">
              <div className="lp-window-title"><span><small>GOOD AFTERNOON</small><b>Your menu is looking great.</b></span><button>+ Add item</button></div>
              <div className="lp-window-stats">
                <div><small>Menu items</small><b>28</b><span>4 categories</span></div>
                <div><small>Available now</small><b>26</b><span className="positive">● Live</span></div>
                <div><small>Languages</small><b>2</b><span>EN + AR</span></div>
              </div>
              <div className="lp-window-list">
                <header><b>Popular items</b><span>View all</span></header>
                <div><img src="/menu/manakish.jpg" alt="" /><span><b>Cheese Manoushe</b><small>Manakish · Available</small></span><strong>250,000</strong></div>
                <div><img src="/menu/pizza.jpg" alt="" /><span><b>Margherita</b><small>Pizza · Available</small></span><strong>420,000</strong></div>
                <div><img src="/menu/croissants.jpg" alt="" /><span><b>Almond Croissant</b><small>Bakery · Available</small></span><strong>180,000</strong></div>
              </div>
            </div>
          </div>
          <div className="lp-dashboard-note">
            <span><Check size={16} /></span>
            <div><b>Changes are live</b><small>Your menu updated just now</small></div>
          </div>
        </div>

        <div className="lp-feature-grid">
          {features.map(({ icon: Icon, title, copy, className }, index) => (
            <article className={`lp-feature-card ${className}`} data-reveal key={title} style={{ '--delay': `${index * 70}ms` } as CSSProperties}>
              <div className="lp-feature-icon"><Icon /></div>
              <h3>{title}</h3>
              <p>{copy}</p>
              {index === 0 && <div className="lp-language-pills"><b>English</b><span>العربية</span></div>}
              {index === 1 && <div className="lp-color-palette"><span /><span /><span /><i>CO</i></div>}
              {index === 2 && <div className="lp-speed-demo"><span>Margherita</span><b>420,000</b><i>Saved</i></div>}
              {index === 3 && <div className="lp-chart-demo"><span /><span /><span /><span /><span /><span /><span /></div>}
            </article>
          ))}
        </div>
      </section>

      <section className="lp-steps-section" id="how-it-works">
        <div className="shell">
          <div className="lp-section-heading lp-section-heading-light" data-reveal>
            <span className="lp-section-kicker">From idea to table</span>
            <h2>Live before the<br /><em>next service.</em></h2>
          </div>
          <div className="lp-step-list">
            <article data-reveal>
              <span className="lp-step-number">01</span>
              <div className="lp-step-icon"><UtensilsCrossed /></div>
              <h3>Tell us about your place</h3>
              <p>Add your restaurant name, brand colors, contact details and opening hours.</p>
              <small>About 2 minutes</small>
            </article>
            <article data-reveal style={{ '--delay': '100ms' } as CSSProperties}>
              <span className="lp-step-number">02</span>
              <div className="lp-step-icon"><LayoutDashboard /></div>
              <h3>Build your menu</h3>
              <p>Add categories, items, photos and prices — in English, Arabic, or both.</p>
              <small>We can help with setup</small>
            </article>
            <article data-reveal style={{ '--delay': '200ms' } as CSSProperties}>
              <span className="lp-step-number">03</span>
              <div className="lp-step-icon"><QrCode /></div>
              <h3>Put your QR on the table</h3>
              <p>Download your print-ready code and welcome guests to their new menu.</p>
              <small>Live instantly</small>
            </article>
          </div>
        </div>
      </section>

      <section className="lp-pricing-section shell" id="pricing">
        <div className="lp-pricing-card" data-reveal>
          <div className="lp-pricing-copy">
            <span className="lp-section-kicker">Simple, honest pricing</span>
            <h2>One plan.<br /><em>Everything included.</em></h2>
            <p>No setup fee, no hidden packages, and no limits on the number of times you update your menu.</p>
            <div className="lp-support-note"><MessageCircle /><span><b>Real setup support</b><small>We are here when you need a hand.</small></span></div>
          </div>
          <div className="lp-price-box">
            <span className="lp-popular-badge"><Sparkles /> Complete plan</span>
            <div className="lp-price"><strong>$60</strong><span><b>USD</b>per year</span></div>
            <p>Everything you need to launch and manage your digital menu.</p>
            <div className="lp-benefit-list">
              {benefits.map(([title, copy]) => (
                <div key={title}><Check /><span><b>{title}</b><small>{copy}</small></span></div>
              ))}
            </div>
            <Link className="button lp-primary-button full" to="/signup">Start free for 14 days <ArrowRight /></Link>
            <small className="lp-price-footnote"><ShieldCheck /> No card required to start</small>
          </div>
        </div>
      </section>

      <section className="lp-final-cta shell" data-reveal>
        <div className="lp-cta-orbit lp-cta-orbit-one" />
        <div className="lp-cta-orbit lp-cta-orbit-two" />
        <span className="lp-section-kicker">Your next menu is ready</span>
        <h2>Make every first scan<br /><em>a beautiful one.</em></h2>
        <p>Give your guests a faster, clearer and more memorable way to explore what you serve.</p>
        <div>
          <Link className="button lp-light-button" to="/signup">Create your menu <ArrowRight /></Link>
          <Link className="lp-demo-link" to="/m/demo">View the live demo <ChevronRight /></Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="shell lp-footer-top">
          <div><Brand light /><p>Beautiful digital menus, made in Lebanon.</p></div>
          <div className="lp-footer-links"><b>Product</b><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a></div>
          <div className="lp-footer-links"><b>Get started</b><Link to="/m/demo">Live demo</Link><Link to="/signup">Create account</Link><Link to="/login">Sign in</Link></div>
          <div className="lp-footer-promise"><Clock3 /><span><b>Fast to launch</b><small>Built for busy restaurants.</small></span></div>
        </div>
        <div className="shell lp-footer-bottom"><span>© {new Date().getFullYear()} Fluxiva Menu</span><span>Designed with care for hospitality.</span></div>
      </footer>
    </main>
  )
}
