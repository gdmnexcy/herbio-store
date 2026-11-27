import crypto from 'node:crypto';
import { Pool } from 'pg';

const port = Number(process.env.PORT || 3000);
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the HERBIO platform');
const db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
const adminPassword = process.env.ADMIN_PASSWORD;
const ready = (async () => { const schema = await Bun.file('./db/schema.sql').text(); await db.query(schema); })();
void ready.then(async()=>{const token=process.env.TELEGRAM_BOT_TOKEN||'';if(!token)return;try{await fetch('https://api.telegram.org/bot'+token+'/setWebhook',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://herbio-app-production.up.railway.app/api/public/telegram/webhook',allowed_updates:['message']})})}catch{}});

const html = (title: string, body: string) => `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | HERBIO</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Manrope:wght@500;600;700&display=swap" rel="stylesheet"><style>:root{--f:#1f4d36;--i:#163327;--c:#f7f5ed;--s:#e6efe1;--l:#d2dfcd}*{box-sizing:border-box}body{margin:0;background:var(--c);color:var(--i);font:16px 'DM Sans',sans-serif}.bar{background:var(--f);color:#fff;padding:15px 5vw;letter-spacing:.08em;text-align:center}.admin{max-width:1180px;margin:0 auto;padding:48px 28px}.brand{font:600 28px Manrope;letter-spacing:.14em}.eyebrow{letter-spacing:.18em;font-size:12px;font-weight:700;color:#527664}.hero{padding:48px 0 35px;border-bottom:1px solid var(--l)}h1{font:600 clamp(36px,5vw,66px)/1.05 Manrope;margin:12px 0}p{line-height:1.6}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:32px 0}.card{background:#fffefa;border:1px solid var(--l);padding:24px;min-height:170px}.card h2{font:600 20px Manrope;margin:10px 0}.button{display:inline-block;background:var(--f);color:white;border:0;padding:12px 17px;font:600 14px 'DM Sans';text-decoration:none;cursor:pointer}.muted{color:#587062}input,textarea,select{width:100%;margin:5px 0 13px;padding:11px;border:1px solid var(--l);background:#fffefa;font:inherit}.panel{margin-top:30px;padding:25px;background:#fffefa;border:1px solid var(--l)}@media(max-width:700px){.grid{grid-template-columns:1fr}.admin{padding:28px 18px}}</style></head><body>${body}</body></html>`;

const adminPage = html('Адмінка', `
<div class="bar">HERBIO · КЕРУВАННЯ МАГАЗИНОМ</div>
<main class="admin">
  <div class="brand">HERBIO <span>ADMIN</span></div>
  <section class="hero compact"><p class="eyebrow">ЄДИНА CMS</p><h1>Керуйте магазином і рекламою.</h1><p class="muted">Товари, сторінки сайту й окремі рекламні лендинги — без редагування коду.</p></section>
  <nav class="tabs"><button data-tab="products" class="active">Товари</button><button data-tab="landings">Лендинги</button><button data-tab="pages">Сторінки сайту</button></nav>
  <section class="toolbar"><button class="button" id="create">+ Додати товар</button><span id="notice" class="muted"></span></section>
  <section class="panel" id="editor" hidden></section><section class="products" id="items"><p class="muted">Завантаження…</p></section>
</main>
<style>
.compact{padding-bottom:16px}.tabs{display:flex;gap:8px;border-bottom:1px solid var(--l);padding-bottom:14px}.tabs button,.secondary,.danger{border:1px solid var(--f);background:#fff;color:var(--f);padding:10px 14px;border-radius:7px;font-weight:700;cursor:pointer}.tabs button.active{background:var(--f);color:#fff}.toolbar{display:flex;gap:16px;align-items:center;margin:18px 0}.products{display:grid;gap:14px}.product{background:#fff;border:1px solid var(--l);padding:20px;border-radius:12px}.product-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.product h2{margin:0;font-size:22px}.product p{margin:7px 0}.tag{padding:5px 9px;border-radius:999px;background:#e6efe1;font-size:12px;font-weight:700}.tag.off{background:#eee;color:#666}.actions{display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap}.danger{border-color:#a13a33;color:#a13a33}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.form-grid .wide{grid-column:1/-1}input,textarea,select{width:100%;padding:12px;border:1px solid var(--l);border-radius:7px;font:inherit}textarea{min-height:88px}.check{display:flex;gap:8px;align-items:center}.check input{width:auto}@media(max-width:600px){.form-grid{grid-template-columns:1fr}.product-head{flex-direction:column}.tabs{overflow:auto}}
</style>
<script>
const items=document.getElementById('items'),editor=document.getElementById('editor'),notice=document.getElementById('notice'),create=document.getElementById('create');let tab='products',cache=[];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));const money=v=>new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',maximumFractionDigits:0}).format(Number(v)/100);
async function api(path,opt={}){const r=await fetch(path,{headers:{'content-type':'application/json'},...opt});const d=await r.json();if(!r.ok)throw Error(d.error||'Помилка збереження');return d}function msg(t,b=false){notice.textContent=t;notice.style.color=b?'#a13a33':'#1f4d36';setTimeout(()=>notice.textContent='',5000)}function cancel(){editor.hidden=true}
function productForm(p={active:true}){editor.hidden=false;editor.innerHTML='<p class="eyebrow">'+(p.id?'РЕДАГУВАННЯ ТОВАРУ':'НОВИЙ ТОВАР')+'</p><h2>'+ (p.id?'Змінити товар':'Додати товар')+'</h2><form id="form" class="form-grid"><input name="name" required placeholder="Назва" value="'+esc(p.name)+'"><input name="category" placeholder="Категорія" value="'+esc(p.category)+'"><input name="price" required type="number" min="0" step="1" placeholder="Ціна, ₴" value="'+(p.price_kopecks?p.price_kopecks/100:'')+'"><input name="format" placeholder="Формат" value="'+esc(p.format)+'"><textarea class="wide" name="shortDescription" placeholder="Короткий опис">'+esc(p.short_description)+'</textarea><textarea class="wide" name="description" placeholder="Повний опис">'+esc(p.description)+'</textarea><input class="wide" name="note" placeholder="Примітка" value="'+esc(p.note)+'"><label class="wide">Фото товару <input name="image" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="check wide"><input name="isHot" type="checkbox" '+(p.is_hot?'checked':'')+'> HOT · показувати в топ-3 на головній</label><label class="check wide"><input name="active" type="checkbox" '+(p.active?'checked':'')+'> Показувати на вітрині</label><div class="wide actions"><button class="button">Зберегти</button><button class="secondary" type="button" id="cancel">Скасувати</button></div></form>';document.getElementById('cancel').onclick=cancel;document.getElementById('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),body={name:f.get('name'),category:f.get('category'),price:Number(f.get('price')),format:f.get('format'),shortDescription:f.get('shortDescription'),description:f.get('description'),note:f.get('note'),active:f.get('active')==='on',isHot:f.get('isHot')==='on'};const file=f.get('image');try{if(file&&file.name){const fd=new FormData();fd.append('file',file);const up=await fetch('/api/admin/media',{method:'POST',body:fd});const media=await up.json();if(!up.ok)throw Error(media.error||'Не вдалося завантажити фото');body.imageId=media.id}await api(p.id?'/api/admin/products/'+p.id:'/api/admin/products',{method:p.id?'PATCH':'POST',body:JSON.stringify(body)});cancel();msg('Товар збережено');load()}catch(e){msg(e.message,true)}}}
function landingForm(l={status:'draft',upsell_product_ids:[]}){editor.hidden=false;const opts=cache.products.map(p=>'<option value="'+p.id+'" '+(p.id===l.product_id?'selected':'')+'>'+esc(p.name)+'</option>').join('');const ups=cache.products.filter(p=>p.id!==l.product_id).map(p=>'<option value="'+p.id+'" '+((l.upsell_product_ids||[]).includes(p.id)?'selected':'')+'>'+esc(p.name)+'</option>').join('');editor.innerHTML='<p class="eyebrow">'+(l.id?'РЕДАГУВАННЯ ЛЕНДИНГУ':'НОВИЙ ЛЕНДИНГ')+'</p><h2>'+ (l.id?'Змінити рекламну сторінку':'Створити лендинг')+'</h2><form id="form" class="form-grid"><input name="slug" required placeholder="URL: spirulina" value="'+esc(l.slug)+'"><select name="productId"><option value="">Без товару</option>'+opts+'</select><input name="title" required placeholder="Назва в адмінці" value="'+esc(l.title)+'"><select name="status"><option value="draft" '+(l.status==='draft'?'selected':'')+'>Чернетка</option><option value="published" '+(l.status==='published'?'selected':'')+'>Опубліковано</option></select><input class="wide" name="heroTitle" required placeholder="Головний заголовок" value="'+esc(l.hero_title)+'"><textarea class="wide" name="heroText" placeholder="Текст під заголовком">'+esc(l.hero_text)+'</textarea><small class="wide">Форматування: <b>**жирний текст**</b> · <i>*курсив*</i> · новий абзац — порожній рядок.</small><label class="wide">Фото обкладинки лендингу <input name="heroImage" type="file" accept="image/png,image/jpeg,image/webp"></label><input name="ctaLabel" placeholder="Текст кнопки покупки" value="'+esc(l.cta_label||'Купити')+'"><input name="catalogCtaLabel" placeholder="Текст кнопки каталогу" value="'+esc(l.catalog_cta_label||'Переглянути каталог')+'"><label class="wide">Допродажі: оберіть до 3 товарів <select name="upsells" multiple size="4">'+ups+'</select></label><input name="b1t" placeholder="Блок 1 — заголовок" value="'+esc(l.benefit_1_title)+'"><textarea name="b1x" placeholder="Блок 1 — текст">'+esc(l.benefit_1_text)+'</textarea><input name="b2t" placeholder="Блок 2 — заголовок" value="'+esc(l.benefit_2_title)+'"><textarea name="b2x" placeholder="Блок 2 — текст">'+esc(l.benefit_2_text)+'</textarea><input name="b3t" placeholder="Блок 3 — заголовок" value="'+esc(l.benefit_3_title)+'"><textarea name="b3x" placeholder="Блок 3 — текст">'+esc(l.benefit_3_text)+'</textarea><input class="wide" name="metaTitle" placeholder="Meta title" value="'+esc(l.meta_title)+'"><textarea class="wide" name="metaDescription" placeholder="Meta description">'+esc(l.meta_description)+'</textarea><div class="wide actions"><button class="button">Зберегти</button><button class="secondary" type="button" id="cancel">Скасувати</button></div></form>';document.getElementById('cancel').onclick=cancel;document.getElementById('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),body=Object.fromEntries(f);body.upsellProductIds=f.getAll('upsells').slice(0,3);body.benefit1Title=f.get('b1t');body.benefit1Text=f.get('b1x');body.benefit2Title=f.get('b2t');body.benefit2Text=f.get('b2x');body.benefit3Title=f.get('b3t');body.benefit3Text=f.get('b3x');const file=f.get('heroImage');try{if(file&&file.name){const fd=new FormData();fd.append('file',file);const up=await fetch('/api/admin/media',{method:'POST',body:fd});const media=await up.json();if(!up.ok)throw Error(media.error||'Не вдалося завантажити фото');body.heroImageId=media.id}await api(l.id?'/api/admin/landings/'+l.id:'/api/admin/landings',{method:l.id?'PATCH':'POST',body:JSON.stringify(body)});cancel();msg('Лендинг збережено: herbio.store/l/'+body.slug);load()}catch(e){msg(e.message,true)}}}
function pageForm(p){editor.hidden=false;const c=p.content||{};editor.innerHTML='<p class="eyebrow">СТОРІНКА САЙТУ</p><h2>'+esc(p.title)+'</h2><form id="form" class="form-grid"><input class="wide" name="title" required placeholder="Назва сторінки" value="'+esc(p.title)+'"><input name="eyebrow" placeholder="Надзаголовок" value="'+esc(c.eyebrow)+'"><input name="headline" placeholder="Заголовок" value="'+esc(c.headline)+'"><textarea class="wide" name="lead" placeholder="Основний текст">'+esc(c.lead)+'</textarea><input class="wide" name="cta" placeholder="Текст кнопки (за потреби)" value="'+esc(c.cta)+'"><div class="wide actions"><button class="button">Зберегти тексти</button><button class="secondary" type="button" id="cancel">Скасувати</button></div></form>';document.getElementById('cancel').onclick=cancel;document.getElementById('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api('/api/admin/pages/'+p.page_key,{method:'PATCH',body:JSON.stringify({title:f.get('title'),content:{eyebrow:f.get('eyebrow'),headline:f.get('headline'),lead:f.get('lead'),cta:f.get('cta')}})});cancel();msg('Тексти сторінки збережено');load()}catch(e){msg(e.message,true)}}}
function card(x,type){if(type==='products')return '<article class="product"><div class="product-head"><div><p class="eyebrow">'+esc(x.category||'HERBIO')+'</p><h2>'+esc(x.name)+'</h2><p>'+esc(x.short_description||x.description||'Без опису')+'</p><strong>'+money(x.price_kopecks)+'</strong></div><span class="tag '+(x.active?'':'off')+'">'+(x.active?'На вітрині':'Прихований')+'</span>'+(x.is_hot?'<span class="tag">HOT</span>':'')+'</div><div class="actions"><button class="secondary" data-edit="'+x.id+'">Редагувати</button><button class="secondary" data-toggle="'+x.id+'">'+(x.active?'Сховати':'Показати')+'</button><button class="danger" data-delete="'+x.id+'">Видалити</button></div></article>';if(type==='landings')return '<article class="product"><p class="eyebrow">'+(x.status==='published'?'ОПУБЛІКОВАНО':'ЧЕРНЕТКА')+'</p><h2>'+esc(x.title)+'</h2><p>URL: /l/'+esc(x.slug)+' · Товар: '+esc(x.product_name||'не обрано')+'</p><div class="actions"><button class="secondary" data-edit="'+x.id+'">Редагувати</button>' +(x.status==='published'?'<a class="secondary" href="/l/'+esc(x.slug)+'" target="_blank">Відкрити</a>':'')+'</div></article>';return '<article class="product"><p class="eyebrow">СТОРІНКА</p><h2>'+esc(x.title)+'</h2><p>'+esc(x.content?.headline||'')+'</p><div class="actions"><button class="secondary" data-edit="'+x.page_key+'">Редагувати тексти</button></div></article>'}
async function load(){cancel();try{if(tab==='products'){cache=await api('/api/admin/products');create.textContent='+ Додати товар'}else if(tab==='landings'){const [ls,ps]=await Promise.all([api('/api/admin/landings'),api('/api/admin/products')]);cache={list:ls,products:ps};create.textContent='+ Створити лендинг'}else{cache=await api('/api/admin/pages');create.textContent='Редагуйте картки нижче'}items.innerHTML=(tab==='products'?cache:tab==='landings'?cache.list:cache).map(x=>card(x,tab)).join('')||'<p class="muted">Поки що порожньо.</p>';document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const list=tab==='products'?cache:tab==='landings'?cache.list:cache;const key=tab==='pages'?'page_key':'id';const x=list.find(q=>q[key]===b.dataset.edit);if(tab==='products')productForm(x);else if(tab==='landings')landingForm(x);else pageForm(x)});document.querySelectorAll('[data-toggle]').forEach(b=>{b.onclick=async()=>{const p=cache.find(q=>q.id===b.dataset.toggle);try{await api('/api/admin/products/'+p.id,{method:'PATCH',body:JSON.stringify({active:!p.active})});msg(p.active?'Товар приховано':'Товар показано');load()}catch(e){msg(e.message,true)}}});document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{const p=cache.find(q=>q.id===b.dataset.delete);if(!confirm('Видалити «'+p.name+'» назавжди?'))return;try{await api('/api/admin/products/'+p.id,{method:'DELETE'});msg('Товар видалено');load()}catch(e){msg(e.message,true)}})}catch(e){items.innerHTML='<p class="muted">Не вдалося завантажити дані.</p>';msg(e.message,true)}}
create.onclick=()=>{if(tab==='products')productForm();else if(tab==='landings')landingForm()};document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(q=>q.classList.toggle('active',q===b));load()});load();
</script>`);

const requireAdmin = (request: Request) => {
  const auth = request.headers.get('authorization') || '';
  const encoded = auth.match(/^Basic\s+(.+)$/i)?.[1];
  const token = encoded ? Buffer.from(encoded, 'base64').toString('utf8').split(':').slice(1).join(':') : auth.replace(/^Bearer\s+/i, '');
  return Boolean(adminPassword && token && token.length === adminPassword.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(adminPassword)));
};
const json = (data: unknown, status = 200) => Response.json(data, { status });
const escape = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));
const landingMarkup = (landing: any, product: any, pixelId?: string) => html(landing.meta_title || landing.title, `<div class="bar">Безкоштовна доставка від 2 000 ₴ · Турбота — у вашому ритмі</div><main class="admin"><div class="brand">HERBIO</div><section class="hero"><p class="eyebrow">НАТУРАЛЬНИЙ WELLNESS</p><h1>${escape(landing.hero_title)}</h1><p class="muted">${escape(landing.hero_text)}</p><a class="button" href="#buy">${escape(landing.cta_label || 'Купити')}</a></section><section class="grid"><article class="card">${product?.image_id ? `<img src="/media/${escape(product.image_id)}" alt="${escape(product?.name || landing.title)}" style="width:100%;max-height:340px;object-fit:cover;border-radius:10px;margin-bottom:16px">` : ''}<p class="eyebrow">${escape(product?.category || 'HERBIO')}</p><h2>${escape(product?.name || landing.title)}</h2><p>${escape(product?.short_description || product?.description || '')}</p><p><strong>${product ? `${Number(product.price_kopecks / 100).toLocaleString('uk-UA')} ₴` : ''}</strong></p><button class="button" id="buy">${escape(landing.cta_label || 'Купити')}</button></article><article class="card"><p class="eyebrow">ПРОЗОРО</p><h2>Формула для вашого ритму</h2><p>Склад, формат та спосіб використання редагуються в адмінці.</p></article><article class="card"><p class="eyebrow">ДОСТАВКА</p><h2>Дбайливо до ваших дверей</h2><p>Безкоштовна доставка для замовлень від 2 000 ₴.</p></article></section></main>${pixelId ? `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${escape(pixelId)}');fbq('track','PageView');fbq('track','ViewContent',{content_ids:['${escape(product?.slug || '')}'],content_type:'product',currency:'UAH',value:${Number(product?.price_kopecks || 0) / 100}});</script>` : ''}`);


const tokenHash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const loyaltyRate = (kopecks: number) => kopecks >= 5000000 ? 5 : kopecks >= 2500000 ? 4 : kopecks >= 1000000 ? 3 : kopecks >= 500000 ? 2 : kopecks >= 100000 ? 1 : 0;
async function currentCustomer(request: Request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { rows } = await db.query('SELECT c.* FROM auth_sessions s JOIN customers c ON c.id=s.customer_id WHERE s.token_hash=$1 AND s.expires_at>now()', [tokenHash(token)]);
  if (!rows[0]) return null;
  await db.query('UPDATE auth_sessions SET last_seen_at=now() WHERE token_hash=$1', [tokenHash(token)]);
  return rows[0];
}
async function createCustomerSession(customerId: string) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.query('INSERT INTO auth_sessions(customer_id,token_hash,expires_at) VALUES($1,$2,now()+interval \'30 days\')', [customerId, tokenHash(token)]);
  return token;
}
async function customerSummary(customerId: string) {
  const customer = (await db.query('SELECT * FROM customers WHERE id=$1', [customerId])).rows[0];
  if (!customer) return null;
  const spend = Number((await db.query("SELECT COALESCE(SUM(total_kopecks),0) AS total FROM orders WHERE customer_id=$1 AND status<>\'cancelled\'", [customerId])).rows[0].total || 0);
  return { id:customer.id, name:customer.name, email:customer.email, emailVerified:Boolean(customer.email_verified_at), phone:customer.phone, telegramUsername:customer.telegram_username, telegramUserId:customer.telegram_user_id, totalSpent:Math.round(spend/100), loyaltyRate:loyaltyRate(spend), nextThreshold:[100000,500000,1000000,2500000,5000000].find(x=>spend<x) ? Math.round(([100000,500000,1000000,2500000,5000000].find(x=>spend<x)!-spend)/100) : null };
}
function telegramFromMiniApp(initData: string) {
  const params = new URLSearchParams(initData); const hash = params.get('hash') || ''; params.delete('hash');
  const token = process.env.TELEGRAM_BOT_TOKEN || ''; if (!token || !hash) return null;
  const authDate = Number(params.get('auth_date') || 0); if (!authDate || Date.now()/1000-authDate > 86400) return null;
  const check = Array.from(params.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
  const secret = crypto.createHmac('sha256','WebAppData').update(token).digest();
  const actual = crypto.createHmac('sha256',secret).update(check).digest('hex');
  if (actual.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(hash))) return null;
  try { return JSON.parse(params.get('user') || '{}'); } catch { return null; }
}
function telegramFromWidget(body: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN || ''; const hash=String(body.hash || ''); if (!token || !hash) return null;
  const authDate=Number(body.auth_date||0); if(!authDate || Date.now()/1000-authDate>86400) return null;
  const check=Object.entries(body).filter(([k])=>k!=='hash').sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+String(v)).join('\n');
  const secret=crypto.createHash('sha256').update(token).digest();
  const actual=crypto.createHmac('sha256',secret).update(check).digest('hex');
  if(actual.length!==hash.length || !crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(hash)))return null;
  return body;
}
async function upsertTelegramCustomer(user: any) {
  if (!user?.id) return null;
  const name=[user.first_name,user.last_name].filter(Boolean).join(' ');
  const { rows }=await db.query('INSERT INTO customers(telegram_user_id,telegram_username,name,updated_at) VALUES($1,$2,$3,now()) ON CONFLICT(telegram_user_id) DO UPDATE SET telegram_username=EXCLUDED.telegram_username,name=COALESCE(NULLIF(EXCLUDED.name,\'\'),customers.name),updated_at=now() RETURNING *',[Number(user.id),user.username||null,name||null]);
  return rows[0];
}

async function createProduct(body: any) {
  const slug = String(body.slug || body.name || '').toLowerCase().trim().replace(/[^a-z0-9а-яіїєґ]+/gi, '-').replace(/^-|-$/g, '');
  const { rows } = await db.query('INSERT INTO products(slug,name,category,short_description,description,format,note,price_kopecks,image_id,is_hot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *', [slug, body.name, body.category, body.shortDescription || '', body.description || '', body.format || '', body.note || '', Math.round(Number(body.price || 0) * 100), body.imageId || null, Boolean(body.isHot)]);
  return rows[0];
}

Bun.serve({ port, async fetch(request) {
  await ready;
  const url = new URL(request.url);
  if (url.pathname === '/health') return new Response('ok');
  const mediaMatch = url.pathname.match(/^\/media\/([0-9a-f-]+)$/);
  if (mediaMatch && request.method === 'GET') {
    const { rows } = await db.query('SELECT content_type, bytes FROM media_assets WHERE id=$1', [mediaMatch[1]]);
    if (!rows[0]) return new Response('Not found', { status: 404 });
    return new Response(rows[0].bytes, { headers: { 'content-type': rows[0].content_type, 'cache-control': 'public, max-age=31536000, immutable' } });
  }
  if (url.pathname === '/api/public/products' && request.method === 'GET') {
    const { rows } = await db.query('SELECT * FROM products WHERE active=true ORDER BY created_at ASC');
    return json(rows.map(p => ({ id:p.id, slug:p.slug, name:p.name, category:p.category, short_description:p.short_description, description:p.description, format:p.format, note:p.note, price:Math.round(p.price_kopecks/100), is_hot:p.is_hot, image_url:p.image_id ? new URL('/media/' + p.image_id, url).toString() : null })));
  }
  const publicPageMatch = url.pathname.match(/^\/api\/public\/pages\/([a-z-]+)$/);
  if (publicPageMatch && request.method === 'GET') {
    const { rows } = await db.query('SELECT page_key,title,content,updated_at FROM content_pages WHERE page_key=$1', [publicPageMatch[1]]);
    if (!rows[0]) return json({ error: 'Not found' }, 404);
    return json(rows[0]);
  }
  const publicLandingMatch = url.pathname.match(/^\/api\/public\/landings\/([a-z0-9-]+)$/);
  if (publicLandingMatch && request.method === 'GET') {
    const { rows } = await db.query('SELECT * FROM landing_pages WHERE slug=$1 AND status=$2', [publicLandingMatch[1], 'published']);
    const landing = rows[0];
    if (!landing) return json({ error: 'Not found' }, 404);
    const product = landing.product_id ? (await db.query('SELECT * FROM products WHERE id=$1', [landing.product_id])).rows[0] : null;
    const upsells = landing.upsell_product_ids?.length ? (await db.query('SELECT * FROM products WHERE id = ANY($1::uuid[]) AND active=true', [landing.upsell_product_ids])).rows : [];
    const productData = product ? { ...product, price: Math.round(product.price_kopecks/100), image_url: product.image_id ? new URL('/media/'+product.image_id,url).toString() : null } : null;
    const upsellData = upsells.map(p => ({ ...p, price:Math.round(p.price_kopecks/100), image_url:p.image_id ? new URL('/media/'+p.image_id,url).toString() : null }));
    return json({ landing:{...landing, hero_image_url:landing.hero_image_id ? new URL('/media/'+landing.hero_image_id,url).toString() : null}, product:productData, upsells:upsellData });
  }

  if (url.pathname === '/api/public/telegram/webhook' && request.method === 'POST') {
    const update:any=await request.json().catch(()=>({}));const message=update?.message;const text=String(message?.text||'');const match=text.match(/^\/start\s+login_([A-Za-z0-9_-]{20,})/);
    if(match&&message?.from){const nonce=match[1];const row=(await db.query('SELECT * FROM telegram_login_requests WHERE nonce_hash=$1 AND customer_id IS NULL AND expires_at>now()',[tokenHash(nonce)])).rows[0];if(row){const customer=await upsertTelegramCustomer(message.from);await db.query('UPDATE telegram_login_requests SET customer_id=$1 WHERE id=$2',[customer.id,row.id]);const botToken=process.env.TELEGRAM_BOT_TOKEN||'';if(botToken)fetch('https://api.telegram.org/bot'+botToken+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:message.chat.id,text:'✅ Вхід до HERBIO підтверджено. Натисніть кнопку нижче — кабінет відкриється вже авторизованим.',reply_markup:{inline_keyboard:[[{text:'Відкрити кабінет HERBIO',url:'https://herbio.store/account?tg_login='+encodeURIComponent(nonce)}]]}})}).catch(()=>{});}}
    return json({ok:true});
  }
  if (url.pathname === '/api/public/auth/telegram/start' && request.method === 'POST') {
    const botToken=process.env.TELEGRAM_BOT_TOKEN||'';if(!botToken)return json({error:'Telegram-бот ще не підключений'},503);
    const nonce=crypto.randomBytes(24).toString('base64url');await db.query('INSERT INTO telegram_login_requests(nonce_hash,expires_at) VALUES($1,now()+interval \'10 minutes\')',[tokenHash(nonce)]);
    let username='herbioshop_bot';try{const d:any=await (await fetch('https://api.telegram.org/bot'+botToken+'/getMe',{signal:AbortSignal.timeout(3000)})).json();username=d?.result?.username||username}catch{}
    return json({url:'https://t.me/'+username+'?start=login_'+nonce,expiresIn:600});
  }
  if (url.pathname === '/api/public/auth/telegram/status' && request.method === 'GET') {
    const nonce=String(url.searchParams.get('nonce')||'');if(!nonce)return json({error:'Відсутній код входу'},400);
    const row=(await db.query('SELECT * FROM telegram_login_requests WHERE nonce_hash=$1 AND expires_at>now()',[tokenHash(nonce)])).rows[0];if(!row)return json({error:'Вхід прострочено. Спробуйте ще раз.'},400);if(!row.customer_id)return json({pending:true});
    if(row.consumed_at)return json({error:'Цей вхід вже використано'},400);await db.query('UPDATE telegram_login_requests SET consumed_at=now() WHERE id=$1',[row.id]);const token=await createCustomerSession(row.customer_id);return json({pending:false,token,customer:await customerSummary(row.customer_id)});
  }
  if (url.pathname === '/api/public/auth/settings' && request.method === 'GET') { let telegramBotUsername=''; const botToken=process.env.TELEGRAM_BOT_TOKEN; if(botToken){try{const r=await fetch('https://api.telegram.org/bot'+botToken+'/getMe',{signal:AbortSignal.timeout(3000)});const d:any=await r.json();telegramBotUsername=d?.result?.username||''}catch{}} return json({ telegramBotUsername, emailLoginEnabled: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) }); }
  if (url.pathname === '/api/public/auth/email/start' && request.method === 'POST') {
    const b:any=await request.json().catch(()=>({})); const email=String(b.email||'').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:'Вкажіть коректний email'},400);
    if(!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return json({error:'Email-вхід ще не налаштований. Скористайтеся Telegram.'},503);
    const codeBytes=new Uint32Array(1);crypto.getRandomValues(codeBytes);const code=String(100000+(codeBytes[0]%900000));
    await db.query('UPDATE email_login_codes SET consumed_at=now() WHERE lower(email)=lower($1) AND consumed_at IS NULL',[email]);
    await db.query('INSERT INTO email_login_codes(email,code_hash,expires_at) VALUES($1,$2,now()+interval \'10 minutes\')',[email,tokenHash(code)]);
    const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+process.env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[email],subject:'Код входу HERBIO',html:'<p>Ваш код входу до HERBIO: <strong style="font-size:24px;letter-spacing:4px">'+code+'</strong></p><p>Код дійсний 10 хвилин.</p>'})});
    if(!sent.ok) return json({error:'Не вдалося надіслати код. Спробуйте Telegram-вхід.'},502);
    return json({ok:true});
  }
  if (url.pathname === '/api/public/auth/email/verify' && request.method === 'POST') {
    const b:any=await request.json().catch(()=>({}));const email=String(b.email||'').trim().toLowerCase(),code=String(b.code||'').trim();
    const row=(await db.query('SELECT * FROM email_login_codes WHERE lower(email)=lower($1) AND code_hash=$2 AND consumed_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1',[email,tokenHash(code)])).rows[0];
    if(!row)return json({error:'Код недійсний або прострочений'},400);
    await db.query('UPDATE email_login_codes SET consumed_at=now() WHERE id=$1',[row.id]);
    let customer=(await db.query('SELECT * FROM customers WHERE lower(email)=lower($1)',[email])).rows[0];
    if(!customer) customer=(await db.query('INSERT INTO customers(email,email_verified_at,updated_at) VALUES($1,now(),now()) RETURNING *',[email])).rows[0];
    else customer=(await db.query('UPDATE customers SET email_verified_at=now(),updated_at=now() WHERE id=$1 RETURNING *',[customer.id])).rows[0];
    const token=await createCustomerSession(customer.id);return json({token,customer:await customerSummary(customer.id)});
  }
  if (url.pathname === '/api/public/auth/telegram' && request.method === 'POST') {
    const b:any=await request.json().catch(()=>({}));const user=b.initData?telegramFromMiniApp(String(b.initData)):telegramFromWidget(b.user||b);
    if(!user)return json({error:'Не вдалося підтвердити Telegram-вхід'},401);
    const customer=await upsertTelegramCustomer(user);if(!customer)return json({error:'Не вдалося створити профіль'},400);
    const token=await createCustomerSession(customer.id);return json({token,customer:await customerSummary(customer.id)});
  }
  if (url.pathname === '/api/public/auth/me' && request.method === 'GET') {
    const customer=await currentCustomer(request);if(!customer)return json({error:'Unauthorized'},401);return json(await customerSummary(customer.id));
  }
  if (url.pathname === '/api/public/auth/logout' && request.method === 'POST') {
    const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();if(token)await db.query('DELETE FROM auth_sessions WHERE token_hash=$1',[tokenHash(token)]);return json({ok:true});
  }
  if (url.pathname === '/api/public/account/orders' && request.method === 'GET') {
    const customer=await currentCustomer(request);if(!customer)return json({error:'Unauthorized'},401);
    const {rows}=await db.query("SELECT o.public_id,o.status,o.total_kopecks,o.currency,o.created_at,COALESCE(json_agg(json_build_object('name',p.name,'quantity',oi.quantity,'price',oi.unit_price_kopecks)) FILTER (WHERE p.id IS NOT NULL),'[]') AS items FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id LEFT JOIN products p ON p.id=oi.product_id WHERE o.customer_id=$1 GROUP BY o.id ORDER BY o.created_at DESC",[customer.id]);
    return json(rows.map(o=>({...o,total:Math.round(o.total_kopecks/100)})));
  }
  if (url.pathname === '/api/public/orders' && request.method === 'POST') {
    const b:any=await request.json().catch(()=>({}));const quantities=new Map<string,number>();for(const item of (b.items||[])){const id=String(item?.productId||'');const qty=Math.max(1,Math.min(99,Number(item?.quantity)||1));if(id)quantities.set(id,(quantities.get(id)||0)+qty)}const productIds=Array.from(quantities.keys());
    if(!productIds.length)return json({error:'Кошик порожній'},400);
    const {rows:products}=await db.query('SELECT id,name,price_kopecks FROM products WHERE id=ANY($1::uuid[]) AND active=true',[productIds]);
    if(products.length!==productIds.length)return json({error:'Один із товарів недоступний'},400);
    let customer=await currentCustomer(request);const c=b.customer||{};
    if(customer) customer=(await db.query('UPDATE customers SET name=COALESCE(NULLIF($1,\'\'),name),phone=COALESCE(NULLIF($2,\'\'),phone),updated_at=now() WHERE id=$3 RETURNING *',[String(c.fullName||''),String(c.phone||''),customer.id])).rows[0];
    else customer=(await db.query('INSERT INTO customers(name,phone,updated_at) VALUES($1,$2,now()) RETURNING *',[String(c.fullName||''),String(c.phone||'')])).rows[0];
    const total=products.reduce((sum,p)=>sum+Number(p.price_kopecks)*(quantities.get(p.id)||1),0);const profile=await customerSummary(customer.id);const publicId='HB-'+crypto.randomUUID().slice(0,8).toUpperCase();
    const order=(await db.query("INSERT INTO orders(public_id,customer_id,source,total_kopecks,meta_event_id,full_name,phone,nova_poshta_branch,loyalty_rate) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,public_id",[publicId,customer.id,b.telegramInitData?'telegram':'web',total,crypto.randomUUID(),String(c.fullName||''),String(c.phone||''),String(c.novaPoshtaBranch||''),profile?.loyaltyRate||0])).rows[0];
    for(const p of products) await db.query('INSERT INTO order_items(order_id,product_id,quantity,unit_price_kopecks) VALUES($1,$2,$3,$4)',[order.id,p.id,quantities.get(p.id)||1,p.price_kopecks]);
    return json({orderId:order.public_id,loyaltyRate:profile?.loyaltyRate||0},201);
  }
  if (url.pathname === '/') return Response.redirect(new URL('/admin', url), 302);
  if (url.pathname === '/admin') {
    if (!requireAdmin(request)) return new Response('Authentication required', { status: 401, headers: { 'www-authenticate': 'Basic realm="HERBIO Admin"' } });
    return new Response(adminPage, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  if (url.pathname.startsWith('/api/admin/')) {
    if (!requireAdmin(request)) return json({ error: 'Unauthorized' }, 401);
    if (url.pathname === '/api/admin/media' && request.method === 'POST') {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File) || !file.size) return json({ error: 'Оберіть файл зображення' }, 400);
      if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return json({ error: 'Підтримуються JPG, PNG або WEBP' }, 400);
      if (file.size > 8 * 1024 * 1024) return json({ error: 'Максимальний розмір — 8 МБ' }, 400);
      const bytes = Buffer.from(await file.arrayBuffer());
      const { rows } = await db.query('INSERT INTO media_assets(filename,content_type,bytes,alt_text) VALUES($1,$2,$3,$4) RETURNING id', [file.name, file.type, bytes, String(form.get('alt') || '')]);
      return json({ id: rows[0].id, url: new URL('/media/' + rows[0].id, url).toString() }, 201);
    }
    if (url.pathname === '/api/admin/products' && request.method === 'GET') return json((await db.query('SELECT * FROM products ORDER BY updated_at DESC')).rows);
    if (url.pathname === '/api/admin/products' && request.method === 'POST') return json(await createProduct(await request.json()), 201);
    const productMatch = url.pathname.match(/^\/api\/admin\/products\/([0-9a-f-]+)$/);
    if (productMatch && request.method === 'PATCH') {
      const b:any = await request.json();
      const { rows } = await db.query('UPDATE products SET name=COALESCE($1,name), category=COALESCE($2,category), short_description=COALESCE($3,short_description), description=COALESCE($4,description), format=COALESCE($5,format), note=COALESCE($6,note), price_kopecks=COALESCE($7,price_kopecks), active=COALESCE($8,active), image_id=COALESCE($9,image_id), is_hot=COALESCE($10,is_hot), updated_at=now() WHERE id=$11 RETURNING *', [b.name ?? null, b.category ?? null, b.shortDescription ?? null, b.description ?? null, b.format ?? null, b.note ?? null, b.price === undefined ? null : Math.round(Number(b.price) * 100), typeof b.active === 'boolean' ? b.active : null, b.imageId ?? null, typeof b.isHot === 'boolean' ? b.isHot : null, productMatch[1]]);
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
    if (url.pathname === '/api/admin/pages' && request.method === 'GET') return json((await db.query('SELECT * FROM content_pages ORDER BY page_key')).rows);
    const pageMatch = url.pathname.match(/^\/api\/admin\/pages\/([a-z-]+)$/);
    if (pageMatch && request.method === 'PATCH') {
      const b:any=await request.json();
      const { rows }=await db.query('UPDATE content_pages SET title=COALESCE($1,title), content=COALESCE($2,content), updated_at=now() WHERE page_key=$3 RETURNING *',[b.title??null,b.content??null,pageMatch[1]]);
      if(!rows[0]) return json({ error:'Сторінку не знайдено' },404);
      return json(rows[0]);
    }
    const landingMatch=url.pathname.match(/^\/api\/admin\/landings\/([0-9a-f-]+)$/);
    if(landingMatch && request.method==='PATCH'){
      const b:any=await request.json();
      const {rows}=await db.query('UPDATE landing_pages SET slug=COALESCE($1,slug), product_id=$2, title=COALESCE($3,title), meta_title=COALESCE($4,meta_title), meta_description=COALESCE($5,meta_description), hero_title=COALESCE($6,hero_title), hero_text=COALESCE($7,hero_text), cta_label=COALESCE($8,cta_label), status=COALESCE($9,status), hero_image_id=COALESCE($10,hero_image_id), catalog_cta_label=COALESCE($11,catalog_cta_label), benefit_1_title=COALESCE($12,benefit_1_title), benefit_1_text=COALESCE($13,benefit_1_text), benefit_2_title=COALESCE($14,benefit_2_title), benefit_2_text=COALESCE($15,benefit_2_text), benefit_3_title=COALESCE($16,benefit_3_title), benefit_3_text=COALESCE($17,benefit_3_text), upsell_product_ids=COALESCE($18,upsell_product_ids), published_at=CASE WHEN COALESCE($9,status)=\'published\' THEN COALESCE(published_at,now()) ELSE published_at END, updated_at=now() WHERE id=$19 RETURNING *',[b.slug??null,b.productId||null,b.title??null,b.metaTitle??null,b.metaDescription??null,b.heroTitle??null,b.heroText??null,b.ctaLabel??null,b.status??null,b.heroImageId??null,b.catalogCtaLabel??null,b.benefit1Title??null,b.benefit1Text??null,b.benefit2Title??null,b.benefit2Text??null,b.benefit3Title??null,b.benefit3Text??null,Array.isArray(b.upsellProductIds)?b.upsellProductIds.filter(id=>id!==b.productId):null,landingMatch[1]]);
      if(!rows[0])return json({error:'Лендинг не знайдено'},404);return json(rows[0]);
    }
    if (url.pathname === '/api/admin/landings' && request.method === 'GET') return json((await db.query('SELECT l.*, p.name AS product_name FROM landing_pages l LEFT JOIN products p ON p.id=l.product_id ORDER BY l.updated_at DESC')).rows);
    if (url.pathname === '/api/admin/landings' && request.method === 'POST') { const b:any=await request.json(); const { rows }=await db.query('INSERT INTO landing_pages(slug,product_id,title,meta_title,meta_description,hero_title,hero_text,cta_label,hero_image_id,catalog_cta_label,benefit_1_title,benefit_1_text,benefit_2_title,benefit_2_text,benefit_3_title,benefit_3_text,upsell_product_ids) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *',[b.slug,b.productId||null,b.title,b.metaTitle||b.title,b.metaDescription||'',b.heroTitle||b.title,b.heroText||'',b.ctaLabel||'Купити',b.heroImageId||null,b.catalogCtaLabel||'Переглянути каталог',b.benefit1Title||'',b.benefit1Text||'',b.benefit2Title||'',b.benefit2Text||'',b.benefit3Title||'',b.benefit3Text||'',Array.isArray(b.upsellProductIds)?b.upsellProductIds.filter(id=>id!==b.productId):[]]); return json(rows[0],201); }
    return json({ error: 'Not found' }, 404);
  }
  if (url.pathname.startsWith('/l/')) return Response.redirect('https://herbio.store' + url.pathname, 302);
  return json({ error: 'Not found' }, 404);
}});
