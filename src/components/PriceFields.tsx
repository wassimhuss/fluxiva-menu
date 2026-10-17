import { useState } from 'react'
import { dashboardText } from '../lib/dashboardI18n'
import { lbpToUsd, secondaryPrice, usdToLbp } from '../lib/pricing'
import type { Currency, Language } from '../lib/types'

/** Mounted with each item/size/extra draft. Editing LBP recalculates USD;
 * editing USD then preserves the entered LBP amount and saves an override. */
export function PriceFields({ price, secondary, currency, language, required = true, label = 'Base price', onChange }: {
  price: string | number; secondary?: number | null; currency: Currency; language: Language
  required?: boolean; label?: string; onChange: (price: string, secondary: number | null) => void
}) {
  const t = (text: string) => dashboardText(language, text)
  const [lbp, setLbp] = useState(() => price === '' ? '' : String(currency === 'LBP' ? price : secondaryPrice({ price: Number(price), price_secondary: secondary }, currency)))
  const [usd, setUsd] = useState(() => price === '' ? '' : String(currency === 'USD' ? price : secondaryPrice({ price: Number(price), price_secondary: secondary }, currency)))
  function enterLbp(value: string) {
    setLbp(value)
    const converted = value === '' ? '' : String(lbpToUsd(Number(value)))
    setUsd(converted)
    onChange(currency === 'LBP' ? value : converted, currency === 'LBP' || value === '' ? null : Number(value))
  }
  function enterUsd(value: string) {
    setUsd(value)
    onChange(currency === 'USD' ? value : lbp, currency === 'USD' ? (lbp === '' ? null : Number(lbp)) : (value === '' ? null : Number(value)))
  }
  return <fieldset className="dual-price-fields"><legend>{t(label)}</legend><div className="dual-price-inputs">
    <label>{t('Price in LBP')}<input aria-label={`${t(label)} · LBP`} type="number" dir="ltr" min="0" max="999999999999" step="1" required={required} value={lbp} onChange={event => enterLbp(event.target.value)} placeholder="895000" /></label>
    <label>{t('Price in USD')}<input aria-label={`${t(label)} · USD`} type="number" dir="ltr" min="0" max="9999999999" step="0.01" required={required} value={usd} onChange={event => enterUsd(event.target.value)} placeholder="10.00" /></label>
  </div><div className="dual-price-hint"><small>{t('1 USD = 89,500 LBP. Enter LBP to calculate USD, then edit USD if needed.')}</small><button type="button" onClick={() => enterLbp(lbp || (usd ? String(usdToLbp(Number(usd))) : ''))}>{t('Recalculate USD')}</button></div></fieldset>
}
