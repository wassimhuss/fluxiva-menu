import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const uri = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
const compile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
// Exercise the actual page submit handler with controlled auth/navigation.
// No production accounts are created by these tests.
const page = ts.createSourceFile('AuthPage.tsx', readFileSync(new URL('../src/pages/AuthPage.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
const component = page.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'AuthPage')
const submit = component.body.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'submit')
assert.ok(submit)
const { harness } = await import(uri(compile(`export function harness({isSignup=true,isForgot=false,password='Password-123',confirmation='Password-123',email='preview@example.com',supabase=null}={}) {
  const errors=[],messages=[],busy=[],destinations=[]; let focused=0,prevented=0;
  const setError=value=>errors.push(value),setMessage=value=>messages.push(value),setBusy=value=>busy.push(value),navigate=value=>destinations.push(value);
  const confirmationInput={current:{focus(){focused++}}};
  ${submit.getText(page)}
  return {errors,messages,busy,destinations,get focused(){return focused},get prevented(){return prevented},run:()=>submit({preventDefault(){prevented++}})};
}`)))
const i18n = await import(uri(compile(readFileSync(new URL('../src/lib/authI18n.ts', import.meta.url), 'utf8'))))

test('signup mismatch is blocked before remote signup and before demo navigation', async () => {
  let calls = 0
  for (const supabase of [null, { auth: { signUp: async () => { calls++; throw new Error('Must not be called') } } }]) {
    const form = harness({ confirmation: 'Different-123', supabase })
    await form.run()
    assert.equal(calls, 0)
    assert.deepEqual(form.destinations, [])
    assert.deepEqual(form.busy, [])
    assert.equal(form.errors.at(-1), 'Both passwords need to match.')
    assert.equal(form.focused, 1)
    assert.equal(form.prevented, 1)
  }
})

test('confirmation uses an exact match, including whitespace and case', async () => {
  for (const confirmation of ['', 'password-123', 'Password-123 ']) {
    const form = harness({ confirmation })
    await form.run()
    assert.equal(form.errors.at(-1), 'Both passwords need to match.')
    assert.deepEqual(form.destinations, [])
  }
})

test('matching signup retains demo access and sends only email/password to Supabase', async () => {
  const demo = harness()
  await demo.run()
  assert.deepEqual(demo.destinations, ['/dashboard'])
  let sent
  const form = harness({ supabase: { auth: { signUp: async input => { sent = input; return { error: null, data: { session: null } } } } } })
  await form.run()
  assert.deepEqual(sent, { email: 'preview@example.com', password: 'Password-123' })
  assert.deepEqual(form.busy, [true, false])
  assert.match(form.messages.at(-1), /Check your email/)
})

test('login does not require confirmation, and confirmation labels/errors are bilingual', async () => {
  let called = false
  const login = harness({ isSignup: false, confirmation: '', supabase: { auth: { signInWithPassword: async () => { called = true; return { error: null, data: { session: {} } } } } } })
  await login.run()
  assert.equal(called, true)
  for (const key of ['Confirm password', 'Show password confirmation', 'Hide password confirmation']) {
    assert.notEqual(i18n.authText('ar', key), key)
    assert.equal(i18n.authText('en', key), key)
  }
  assert.equal(i18n.authErrorText('ar', 'Both passwords need to match.'), 'يجب أن تتطابق كلمتا المرور.')
})
