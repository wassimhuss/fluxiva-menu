import type { BranchRequest, BranchRequestInput, BranchRequestPage } from './types'
import { demoMenus } from './demo'

const requests: BranchRequest[] = []
export function demoRequestBranch(input: BranchRequestInput) {
  if (requests.some(row => row.slug === input.slug && ['pending', 'approved'].includes(row.status))) throw new Error('A request for this menu link is already pending or approved')
  if (demoMenus.some(menu => menu.restaurant.slug === input.slug)) throw new Error('This menu link is already taken. Choose a different one.')
  const request: BranchRequest = { ...input, id: crypto.randomUUID(), owner_id: 'demo-owner', owner_email: 'owner@hilaloven.com', status: 'pending', decision_note: '', created_at: new Date().toISOString(), reviewed_at: null, restaurant_id: null }
  requests.unshift(request)
  return request.id
}
export function demoBranchRequests(page = 0): BranchRequestPage {
  const sorted = [...requests].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || b.created_at.localeCompare(a.created_at))
  return { requests: structuredClone(sorted.slice(page * 25, page * 25 + 25)), total: requests.length, pending_count: requests.filter(row => row.status === 'pending').length, page, page_size: 25 }
}
export function demoReviewBranch(id: string, approve: boolean, note: string) {
  const request = requests.find(row => row.id === id)
  if (!request || request.status !== 'pending') throw new Error('This request has already been reviewed or removed')
  request.status = approve ? 'approved' : 'rejected'; request.decision_note = note.trim(); request.reviewed_at = new Date().toISOString()
}
export function demoApprovedBranch(id: string, slug: string) {
  const request = requests.find(row => row.id === id && row.slug === slug && row.status === 'approved')
  if (!request) throw new Error('Request approval before creating another branch')
  return request
}
