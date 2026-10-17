/** Keep both currencies readable without squeezing the dish name on phones. */
export function PriceLabel({ text }: { text: string }) {
  const [lbp, usd] = text.split(' / ')
  return <span className="menu-dual-price-label" dir="ltr"><span>{lbp}</span>{usd && <small>{usd}</small>}</span>
}
