import {beirutInput,parseBeirutInput} from './billing'

export const beirutDay=(iso=new Date().toISOString())=>beirutInput(new Date(iso)).slice(0,10)
function validDay(value:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value) throw new Error('Choose a valid date')
  return value
}
const shiftDay=(day:string,days:number)=>{
  const value=new Date(validDay(day)+'T12:00:00Z');value.setUTCDate(value.getUTCDate()+days)
  return value.toISOString().slice(0,10)
}
/** Beirut can skip midnight when daylight saving starts. Use its first valid hour. */
export function beirutDayStart(day:string) {
  validDay(day)
  try {return parseBeirutInput(day+'T00:00')} catch {return parseBeirutInput(day+'T01:00')}
}
/** Expiry is exclusive in the database; the selected calendar day is inclusive. */
export const beirutDayExpiry=(day:string)=>beirutDayStart(shiftDay(day,1))
export function accessThroughDay(iso:string) {
  const day=beirutDay(iso)
  return Date.parse(iso)===Date.parse(beirutDayStart(day))?shiftDay(day,-1):day
}
/** Explicit admin shortcut only, never inferred from a cash amount. */
export function addBillingMonths(day:string,months:number) {
  validDay(day)
  if(!Number.isInteger(months)||months<1||months>120)throw new Error('Choose a valid number of months')
  const source=new Date(day+'T12:00:00Z'),target=new Date(source)
  target.setUTCDate(1);target.setUTCMonth(target.getUTCMonth()+months)
  const last=new Date(target);last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0)
  const lastDay=last.getUTCDate()
  target.setUTCDate(Math.min(source.getUTCDate(),lastDay))
  return validDay(target.toISOString().slice(0,10))
}
/** Today records the actual collection instant; older days use noon, retaining
 * later same-day receipts so a date-only form cannot reorder existing history. */
export function collectionDateInstant(day:string,latest:string|null,now=new Date()) {
  validDay(day)
  const today=beirutDay(now.toISOString())
  if(day>today)throw new Error('Collection date cannot be in the future')
  if(day===today)return now.toISOString()
  const noon=parseBeirutInput(day+'T12:00')
  return latest&&beirutDay(latest)===day&&Date.parse(latest)>Date.parse(noon)?latest:noon
}
