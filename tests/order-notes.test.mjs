import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync,readdirSync} from 'node:fs'
import ts from 'typescript'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const read=path=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8')
const uri=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64')
const compile=code=>ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
const formatUri=uri(compile(read('lib/format.ts')))
const pricingUri=uri(compile(read('lib/pricing.ts')).replace("'./format'",JSON.stringify(formatUri)))
const orderUri=uri(compile(read('lib/order.ts')).replace("'./pricing'",JSON.stringify(pricingUri)))
const order=await import(orderUri)
const target=(note='',overrides={})=>({itemId:'dish',variantIndex:0,extraIds:[],quantity:1,note,...overrides})
const key=line=>order.lineKey(line.itemId,line.variantIndex,line.extraIds,line.note)
const item={id:'dish',name_en:'Pizza',name_ar:'بيتزا',price:100000,price_secondary:2,available:true,variants:[{name_en:'L',price:200000,price_secondary:3}],extras:[{id:'cheese',name_en:'Cheese',name_ar:'جبنة',price:50000,price_secondary:0.5}]}

test('line identity includes normalized notes, sizes and sorted extras without delimiter collisions',()=>{
  assert.equal(key(target('  بلا كبيس\r\nقطّعلي ياها  ',{extraIds:['b','a','a']})),key(target('بلا كبيس\nقطّعلي ياها',{extraIds:['a','b']})))
  assert.notEqual(key(target('No pickles')),key(target('Cut in half')))
  assert.notEqual(key(target()),key(target('',{variantIndex:1})))
  assert.notEqual(key(target('',{extraIds:['a,b']})),key(target('',{extraIds:['a','b']})))
  assert.equal(order.normalizeItemNote(null),'')
  assert.equal(order.normalizeItemNote('a\u0000b'),'ab')
  assert.equal(order.normalizeItemNote('x'.repeat(300)).length,200)
  assert.doesNotThrow(()=>encodeURIComponent(order.normalizeItemNote('x'.repeat(199)+'😀')))
  assert.doesNotThrow(()=>encodeURIComponent(order.normalizeItemNote('a\ud800b')))
})

test('adding and exact repeat quantities keep other instructions and prices independent',()=>{
  let lines=order.addOrderLine([],target('No pickles'))
  lines=order.addOrderLine(lines,target('Cut in half'))
  lines=order.addOrderLine(lines,target('No pickles'))
  lines=order.addOrderLine(lines,target('No pickles',{extraIds:['cheese']}))
  assert.equal(lines.length,3)
  assert.deepEqual(lines.map(line=>line.quantity),[2,1,1])
  lines=order.setOrderLineQuantity(lines,lines[0],1)
  assert.deepEqual(lines.map(line=>line.quantity),[1,1,1])
  const resolved=order.resolveLines(lines,[item])
  assert.equal(order.orderTotal(resolved),650000)
  assert.equal(order.orderTotalSecondary(resolved),9.5)
  lines=order.setOrderLineQuantity(lines,lines[0],0)
  assert.equal(lines.length,2)
  assert.equal(lines[0].note,'Cut in half')
})

test('note edits merge matching configurations safely, clear notes and never drop capped quantities',()=>{
  const original=[target('A',{quantity:2}),target('B',{quantity:3}),target('A',{variantIndex:1})]
  const edited=order.updateOrderLineNote(original,original[0],' B ')
  assert.equal(edited.length,2)
  assert.equal(edited[0].quantity,5)
  assert.equal(edited[0].note,'B')
  assert.equal(original[0].quantity,2)
  const cleared=order.updateOrderLineNote(edited,edited[0],'   ')
  assert.equal(cleared[0].note,'')
  const capped=[target('A',{quantity:70}),target('B',{quantity:40})]
  assert.equal(order.canUpdateOrderLineNote(capped,capped[0],'B'),false)
  assert.strictEqual(order.updateOrderLineNote(capped,capped[0],'B'),capped)
  assert.equal(order.addOrderLine([target('A',{quantity:99})],target('A'))[0].quantity,99)
  assert.strictEqual(order.setOrderLineQuantity(capped,capped[0],NaN),capped)
})

test('session hydration preserves new notes, accepts old baskets and rejects malformed lines',()=>{
  const saved=[target('بلا كبيس'),{itemId:'old',variantIndex:0,quantity:2},target('X',{variantIndex:-1}),target('X',{quantity:0}),{itemId:9,quantity:2}]
  const parsed=order.parseOrderLines(JSON.stringify(saved))
  assert.equal(parsed.length,2)
  assert.equal(parsed[0].note,'بلا كبيس')
  assert.equal(parsed[1].note,'')
  assert.deepEqual(parsed[1].extraIds,[])
  assert.deepEqual(order.parseOrderLines('{broken'),[])
  assert.deepEqual(order.parseOrderLines('{}'),[])
  assert.deepEqual(order.parseOrderLines(null),[])
  assert.equal(order.parseOrderLines(JSON.stringify([target(123,{quantity:500,extraIds:['b',3,'a','b']})]))[0].quantity,99)
  assert.equal(order.parseOrderLines(JSON.stringify([target(123)]))[0].note,'')
})

test('live resolution preserves instructions and stored line identity after extra removal, but drops sold-out dishes',()=>{
  const source=target('No pickles',{extraIds:['cheese']})
  const result=order.resolveLines([source],[{...item,extras:[]}])[0]
  assert.equal(result.note,source.note)
  assert.equal(key(result),key(source))
  assert.equal(result.extras.length,0)
  assert.equal(result.unitPrice,200000)
  assert.equal(order.resolveLines([source],[{...item,available:false}]).length,0)
})

test('English and Arabic WhatsApp drafts attach item notes below each dish and keep the separate general note',()=>{
  const lines=order.resolveLines([target('No pickles'),target('قطّعلي ياها',{extraIds:['cheese']})],[item])
  for(const language of ['en','ar']) {
    const message=order.buildOrderMessage({restaurantName:'Demo',lines,language,formatPrice:value=>String(value),note:'Call on arrival'})
    assert.match(message,/200000\n  (Note|ملاحظة): No pickles/)
    assert.match(message,/250000\n  (Note|ملاحظة): قطّعلي ياها/)
    assert.match(message,/(Total|المجموع): 450000/)
    assert.ok(message.endsWith('Call on arrival'))
    const link=order.whatsappOrderLink('+961 70 123 456',message)
    assert.equal(new URL(link).searchParams.get('text'),message)
  }
})

test('oversized orders retain every dish/note and expose a size guard instead of silently truncating the draft',()=>{
  const lines=order.resolveLines(Array.from({length:30},(_,index)=>target('ملاحظة '+index,{extraIds:[]})),[item])
  const message=order.buildOrderMessage({restaurantName:'Demo',lines,language:'ar',formatPrice:String,note:'Keep the entire order'})
  assert.equal(order.orderMessageTooLong(message),true)
  for(let index=0;index<30;index++)assert.ok(message.includes('ملاحظة '+index))
  assert.equal((message.match(/1 ×/g)??[]).length,30)
  assert.equal(order.orderMessageTooLong('x'.repeat(order.MAX_ENCODED_TEXT)),false)
  assert.equal(order.orderMessageTooLong('x'.repeat(order.MAX_ENCODED_TEXT+1)),true)
})

test('every design uses the shared first-add customizer; basket edits pass the exact note identity',()=>{
  const add=read('components/AddToOrder.tsx'),bar=read('components/OrderBar.tsx')
  assert.match(add,/showModal\(\)/)
  assert.match(add,/onCancel=/)
  assert.match(add,/opener\.focus\(\)/)
  assert.match(add,/ordering\.add\(item\.id, selectedVariantIndex, selectedExtraIds, note\)/)
  assert.match(add,/repeatLine\.extraIds, repeatLine\.note/)
  assert.match(add,/بدّك تعدّل شي/)
  assert.match(add,/maxLength=\{MAX_ITEM_NOTE_LENGTH\}/)
  assert.match(bar,/order\.updateNote\(line, itemNote\)/)
  assert.match(bar,/line\.quantity - 1, line\.extraIds, line\.note/)
  assert.match(bar,/tooLong \?/)
  for(const template of readdirSync(new URL('../src/templates/',import.meta.url)).filter(name=>/^[A-Z]/.test(name)))assert.match(read(`templates/${template}/index.tsx`),/<AddToOrder/)
})

async function renderedComponent(name) {
  let code=compile(read(`components/${name}.tsx`).replace('useState(false)','useState(true)'))
  code=code.replace(/import styles from '[^']+\.css';/, 'const styles = {};')
    .replace(/from (['"])(react|react\/jsx-runtime|lucide-react)\1/g,(_,quote,path)=>'from '+JSON.stringify(import.meta.resolve(path)))
    .replace("'../lib/order'",JSON.stringify(orderUri)).replace("'../lib/pricing'",JSON.stringify(pricingUri))
  if(name==='AddToOrder')code='const document={body:null};\n'+code.replace("'react-dom'",JSON.stringify(uri('export const createPortal=node=>node;')))
  return (await import(uri(code)))[name]
}

test('real bilingual customization sheet renders sizes, priced extras and an optional accessible item note',async()=>{
  const AddToOrder=await renderedComponent('AddToOrder')
  for(const language of ['en','ar']) {
    const html=renderToStaticMarkup(createElement(AddToOrder,{item,variantIndex:0,ordering:{lines:[],quantityOf:()=>0},t:(en,ar)=>language==='ar'?ar:en,formatPrice:String,rtl:language==='ar'}))
    assert.match(html,/<dialog/)
    assert.match(html,/<fieldset/)
    assert.match(html,/type="radio"/)
    assert.match(html,/<textarea[^>]*maxLength="200"/)
    assert.match(html,/aria-describedby=/)
    assert.match(html,language==='ar'?/بدّك تعدّل شي/:/Any changes/)
    assert.match(html,language==='ar'?/جبنة/:/Cheese/)
    assert.match(html,/50000/)
  }
})

test('real basket escapes note text, shows independent notes and offers full-copy fallback without a partial URL',async()=>{
  const OrderBar=await renderedComponent('OrderBar')
  const render=(note)=>renderToStaticMarkup(createElement(OrderBar,{restaurant:{name_en:'Demo',name_ar:'تجربة',whatsapp:'+96170123456'},items:[item],order:{lines:[target(note)],count:1},language:'en',rtl:false,t:en=>en,formatPrice:String,brand:'#123',brandInk:'#fff'}))
  const html=render('<img src=x onerror=alert(1)>')
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.doesNotMatch(html,/<img src=x/)
  assert.match(html,/Edit note for Pizza/)
  assert.match(html,/Note for the restaurant/)
  const long=render('飯'.repeat(200))
  assert.match(long,/Copy full order/)
  assert.match(long,/Open WhatsApp and paste/)
  assert.doesNotMatch(long,/href="https:\/\/wa\.me\/[^\"]+\?text=[^\"]+"/)
})

test('full-order clipboard success and refusal both retain the exact complete draft',async()=>{
  const source=read('components/OrderBar.tsx')
  const ast=ts.createSourceFile('OrderBar.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  let declaration
  function visit(node) {
    if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='copyFullOrder')declaration=node.getText(ast)
    ts.forEachChild(node,visit)
  }
  visit(ast)
  assert.ok(declaration)
  const {harness}=await import(uri(compile(`export async function harness(message,fail) {let copied=null,manual=null,written=null;const setCopiedMessage=value=>copied=value,setManualCopyMessage=value=>manual=value;const navigator={clipboard:{writeText:async value=>{if(fail)throw Error('Clipboard denied');written=value}}};const ${declaration};await copyFullOrder();return {copied,manual,written};}`)))
  const message='Full order\nقطّعلي ياها\n'+'飯'.repeat(200)
  assert.deepEqual(await harness(message,false),{copied:message,manual:'',written:message})
  assert.deepEqual(await harness(message,true),{copied:null,manual:message,written:null})
})
