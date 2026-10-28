// 사건 기록 글 목록 사이트맵: /sitemap-cases.xml (vercel.json 에서 연결)
// 새 글을 쓰면 자동으로 들어갑니다. 네이버 서치어드바이저에 이 주소를 한 번 제출하세요.
import { T, db, supabaseReady } from './_lib.js';

export default async function handler(req, res) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const proto = String(req.headers['x-forwarded-proto'] || (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https')).split(',')[0];
  const origin = `${proto}://${host}`;
  let rows = [];
  if (supabaseReady()) {
    try { rows = (await db('GET', T.posts, { query: 'select=id,updated_at,created_at&order=created_at.desc&limit=1000' })) || []; }
    catch (err) { console.error('sitemap failed', err); }
  }
  const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
  const urls = [`  <url><loc>${origin}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`]
    .concat(rows.map((r) => `  <url><loc>${origin}/cases/${encodeURIComponent(r.id)}</loc>${r.updated_at || r.created_at ? `<lastmod>${day(r.updated_at || r.created_at)}</lastmod>` : ''}<changefreq>monthly</changefreq><priority>0.8</priority></url>`));
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400');
  res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
}
