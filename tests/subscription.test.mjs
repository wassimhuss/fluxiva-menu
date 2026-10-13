import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync(new URL('../src/lib/subscription.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {ownerAccessState,subscriptionState}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
test('public access stops at expiry; owner editing has exactly seven elapsed days before locking',()=>{
  const end='2026-10-20T10:00:00Z', expiry=Date.parse(end), week=7*86400000
  for(const status of ['trial','active']) {
    const shop={subscription_status:status,trial_ends_at:end,subscription_ends_at:end}
    assert.equal(ownerAccessState(shop,expiry-1),'open')
    assert.equal(subscriptionState(shop,expiry).serving,false)
    assert.equal(ownerAccessState(shop,expiry),'warning')
    assert.equal(ownerAccessState(shop,expiry+week-1),'warning')
    assert.equal(ownerAccessState(shop,expiry+week),'blocked')
    assert.equal(ownerAccessState({...shop,subscription_ends_at:'2027-10-20T10:00:00Z',trial_ends_at:'2027-10-20T10:00:00Z'},expiry+week),'open')
  }
})
test('suspension blocks editing immediately; legacy undated active access stays usable',()=>{
  assert.equal(ownerAccessState({subscription_status:'suspended',subscription_ends_at:'2028-01-01'}),'blocked')
  assert.equal(ownerAccessState({subscription_status:'active'}),'open')
  assert.equal(ownerAccessState({subscription_status:'trial'}),'blocked')
})
