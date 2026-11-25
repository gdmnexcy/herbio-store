import crypto from 'node:crypto';
import { Pool } from 'pg';

const port = Number(process.env.PORT || 3000);
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the HERBIO platform');
const db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
const adminPassword = process.env.ADMIN_PASSWORD;
const ready = (async () => { const schema = await Bun.file('./db/schema.sql').text(); await db.query(schema); })();

const html = (title: string, body: string) => `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | HERBIO</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Manrope:wght@500;600;700&display=swap" rel="stylesheet"><style>:root{--f:#1f4d36;--i:#163327;--c:#f7f5ed;--s:#e6efe1;--l:#d2dfcd}*{box-sizing:border-box}body{margin:0;background:var(--c);color:var(--i);font:16px 'DM Sans',sans-serif}.bar{background:var(--f);color:#fff;padding:15px 5vw;letter-spacing:.08em;text-align:center}.admin{max-width:1180px;margin:0 auto;padding:48px 28px}.brand{font:600 28px Manrope;letter-spacing:.14em}.eyebrow{letter-spacing:.18em;font-size:12px;font-weight:700;color:#527664}.hero{padding:48px 0 35px;border-bottom:1px solid var(--l)}h1{font:600 clamp(36px,5vw,66px)/1.05 Manrope;margin:12px 0}p{line-height:1.6}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:32px 0}.card{background:#fffefa;border:1px solid var(--l);padding:24px;min-height:170px}.card h2{font:600 20px Manrope;margin:10px 0}.button{display:inline-block;background:var(--f);color:white;border:0;padding:12px 17px;font:600 14px 'DM Sans';text-decoration:none;cursor:pointer}.muted{color:#587062}input,textarea,select{width:100%;margin:5px 0 13px;padding:11px;border:1px solid var(--l);background:#fffefa;font:inherit}.panel{margin-top:30px;padding:25px;background:#fffefa;border:1px solid var(--l)}@media(max-width:700px){.grid{grid-template-columns:1fr}.admin{padding:28px 18px}}</style></head><body>${body}</body></html>`;

const adminPage = html('Адмінка', `
<div class="bar">HERBIO · КЕРУВАННЯ МАГАЗИНОМ</div>
<main class="admin">
  <div class="brand">HERBIO <span>ADMIN</span></div>
  <section class="hero compact">
    <p class="eyebrow">КАТАЛОГ</p>
    <h1>Керування товарами</h1>
    <p class="muted">Редагуйте назви, ціни, описи й категорії. Приховані товари не показуються в нових вітринах та лендингах.</p>
  </section>
  <section class="toolbar">
    <button class="button" id="new-product">+ Додати товар</button>
    <span id="notice" class="muted"></span>
  </section>
  <section class="panel" id="editor" hidden></section>
  <section class="products" id="products"><p class="muted">Завантаження товарів…</p></section>
</main>
<style>
  .compact{padding-bottom:18px}.toolbar{display:flex;gap:16px;align-items:center;margin:18px 0}.products{display:grid;gap:14px}.product{background:#fff;border:1px solid var(--l);padding:20px;border-radius:12px}.product-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.product h2{margin:0;font-size:22px}.product p{margin:7px 0}.tag{padding:5px 9px;border-radius:999px;background:#e6efe1;font-size:12px;font-weight:700}.tag.off{background:#eee;color:#666}.actions{display:flex;gap:10px;align-items:center;margin-top:14px}.secondary,.danger{border:1px solid var(--f);background:transparent;color:var(--f);padding:10px 14px;border-radius:7px;font-weight:700;cursor:pointer}.danger{border-color:#a13a33;color:#a13a33}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.form-grid .wide{grid-column:1/-1}input,textarea,select{width:100%;padding:12px;border:1px solid var(--l);border-radius:7px;font:inherit}textarea{min-height:88px}.check{display:flex;gap:8px;align-items:center}.check input{width:auto}@media(max-width:600px){.form-grid{grid-template-columns:1fr}.product-head{flex-direction:column}.actions{flex-wrap:wrap}}
</style>
<script>
const productsEl=document.getElementById('products'), editor=document.getElementById('editor'), notice=document.getElementById('notice');
const money=v=>new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',maximumFractionDigits:0}).format(Number(v)/100);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function api(path,options={}){const r=await fetch(path,{headers:{'content-type':'application/json'},...options});const data=await r.json();if(!r.ok)throw new Error(data.error||'Помилка збереження');return data}
function message(t,bad=false){notice.textContent=t;notice.style.color=bad?'#a13a33':'#1f4d36';setTimeout(()=>notice.textContent='',5000)}
function form(product={active:true}){editor.hidden=false;editor.innerHTML='<p class="eyebrow">'+(product.id?'РЕДАГУВАННЯ':'НОВИЙ ТОВАР')+'</p><h2>'+ (product.id?'Змінити товар':'Додати товар')+'</h2><form id="product-form" class="form-grid"><input name="name" required placeholder="Назва" value="'+esc(product.name)+'"><input name="category" placeholder="Категорія" value="'+esc(product.category)+'"><input name="price" required type="number" min="0" step="1" placeholder="Ціна, ₴" value="'+(product.price_kopecks?product.price_kopecks/100:'')+'"><input name="format" placeholder="Формат" value="'+esc(product.format)+'"><textarea class="wide" name="shortDescription" placeholder="Короткий опис">'+esc(product.short_description)+'</textarea><textarea class="wide" name="description" placeholder="Повний опис">'+esc(product.description)+'</textarea><input class="wide" name="note" placeholder="Додаткова примітка" value="'+esc(product.note)+'"><label class="check wide"><input name="active" type="checkbox" '+(product.active?'checked':'')+'> Показувати на вітрині</label><div class="wide actions"><button class="button">Зберегти</button><button class="secondary" type="button" id="cancel">Скасувати</button></div></form>';document.getElementById('cancel').onclick=()=>editor.hidden=true;document.getElementById('product-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const body={name:f.get('name'),category:f.get('category'),price:Number(f.get('price')),format:f.get('format'),shortDescription:f.get('shortDescription'),description:f.get('description'),note:f.get('note'),active:f.get('active')==='on'};try{await api(product.id?'/api/admin/products/'+product.id:'/api/admin/products',{method:product.id?'PATCH':'POST',body:JSON.stringify(body)});editor.hidden=true;message(product.id?'Товар оновлено':'Товар додано');load()}catch(err){message(err.message,true)}}}
function card(p){return '<article class="product"><div class="product-head"><div><p class="eyebrow">'+esc(p.category||'HERBIO')+'</p><h2>'+esc(p.name)+'</h2><p>'+esc(p.short_description||p.description||'Без опису')+'</p><strong>'+money(p.price_kopecks)+'</strong></div><span class="tag '+(p.active?'':'off')+'">'+(p.active?'На вітрині':'Прихований')+'</span></div><div class="actions"><button class="secondary" data-edit="'+p.id+'">Редагувати</button><button class="secondary" data-toggle="'+p.id+'">'+(p.active?'Сховати':'Показати')+'</button><button class="danger" data-delete="'+p.id+'">Видалити</button></div></article>'}
let cached=[];
async function load(){try{cached=await api('/api/admin/products');productsEl.innerHTML=cached.length?cached.map(card).join(''):'<p class="muted">Товарів ще немає.</p>';document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>form(cached.find(p=>p.id===b.dataset.edit)));document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{const p=cached.find(x=>x.id===b.dataset.toggle);form({...p,active:!p.active});document.getElementById('product-form').requestSubmit()});document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{const p=cached.find(x=>x.id===b.dataset.delete);if(!confirm('Видалити «'+p.name+'» назавжди? Це неможливо скасувати.'))return;try{await api('/api/admin/products/'+p.id,{method:'DELETE'});message('Товар видалено');load()}catch(err){message(err.message,true)}})}catch(err){productsEl.innerHTML='<p class="muted">Не вдалося завантажити товари.</p>';message(err.message,true)}}
document.getElementById('new-product').onclick=()=>form();load();
</script>`);

const requireAdmin = (request: Request) => {
  const auth = request.headers.get('authorization') || '';
  const encoded = auth.match(/^Basic\s+(.+)$/i)?.[1];
  const token = encoded ? Buffer.from(encoded, 'base64').toString('utf8').split(':').slice(1).join(':') : auth.replace(/^Bearer\s+/i, '');
  return Boolean(adminPassword && token && token.length === adminPassword.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(adminPassword)));
};
const json = (data: unknown, status = 200) => Response.json(data, { status });
const escape = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));
const landingMarkup = (landing: any, product: any, pixelId?: string) => html(landing.meta_title || landing.title, `<div class="bar">Безкоштовна доставка від 2 000 ₴ · Турбота — у вашому ритмі</div><main class="admin"><div class="brand">HERBIO</div><section class="hero"><p class="eyebrow">НАТУРАЛЬНИЙ WELLNESS</p><h1>${escape(landing.hero_title)}</h1><p class="muted">${escape(landing.hero_text)}</p><a class="button" href="#buy">${escape(landing.cta_label || 'Купити')}</a></section><section class="grid"><article class="card"><p class="eyebrow">${escape(product?.category || 'HERBIO')}</p><h2>${escape(product?.name || landing.title)}</h2><p>${escape(product?.short_description || product?.description || '')}</p><p><strong>${product ? `${Number(product.price_kopecks / 100).toLocaleString('uk-UA')} ₴` : ''}</strong></p><button class="button" id="buy">${escape(landing.cta_label || 'Купити')}</button></article><article class="card"><p class="eyebrow">ПРОЗОРО</p><h2>Формула для вашого ритму</h2><p>Склад, формат та спосіб використання редагуються в адмінці.</p></article><article class="card"><p class="eyebrow">ДОСТАВКА</p><h2>Дбайливо до ваших дверей</h2><p>Безкоштовна доставка для замовлень від 2 000 ₴.</p></article></section></main>${pixelId ? `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${escape(pixelId)}');fbq('track','PageView');fbq('track','ViewContent',{content_ids:['${escape(product?.slug || '')}'],content_type:'product',currency:'UAH',value:${Number(product?.price_kopecks || 0) / 100}});</script>` : ''}`);

async function createProduct(body: any) {
  const slug = String(body.slug || body.name || '').toLowerCase().trim().replace(/[^a-z0-9а-яіїєґ]+/gi, '-').replace(/^-|-$/g, '');
  const { rows } = await db.query('INSERT INTO products(slug,name,category,short_description,description,format,note,price_kopecks) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [slug, body.name, body.category, body.shortDescription || '', body.description || '', body.format || '', body.note || '', Math.round(Number(body.price || 0) * 100)]);
  return rows[0];
}

Bun.serve({ port, async fetch(request) {
  await ready;
  const url = new URL(request.url);
  if (url.pathname === '/health') return new Response('ok');
  if (url.pathname === '/') return Response.redirect(new URL('/admin', url), 302);
  if (url.pathname === '/admin') {
    if (!requireAdmin(request)) return new Response('Authentication required', { status: 401, headers: { 'www-authenticate': 'Basic realm="HERBIO Admin"' } });
    return new Response(adminPage, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  if (url.pathname.startsWith('/api/admin/')) {
    if (!requireAdmin(request)) return json({ error: 'Unauthorized' }, 401);
    if (url.pathname === '/api/admin/products' && request.method === 'GET') return json((await db.query('SELECT * FROM products ORDER BY updated_at DESC')).rows);
    if (url.pathname === '/api/admin/products' && request.method === 'POST') return json(await createProduct(await request.json()), 201);
    const productMatch = url.pathname.match(/^\/api\/admin\/products\/([0-9a-f-]+)$/);
    if (productMatch && request.method === 'PATCH') {
      const b:any = await request.json();
      const { rows } = await db.query('UPDATE products SET name=COALESCE($1,name), category=COALESCE($2,category), short_description=COALESCE($3,short_description), description=COALESCE($4,description), format=COALESCE($5,format), note=COALESCE($6,note), price_kopecks=COALESCE($7,price_kopecks), active=COALESCE($8,active), updated_at=now() WHERE id=$9 RETURNING *', [b.name ?? null, b.category ?? null, b.shortDescription ?? null, b.description ?? null, b.format ?? null, b.note ?? null, b.price === undefined ? null : Math.round(Number(b.price) * 100), typeof b.active === 'boolean' ? b.active : null, productMatch[1]]);
      if (!rows[0]) return json({ error: 'Товар не знайдено' }, 404);
      return json(rows[0]);
    }
    if (productMatch && request.method === 'DELETE') {
      const linked = await db.query('SELECT 1 FROM order_items WHERE product_id=$1 LIMIT 1', [productMatch[1]]);
      if (linked.rows[0]) return json({ error: 'Товар є в історії замовлень. Сховайте його з вітрини замість видалення.' }, 409);
      const result = await db.query('DELETE FROM products WHERE id=$1 RETURNING id', [productMatch[1]]);
      if (!result.rows[0]) return json({ error: 'Товар не знайдено' }, 404);
      return json({ ok: true });
    }
    if (url.pathname === '/api/admin/landings' && request.method === 'GET') return json((await db.query('SELECT l.*, p.name AS product_name FROM landing_pages l LEFT JOIN products p ON p.id=l.product_id ORDER BY l.updated_at DESC')).rows);
    if (url.pathname === '/api/admin/landings' && request.method === 'POST') { const b:any=await request.json(); const { rows }=await db.query('INSERT INTO landing_pages(slug,product_id,title,meta_title,meta_description,hero_title,hero_text,cta_label) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[b.slug,b.productId||null,b.title,b.metaTitle||b.title,b.metaDescription||'',b.heroTitle||b.title,b.heroText||'',b.ctaLabel||'Купити']); return json(rows[0],201); }
    return json({ error: 'Not found' }, 404);
  }
  if (url.pathname.startsWith('/l/')) {
    const slug = url.pathname.slice(3);
    const result = await db.query('SELECT * FROM landing_pages WHERE slug=$1 AND status=$2', [slug, 'published']);
    if (!result.rows[0]) return new Response('Landing not found', { status: 404 });
    const landing = result.rows[0];
    const product = landing.product_id ? (await db.query('SELECT * FROM products WHERE id=$1', [landing.product_id])).rows[0] : null;
    const integration = (await db.query('SELECT pixel_id FROM meta_integrations WHERE landing_id=$1 AND enabled=true', [landing.id])).rows[0];
    return new Response(landingMarkup(landing, product, integration?.pixel_id), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  return json({ error: 'Not found' }, 404);
}});
