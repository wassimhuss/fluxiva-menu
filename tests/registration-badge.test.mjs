import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {resolve,dirname} from 'node:path'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
const require=createRequire(import.meta.url),cache=new Map()
function moduleUri(path) {
  if(cache.has(path))return cache.get(path)
  const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  const code=source.replace(/from (["'])([^"']+)\1/g,(_,quote,name)=>'from '+JSON.stringify(name.startsWith('.')?moduleUri(resolve(dirname(path),name+'.ts')):pathToFileURL(require.resolve(name)).href))
  const uri='data:text/javascript;base64,'+Buffer.from(code).toString('base64');cache.set(path,uri);return uri
}
const {RegistrationBadge}=await import(moduleUri(resolve('src/components/RegistrationBadge.tsx')))
const render=props=>renderToStaticMarkup(React.createElement(RegistrationBadge,{language:'en',hasShop:true,...props}))
test('approved, needs-review and setup badges have explicit labels as well as distinct states',()=>{
  const pending=render({status:'pending'}),approved=render({status:'approved',reviewedAt:'2026-11-20T12:00:00Z'}),setup=render({status:'pending',hasShop:false})
  assert.ok(pending.includes('Needs review'));assert.ok(pending.includes('registration-badge-pending'))
  assert.ok(approved.includes('Approved'));assert.ok(approved.includes('registration-badge-approved'));assert.ok(approved.includes('Reviewed'))
  assert.ok(setup.includes('Setup incomplete'));assert.ok(setup.includes('registration-badge-setup'))
})
test('missing review information never becomes an approval; Arabic badges remain understandable without color',()=>{
  const unknown=render({status:undefined}),arabic=render({status:'pending',language:'ar'})
  assert.ok(unknown.includes('Review status unavailable'));assert.ok(!unknown.includes('registration-badge-approved'))
  assert.ok(arabic.includes('بحاجة إلى مراجعتك'))
})
