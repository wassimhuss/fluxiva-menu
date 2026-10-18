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
const status = uri(compile('components/Status.tsx'))
const i18n = uri(compile('lib/branchRequestI18n.ts'))
const { BranchRequestOverview } = await import(uri(compile('components/BranchRequestOverview.tsx')
  .replace("'./Status'", JSON.stringify(status)).replace("'../lib/branchRequestI18n'", JSON.stringify(i18n))))
const row = (status = 'pending') => ({ id: status, status, name_en: 'Beirut branch', name_ar: 'فرع بيروت', slug: 'corrected-beirut', decision_note: '' })
const page = requests => ({ requests, pending_count: requests.filter(row => row.status === 'pending').length, total: requests.length, page: 0, page_size: 25 })
const render = props => renderToStaticMarkup(createElement(BranchRequestOverview, {
  language: 'en', data: page([]), loading: false, error: '', page: 0, canCreate: true,
  onRefresh() {}, onPage() {}, onView() {}, onCreate() {}, ...props,
}))

test('owner dashboard shows pending status, reviewed link and duplicate-submission guidance without creation controls', () => {
  const html = render({ data: page([row()]) })
  assert.match(html, /Branch requests/)
  assert.match(html, /1 pending/)
  assert.match(html, /Beirut branch/)
  assert.match(html, /<bdi>\/m\/corrected-beirut<\/bdi>/)
  assert.match(html, /No need to send it again/)
  assert.match(html, /View requests/)
  assert.doesNotMatch(html, />Create now</)
})

test('approved dashboard requests offer creation, but expired/suspended shops retain the lock', () => {
  const data = page([row('approved')])
  assert.match(render({ data }), /Branch approved/)
  assert.match(render({ data }), /<button[^>]*>Create now<\/button>/)
  const locked = render({ data, canCreate: false })
  assert.match(locked, /<button[^>]*disabled=""[^>]*>Create now<\/button>/)
  assert.match(locked, /Resolve expired or suspended shops/)
  for (const status of ['rejected', 'created']) assert.doesNotMatch(render({ data: page([row(status)]) }), />Create now</)
})

test('dashboard handles empty, loading, failed and paginated requests without inventing a successful empty result', () => {
  assert.match(render(), /No branch requests yet/)
  assert.match(render(), /Request a new branch/)
  assert.match(render({ data: null, loading: true }), /Loading requests/)
  const failed = render({ data: null, error: 'Could not load branch requests.' })
  assert.match(failed, /Could not load branch requests/)
  assert.doesNotMatch(failed, /No branch requests yet|0 pending/)
  const many = render({ data: { ...page([row()]), total: 61, pending_count: 40 }, page: 1 })
  assert.match(many, /40 pending/)
  assert.match(many, /Page 2 \/ 3/)
  assert.match(many, />Next</)
})

test('Arabic dashboard keeps RTL copy, LTR menu links, and safely escaped rejection notes', () => {
  const html = render({ language: 'ar', data: page([{ ...row('rejected'), decision_note: '<script>private note</script>' }]) })
  assert.match(html, /dir="rtl"/)
  assert.match(html, /طلبات الفروع/)
  assert.match(html, /فرع بيروت/)
  assert.match(html, /مرفوض/)
  assert.match(html, /<bdi>\/m\/corrected-beirut<\/bdi>/)
  assert.match(html, /&lt;script&gt;private note&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>/)
  const approved = render({ language: 'ar', data: page([row('approved')]) })
  assert.match(approved, /وافقنا عالفرع/)
  assert.match(approved, /اعمل الفرع هلّق/)
})
