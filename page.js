// 사건 기록 글 한 편을 검색엔진이 읽을 수 있는 페이지로 보내줍니다.
// 주소: /cases/글번호  (vercel.json 에서 이 함수로 연결)
// 화면은 기존 사이트(index.html)를 그대로 쓰고, 제목·설명·본문을 HTML 안에 미리 넣어 줍니다.
import { T, db, supabaseReady } from './_lib.js';

const SITE_NAME = '에어컨탐정';
const CAT = { clean: '분해청소', repair: '수리', install: '설치' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const cut = (s, n) => { s = oneLine(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

let shellCache = { at: 0, html: '' };
async function shell(origin) {
  if (shellCache.html && Date.now() - shellCache.at < 60_000) return shellCache.html;
  const r = await fetch(`${origin}/index.html`, { headers: { 'x-ssr': '1' } });
  if (!r.ok) throw new Error('index.html ' + r.status);
  shellCache = { at: Date.now(), html: await r.text() };
  return shellCache.html;
}

function setMeta(html, attr, key, value) {
  const re = new RegExp(`<meta ${attr}="${key}"[^>]*>`);
  const tag = `<meta ${attr}="${key}" content="${esc(value)}">`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `${tag}\n</head>`);
}

function articleHtml(p) {
  const body = (p.blocks || []).map((b) => {
    if (b.t === 'p') return oneLine(b.text) ? `<p>${esc(b.text).replace(/\n/g, '<br>')}</p>` : '';
    if (b.t === 'h') return `<h2>${esc(b.text)}</h2>`;
    if (b.t === 'quote') return `<blockquote>${esc(b.text).replace(/\n/g, '<br>')}</blockquote>`;
    if (b.t === 'img' && b.img) return `<figure><img src="${esc(b.img)}" alt="${esc(cut(b.caption || p.title, 120))}" loading="lazy" width="800">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`;
    return '';
  }).join('\n');
  return `<article id="ssrPost" style="max-width:760px;margin:0 auto;padding:24px 16px;font:17px/1.9 system-ui,sans-serif">
<nav><a href="/">${SITE_NAME}</a> › <a href="/#cases">사건 기록</a> › ${esc(CAT[p.cat] || '사건 기록')}</nav>
<h1>${esc(p.title)}</h1>
${p.cover ? `<img src="${esc(p.cover)}" alt="${esc(p.title)}" width="800" style="max-width:100%;height:auto">` : ''}
${body}
<p>${SITE_NAME} · 대전·세종·충청권 에어컨 분해청소·수리·설치 · 문의 <a href="tel:01047483142">010-4748-3142</a></p>
</article>`;
}

export default async function handler(req, res) {
  const id = String(req.query?.id || '').trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const proto = String(req.headers['x-forwarded-proto'] || (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https')).split(',')[0];
  const origin = `${proto}://${host}`;
  let html;
  try { html = await shell(origin); } catch (err) { console.error(err); res.statusCode = 302; res.setHeader('Location', '/#cases'); return res.end(); }

  let post = null;
  if (/^[A-Za-z0-9_-]{1,64}$/.test(id) && supabaseReady()) {
    try { post = (await db('GET', T.posts, { query: `select=*&id=eq.${encodeURIComponent(id)}&limit=1` }))?.[0] || null; }
    catch (err) { console.error('page load failed', err); }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!post) {
    res.statusCode = 404;
    res.setHeader('Cache-Control', 'no-store');
    return res.end(html.replace('<head>', '<head>\n<base href="/">\n<meta name="robots" content="noindex">'));
  }

  const url = `${origin}/cases/${post.id}`;
  const firstText = (post.blocks || []).find((b) => b.t === 'p' && oneLine(b.text))?.text || '';
  const desc = cut(post.excerpt || firstText || post.title, 155);
  const image = post.cover || (post.blocks || []).find((b) => b.t === 'img')?.img || `${origin}/img/hero-jail.jpg`;
  const title = `${post.title} | ${SITE_NAME}`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: cut(post.title, 110), description: desc, image: [image],
    datePublished: post.created_at, dateModified: post.updated_at || post.created_at, mainEntityOfPage: url,
    author: { '@type': 'Organization', name: SITE_NAME, url: origin + '/' },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: origin + '/' },
  };

  html = html.replace('<head>', '<head>\n<base href="/">');
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = setMeta(html, 'name', 'description', desc);
  html = setMeta(html, 'property', 'og:type', 'article');
  html = setMeta(html, 'property', 'og:title', title);
  html = setMeta(html, 'property', 'og:description', desc);
  html = setMeta(html, 'property', 'og:url', url);
  html = setMeta(html, 'property', 'og:image', image);
  html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}">`);
  html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n</head>`);
  html = html.replace(/<body([^>]*)>/, (m) => `${m}\n${articleHtml(post)}`);

  res.statusCode = 200;
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  return res.end(html);
}
