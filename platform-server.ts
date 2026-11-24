import crypto from 'node:crypto';
import { Pool } from 'pg';

const port = Number(process.env.PORT || 3000);
const db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
const adminPassword = process.env.ADMIN_PASSWORD;

const html = (title: string, body: string) => `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | HERBIO</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Manrope:wght@500;600;700&display=swap" rel="stylesheet"><style>:root{--f:#1f4d36;--i:#163327;--c:#f7f5ed;--s:#e6efe1;--l:#d2dfcd}*{box-sizing:border-box}body{margin:0;background:var(--c);color:var(--i);font:16px 'DM Sans',sans-serif}.bar{background:var(--f);color:#fff;padding:15px 5vw;letter-spacing:.08em;text-align:center}.admin{max-width:1180px;margin:0 auto;padding:48px 28px}.brand{font:600 28px Manrope;letter-spacing:.14em}.eyebrow{letter-spacing:.18em;font-size:12px;font-weight:700;color:#527664}.hero{padding:48px 0 35px;border-bottom:1px solid var(--l)}h1{font:600 clamp(36px,5vw,66px)/1.05 Manrope;margin:12px 0}p{line-height:1.6}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:32px 0}.card{background:#fffefa;border:1px solid var(--l);padding:24px;min-height:170px}.card h2{font:600 20px Manrope;margin:10px 0}.button{display:inline-block;background:var(--f);color:white;border:0;padding:12px 17px;font:600 14px 'DM Sans';text-decoration:none;cursor:pointer}.muted{color:#587062}input,textarea,select{width:100%;margin:5px 0 13px;padding:11px;border:1px solid var(--l);background:#fffefa;font:inherit}.panel{margin-top:30px;padding:25px;background:#fffefa;border:1px solid var(--l)}@media(max-width:700px){.grid{grid-template-columns:1fr}.admin{padding:28px 18px}}</style></head><body>${body}</body></html>`;

const adminPage = html('Адмінка', `<div class="bar">HERBIO · КЕРУВАННЯ МАГАЗИНОМ</div><main class="admin"><div class="brand">HERBIO</div><section class="hero"><p class="eyebrow">АДМІН-ПЛАТФОРМА</p><h1>Товари, лендинги та реклама — в одному місці.</h1><p class="muted">Створюйте сторінки для реклами, оновлюйте ціни та керуйте Meta Pixel на рівні кожного лендингу.</p></section><section class="grid"><article class="card"><p class="eyebrow">01</p><h2>Товари</h2><p>Ціни, категорії, фото й наявність.</p><button class="button" data-open="product">Додати товар</button></article><article class="card"><p class="eyebrow">02</p><h2>Лендинги</h2><p>Окрема сторінка для кожної рекламної кампанії.</p><button class="button" data-open="landing">Створити лендинг</button></article><article class="card"><p class="eyebrow">03</p><h2>Meta-аналітика</h2><p>Окремий Pixel і CAPI для кожного лендингу.</p><button class="button" data-open="meta">Підключити Pixel</button></article></section><section class="panel" id="panel"><p class="muted">Оберіть дію вище. Дані зберігатимуться в єдиній базі HERBIO.</p></section></main><script>const p=document.querySelector('#panel');document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{const type=b.dataset.open;const forms={product:'<p class="eyebrow">НОВИЙ ТОВАР</p><h2>Додати товар</h2><input placeholder="Назва"><input placeholder="Категорія"><input type="number" placeholder="Ціна, ₴"><textarea placeholder="Опис"></textarea><button class="button">Зберегти</button>',landing:'<p class="eyebrow">НОВИЙ ЛЕНДИНГ</p><h2>Створити рекламну сторінку</h2><input placeholder="URL, наприклад spirulina"><input placeholder="Заголовок"><textarea placeholder="Опис та офер"></textarea><button class="button">Створити чернетку</button>',meta:'<p class="eyebrow">META</p><h2>Підключити Pixel</h2><input placeholder="Pixel ID"><input type="password" placeholder="Conversions API token"><button class="button">Зберегти безпечно</button>'};p.innerHTML=forms[type]})</script></body></html>`);

const requireAdmin = (request: Request) => {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return Boolean(adminPassword && token && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(adminPassword)));
};
const json = (data: unknown, status = 200) => Response.json(data, { status });

async function createProduct(body: any) {
  const slug = String(body.slug || body.name || '').toLowerCase().trim().replace(/[^a-z0-9а-яіїєґ]+/gi, '-').replace(/^-|-$/g, '');
  const { rows } = await db.query('INSERT INTO products(slug,name,category,short_description,description,format,note,price_kopecks) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [slug, body.name, body.category, body.shortDescription || '', body.description || '', body.format || '', body.note || '', Math.round(Number(body.price || 0) * 100)]);
  return rows[0];
}

Bun.serve({ port, async fetch(request) {
  const url = new URL(request.url);
  if (url.pathname === '/health') return new Response('ok');
  if (url.pathname === '/admin') return new Response(adminPage, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  if (url.pathname.startsWith('/api/admin/')) {
    if (!requireAdmin(request)) return json({ error: 'Unauthorized' }, 401);
    if (url.pathname === '/api/admin/products' && request.method === 'GET') return json((await db.query('SELECT * FROM products ORDER BY updated_at DESC')).rows);
    if (url.pathname === '/api/admin/products' && request.method === 'POST') return json(await createProduct(await request.json()), 201);
    if (url.pathname === '/api/admin/landings' && request.method === 'GET') return json((await db.query('SELECT l.*, p.name AS product_name FROM landing_pages l LEFT JOIN products p ON p.id=l.product_id ORDER BY l.updated_at DESC')).rows);
    if (url.pathname === '/api/admin/landings' && request.method === 'POST') { const b:any=await request.json(); const { rows }=await db.query('INSERT INTO landing_pages(slug,product_id,title,meta_title,meta_description,hero_title,hero_text,cta_label) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[b.slug,b.productId||null,b.title,b.metaTitle||b.title,b.metaDescription||'',b.heroTitle||b.title,b.heroText||'',b.ctaLabel||'Купити']); return json(rows[0],201); }
    return json({ error: 'Not found' }, 404);
  }
  return json({ error: 'Not found' }, 404);
}});
