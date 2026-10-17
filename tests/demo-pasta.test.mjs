import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const seed = readFileSync(new URL('../supabase/seeds/demo_pasta.sql', import.meta.url), 'utf8')
test('demo pasta seed reuses 13 bilingual gallery photos, preserves content and is repeat-safe', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create table public.restaurants(id uuid primary key,slug text,currency text);
      create table public.gallery_categories(id uuid primary key,active boolean);
      create table public.gallery_images(id uuid primary key,category_id uuid,active boolean,name_en text,name_ar text,image_url text);
      create table public.menu_categories(id uuid primary key default gen_random_uuid(),restaurant_id uuid,name_en text,name_ar text,sort_order integer);
      create table public.menu_items(id uuid primary key default gen_random_uuid(),restaurant_id uuid,category_id uuid,name_en text,name_ar text,price bigint,image_url text,gallery_image_id uuid,available boolean,sort_order integer);
      insert into public.restaurants values('00000000-0000-0000-0000-000000000001','demo','LBP');
      insert into public.gallery_categories values('4e5a41ae-e87d-4a82-94f5-9098c0853992',true);
      insert into public.gallery_images select gen_random_uuid(),'4e5a41ae-e87d-4a82-94f5-9098c0853992',true,'Pasta '||n,'باستا '||n,'https://example.com/'||n||'.webp' from generate_series(1,13) n;
      insert into public.menu_categories(restaurant_id,name_en,name_ar,sort_order) values('00000000-0000-0000-0000-000000000001','Pizza','بيتزا',8);
      insert into public.menu_items(restaurant_id,category_id,name_en,name_ar,price,available,sort_order) select restaurant_id,id,'Existing','موجود',250000,false,3 from public.menu_categories;
      insert into public.menu_categories(restaurant_id,name_en,name_ar,sort_order) values('00000000-0000-0000-0000-000000000001','Manakish','مناقيش',1);
      update public.gallery_images set id='55eab2b8-d33b-4d52-bab0-9882cdf9254b',name_en='Fettuccine Alfredo',name_ar='فيتوتشيني ألفريدو' where name_en='Pasta 1';
      insert into public.menu_items(restaurant_id,category_id,name_en,name_ar,price,image_url,gallery_image_id,available,sort_order) select c.restaurant_id,c.id,g.name_en,g.name_ar,700000,g.image_url,g.id,true,4 from public.menu_categories c cross join public.gallery_images g where c.name_en='Manakish' and g.name_en='Fettuccine Alfredo';
    `)
    const snapshot = async () => (await db.query('select (select jsonb_agg(c order by id) from public.menu_categories c) as categories,(select jsonb_agg(i order by id) from public.menu_items i) as items,(select jsonb_agg(g order by id) from public.gallery_images g) as gallery')).rows[0]
    const before = await snapshot()
    await db.exec(seed)
    const result = await snapshot()
    assert.equal(result.categories.length, 3)
    assert.equal(result.items.length, 14)
    assert.deepEqual(result.gallery, before.gallery)
    for (const category of before.categories) assert.deepEqual(result.categories.find(c => c.id === category.id), category)
    const original = before.items.find(i => i.name_en === 'Existing')
    assert.deepEqual(result.items.find(i => i.id === original.id), original)
    const pasta = result.categories.find(c => c.name_en === 'Pasta')
    assert.equal(pasta.name_ar, 'باستا'); assert.equal(pasta.sort_order, 9)
    const dishes = result.items.filter(i => i.category_id === pasta.id)
    const oldAlfredo = before.items.find(i => i.name_en === 'Fettuccine Alfredo')
    assert.equal(dishes.find(i => i.name_en === oldAlfredo.name_en).id, oldAlfredo.id)
    assert.equal(result.items.filter(i => i.name_en === oldAlfredo.name_en).length, 1)
    assert.equal(new Set(dishes.map(i => i.gallery_image_id)).size, 13)
    for (const dish of dishes) {
      const photo = result.gallery.find(g => g.id === dish.gallery_image_id)
      assert.equal(dish.name_en, photo.name_en); assert.equal(dish.name_ar, photo.name_ar)
      assert.equal(dish.image_url, photo.image_url); assert.equal(dish.price, 500000); assert.equal(dish.available, true)
    }
    await db.exec(seed)
    assert.deepEqual(await snapshot(), result)
    await db.exec("update public.restaurants set slug='not-demo'")
    await assert.rejects(db.exec(seed), /Expected LBP demo restaurant/)
    await db.exec("update public.restaurants set slug='demo'; update public.gallery_images set active=false where id=(select id from public.gallery_images limit 1)")
    await assert.rejects(db.exec(seed), /Expected 13 active/)
    assert.equal((await snapshot()).items.length, 14)
  } finally { await db.close() }
})
