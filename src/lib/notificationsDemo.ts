import type { AnnouncementInput, AnnouncementPage, AnnouncementReceipt, OwnerNotificationPage, PlatformAnnouncement } from './types'
import { demoBranchRequestCounts } from './branchRequestsDemo'
import { demoSubscribers } from './billingDemo'

const messages: (PlatformAnnouncement & { read_at: string | null })[] = []
export function demoSendAnnouncement(id: string, input: AnnouncementInput): AnnouncementReceipt {
  const draft = { title_en: input.title_en.trim(), title_ar: input.title_ar.trim(), body_en: input.body_en.trim(), body_ar: input.body_ar.trim() }
  if (Object.values(draft).some(value => !value) || draft.title_en.length > 200 || draft.title_ar.length > 200 || draft.body_en.length > 5000 || draft.body_ar.length > 5000) throw new Error('Enter both titles and both messages within the character limits.')
  const existing = messages.find(row => row.id === id)
  if (existing) {
    if (Object.entries(draft).some(([key, value]) => existing[key as keyof AnnouncementInput] !== value)) throw new Error('This send ID was already used. Refresh sent messages before sending again.')
    return { id, recipient_count: existing.recipient_count }
  }
  const recipient_count = demoSubscribers().subscribers.filter(owner => !owner.archived).length
  messages.unshift({ ...draft, id, recipient_count, created_at: new Date().toISOString(), actor_email: 'admin@fluxiva.menu', read_count: 0, read_at: null })
  return { id, recipient_count }
}
export function demoOwnerNotifications(page = 0): OwnerNotificationPage {
  return { messages: messages.slice(page * 25, page * 25 + 25).map(({ id, title_en, title_ar, body_en, body_ar, created_at, read_at }) => ({ id, title_en, title_ar, body_en, body_ar, created_at, read_at })), total: messages.length, unread_count: messages.filter(row => !row.read_at).length, ...demoBranchRequestCounts(), page, page_size: 25 }
}
export function demoReadNotification(id: string) {
  const message = messages.find(row => row.id === id)
  if (!message) throw new Error('This notification is unavailable.')
  message.read_at ??= new Date().toISOString(); message.read_count = 1
}
export function demoAnnouncements(page = 0): AnnouncementPage {
  return { messages: messages.slice(page * 25, page * 25 + 25).map(({ read_at: _readAt, ...message }) => { void _readAt; return { ...message } }), total: messages.length, page, page_size: 25 }
}
