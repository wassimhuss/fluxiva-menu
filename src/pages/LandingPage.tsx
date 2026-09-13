import { ArrowRight, Check, Languages, Palette, QrCode, Smartphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'

export function LandingPage() {
  return (
    <main className="landing">
      <nav className="landing-nav shell">
        <Brand />
        <div className="nav-actions">
          <Link className="text-link hide-mobile" to="/m/demo">View demo</Link>
          <Link className="button button-small button-outline" to="/login">Sign in</Link>
        </div>
      </nav>

      <section className="hero shell">
        <div className="hero-copy">
          <span className="eyebrow"><span /> Built for Lebanese restaurants</span>
          <h1>Your menu,<br /><em>one scan away.</em></h1>
          <p>Create a beautiful Arabic and English menu your customers can open instantly from a QR code. Update it whenever you want.</p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/signup">Start your 14-day trial <ArrowRight size={18} /></Link>
            <Link className="button button-ghost" to="/m/demo">Open live demo</Link>
          </div>
          <p className="micro-copy"><Check size={15} /> No card needed · Setup included · Cancel anytime</p>
        </div>

        <div className="hero-visual" aria-label="Preview of a restaurant QR menu">
          <div className="phone-shadow" />
          <div className="phone-mockup">
            <div className="phone-speaker" />
            <div className="mock-cover">
              <span className="mock-logo">CO</span>
              <small>CEDAR OVEN</small>
              <strong>Fresh from our oven</strong>
            </div>
            <div className="mock-tabs"><b>Pizza</b><span>Manaeesh</span><span>Drinks</span></div>
            <div className="mock-menu-item"><div><b>Margherita</b><small>Tomato, mozzarella & basil</small></div><strong>350,000</strong></div>
            <div className="mock-sizes"><b>S</b><span>M</span><span>L</span></div>
            <div className="mock-menu-item"><div><b>Pepperoni</b><small>Mozzarella & tomato sauce</small></div><strong>550,000</strong></div>
          </div>
          <div className="qr-card"><QrCode size={48} strokeWidth={1.4} /><span>Scan the menu</span></div>
        </div>
      </section>

      <section className="trust-strip">
        <div className="shell trust-grid">
          <div><Smartphone /><span><b>Mobile first</b><small>Perfect on every phone</small></span></div>
          <div><Languages /><span><b>Arabic + English</b><small>Switch in one tap</small></span></div>
          <div><Palette /><span><b>Your brand</b><small>Colors, logo and details</small></span></div>
          <div><QrCode /><span><b>Ready QR code</b><small>Download and print</small></span></div>
        </div>
      </section>

      <section className="steps shell">
        <span className="eyebrow centered"><span /> Simple from day one</span>
        <h2>From signup to table in minutes.</h2>
        <div className="step-grid">
          <article><b>01</b><h3>Create your restaurant</h3><p>Add your name, logo, colors and contact details.</p></article>
          <article><b>02</b><h3>Build your menu</h3><p>Add categories, items, prices and size options in both languages.</p></article>
          <article><b>03</b><h3>Share your QR</h3><p>Download it, print it and place it on every table.</p></article>
        </div>
      </section>

      <section className="pricing-section">
        <div className="pricing-card shell-small">
          <div>
            <span className="eyebrow"><span /> One simple plan</span>
            <h2>Everything your menu needs.</h2>
            <p>Personal setup support included. No confusing packages and no surprise fees.</p>
          </div>
          <div className="price-panel">
            <div><strong>$60</strong><span>per year</span></div>
            <ul><li><Check /> Unlimited menu updates</li><li><Check /> Arabic and English</li><li><Check /> Custom QR code</li><li><Check /> Your logo and colors</li></ul>
            <Link className="button button-primary full" to="/signup">Start free for 14 days</Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer shell"><Brand light /><p>Digital menus made in Lebanon.</p><span>© {new Date().getFullYear()} Fluxiva Menu</span></footer>
    </main>
  )
}
