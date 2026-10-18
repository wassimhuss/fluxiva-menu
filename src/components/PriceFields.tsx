import { useState } from 'react'
import { dashboardText } from '../lib/dashboardI18n'
import type { Currency, Language } from '../lib/types'

/** Both currencies are entered independently, including on the first save. */
export function PriceFields({ price, secondary, currency, language, required = true, label = 'Base price', onChange }: {
  price: string | number; secondary?: number | null; currency: Currency; language: Language
  required?: boolean; label?: string; onChange: (price: string, secondary: number | null) => void
}) {
  const t = (text: string) => dashboardText(language, text)
  const [lbp, setLbp] = useState(() => currency === 'LBP' ? String(price) : secondary == null ? '' : String(secondary))
  const [usd, setUsd] = useState(() => currency === 'USD' ? String(price) : secondary == null ? '' : String(secondary))
  function enterLbp(value: string) {
    setLbp(value)
    onChange(currency === 'LBP' ? value : usd, currency === 'LBP' ? (usd === '' ? null : Number(usd)) : (value === '' ? null : Number(value)))
  }
  function enterUsd(value: string) {
    setUsd(value)
    onChange(currency === 'USD' ? value : lbp, currency === 'USD' ? (lbp === '' ? null : Number(lbp)) : (value === '' ? null : Number(value)))
  }
  return <fieldset className="dual-price-fields"><legend>{t(label)}</legend><div className="dual-price-inputs">
    <label>{t('Price in LBP')}<input aria-label={`${t(label)} · LBP`} type="number" dir="ltr" min="0" max="999999999999" step="1" required={required} value={lbp} onChange={event => enterLbp(event.target.value)} placeholder="895000" /></label>
    <label>{t('Price in USD')}<input aria-label={`${t(label)} · USD`} type="number" dir="ltr" min="0" max="9999999999" step="0.01" required={required} value={usd} onChange={event => enterUsd(event.target.value)} placeholder="10.00" /></label>
  </div><div className="dual-price-hint"><small>{t('Enter both prices manually. Changing one will not change the other.')}</small></div></fieldset>
}
