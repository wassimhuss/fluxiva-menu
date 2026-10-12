import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = ts.transpileModule(readFileSync(new URL('../src/lib/routeAccess.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { routeAccess } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const owner = { session: { user: { id: 'owner' } }, loading: false, demoMode: false, adminRole: null, adminLoading: false, adminError: false }
test('owners and operators cannot enter each other’s workspace', () => {
  assert.equal(routeAccess(owner, 'owner'), 'allow')
  assert.equal(routeAccess(owner, 'operator'), '/dashboard')
  for (const adminRole of ['super_admin', 'support']) {
    assert.equal(routeAccess({ ...owner, adminRole }, 'owner'), '/platform')
    assert.equal(routeAccess({ ...owner, adminRole }, 'operator'), 'allow')
  }
})
test('guards wait for the current role and show an error rather than assuming ownership on failure', () => {
  for (const kind of ['owner', 'operator']) {
    assert.equal(routeAccess({ ...owner, loading: true }, kind), 'loading')
    assert.equal(routeAccess({ ...owner, adminLoading: true, adminRole: 'super_admin' }, kind), 'loading')
    assert.equal(routeAccess({ ...owner, adminError: true }, kind), 'error')
    assert.equal(routeAccess({ ...owner, session: null, adminLoading: true }, kind), '/login')
  }
})
test('both offline workspaces remain accessible without making demo login an operator login', () => {
  const demo = { ...owner, session: null, demoMode: true, adminRole: 'super_admin' }
  assert.equal(routeAccess(demo, 'owner'), 'allow')
  assert.equal(routeAccess(demo, 'operator'), 'allow')
})
