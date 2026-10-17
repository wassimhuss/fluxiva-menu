import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const uri = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
const compile = path => ts.transpileModule(readFileSync(new URL('../src/' + path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText.replace(/(['"])(react\/jsx-runtime|react|lucide-react)\1/g, (_, quote, name) => JSON.stringify(import.meta.resolve(name)))
const status = uri(compile('components/Status.tsx')), i18n = uri(compile('lib/notificationI18n.ts')), billing = uri(compile('lib/billing.ts'))
const api = uri('export async function listAnnouncements(){throw new Error("No network in render tests")} export async function sendAnnouncement(){throw new Error("No sends in render tests")}')
const load = path => import(uri(compile(path).replace("'./Status'", JSON.stringify(status)).replace("'../lib/notificationI18n'", JSON.stringify(i18n)).replace("'../lib/billing'", JSON.stringify(billing)).replace("'../lib/api'", JSON.stringify(api))))
const { OwnerMessages } = await load('components/OwnerMessages.tsx')
const { PlatformMessages } = await load('components/PlatformMessages.tsx')
const message = { id: '1', title_en: 'Hello owners', title_ar: 'مرحباً بأصحاب المطاعم', body_en: '<script>Not HTML</script>\nSecond line', body_ar: 'رسالة جديدة', created_at: '2026-10-17T12:00:00Z', read_at: null }
const page = { messages: [message], total: 26, page: 0, page_size: 25, unread_count: 26, pending_requests: 1, approved_requests: 0 }
const render = props => renderToStaticMarkup(createElement(OwnerMessages, { language: 'en', data: page, loading: false, error: '', reading: '', onRead() {}, onRefresh() {}, onPage() {}, ...props }))

test('owner messages render bilingual safe text, explicit read controls and pagination', () => {
  const html = render()
  assert.match(html, /Hello owners/)
  assert.match(html, /&lt;script&gt;Not HTML&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /Mark as read/)
  assert.match(html, /Page 1 \/ 2/)
  const read = render({ data: { ...page, messages: [{ ...message, read_at: message.created_at }] } })
  assert.doesNotMatch(read, /Mark as read/)
  const ar = render({ language: 'ar' })
  assert.match(ar, /مرحباً بأصحاب المطاعم/)
  assert.match(ar, /رسالة جديدة/)
  assert.doesNotMatch(ar, /Hello owners/)
})

test('failed/loading owner reads are not presented as an empty inbox', () => {
  const failed = render({ data: null, error: 'Could not load notifications.' })
  assert.match(failed, /Could not load notifications/)
  assert.doesNotMatch(failed, /No messages yet/)
  assert.match(render({ data: null, loading: true }), /Loading notifications/)
  assert.match(render({ data: { ...page, messages: [], total: 0 } }), /No messages yet/)
})

test('only super admin UI includes the bilingual broadcast form and review confirmation', () => {
  const admin = renderToStaticMarkup(createElement(PlatformMessages, { language: 'en', canManage: true }))
  for (const label of ['English title', 'Arabic title', 'English message', 'Arabic message', 'Review message', 'Send to all owners?']) assert.ok(admin.includes(label))
  assert.match(admin, /No email or WhatsApp is sent/)
  assert.match(admin, /maxLength="200"/)
  assert.match(admin, /maxLength="5000"/)
  const support = renderToStaticMarkup(createElement(PlatformMessages, { language: 'en', canManage: false }))
  assert.match(support, /Sent messages/)
  assert.doesNotMatch(support, /<form|<dialog|Send message/)
})

test('demo broadcasts preserve stable retries and read state without a backend', async () => {
  const branches = uri('export function demoBranchRequestCounts(){return {pending_requests:2,approved_requests:1}}')
  const subscribers = uri('export function demoSubscribers(){return {subscribers:[{archived:false},{archived:false},{archived:true}]}}')
  const demo = await import(uri(compile('lib/notificationsDemo.ts').replace("'./branchRequestsDemo'", JSON.stringify(branches)).replace("'./billingDemo'", JSON.stringify(subscribers))))
  const input = { title_en: ' Hello ', title_ar: 'مرحباً', body_en: 'A message', body_ar: 'رسالة' }
  const first = demo.demoSendAnnouncement('stable-id', input)
  assert.equal(first.recipient_count, 2)
  assert.deepEqual(demo.demoSendAnnouncement('stable-id', input), first)
  assert.equal(demo.demoOwnerNotifications().total, 1)
  assert.equal(demo.demoOwnerNotifications().pending_requests, 2)
  assert.equal(demo.demoOwnerNotifications().unread_count, 1)
  assert.throws(() => demo.demoSendAnnouncement('stable-id', { ...input, body_en: 'Changed' }), /already used/)
  assert.throws(() => demo.demoSendAnnouncement('empty', { ...input, title_ar: ' ' }), /both titles/)
  demo.demoReadNotification('stable-id')
  demo.demoReadNotification('stable-id')
  assert.equal(demo.demoOwnerNotifications().unread_count, 0)
  assert.equal(demo.demoAnnouncements().messages[0].read_count, 1)
  assert.throws(() => demo.demoReadNotification('missing'), /unavailable/)
})
