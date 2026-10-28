// 사건 기록 글: 목록(GET, 누구나) · 저장(POST, 관리자) · 삭제(DELETE, 관리자)
import crypto from 'node:crypto';
import { SERVICE_IDS, T, clean, db, guard, queryParam, readBody, removeObjects, send, storagePathOf } from './_lib.js';

const toClient = (r) => ({
  id: r.id, title: r.title, cat: r.cat, excerpt: r.excerpt, cover: r.cover,
  blocks: Array.isArray(r.blocks) ? r.blocks : [], createdAt: r.created_at, updatedAt: r.updated_at,
});
const imagesOf = (p) => [p.cover, ...(p.blocks || []).filter((b) => b.t === 'img').map((b) => b.img)];

function validate(body) {
  const title = clean(body.title, 120);
  if (!title) return { error: 'title_required' };
  const cat = SERVICE_IDS.includes(body.cat) ? body.cat : 'clean';
  const cover = storagePathOf(body.cover) ? body.cover : '';
  const blocks = (Array.isArray(body.blocks) ? body.blocks : []).slice(0, 100).map((b) => {
    if (!b || typeof b !== 'object') return null;
    if (b.t === 'img') return storagePathOf(b.img) ? { t: 'img', img: b.img, caption: clean(b.caption, 1000) } : null;
    if (['p', 'h', 'quote'].includes(b.t)) {
      const text = b.t === 'h' ? clean(b.text, 120) : String(b.text ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, 5000);
      return text ? { t: b.t, text } : null;
    }
    return null;
  }).filter(Boolean);
  return { row: { title, cat, excerpt: clean(body.excerpt, 300), cover, blocks } };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      if (!guard(req, res)) return;
      const rows = await db('GET', T.posts, { query: 'select=*&order=created_at.desc&limit=500' });
      return send(res, 200, { ok: true, posts: (rows || []).map(toClient) });
    }

    if (req.method === 'POST') {
      if (!guard(req, res, { admin: true })) return;
      const body = readBody(req);
      const { row, error } = validate(body);
      if (error) return send(res, 400, { ok: false, error });
      const id = typeof body.id === 'string' && /^[a-z0-9]{6,40}$/.test(body.id) ? body.id : null;

      if (id) {
        const old = await db('GET', T.posts, { query: `select=cover,blocks&id=eq.${id}` });
        if (!old?.length) return send(res, 404, { ok: false, error: 'not_found' });
        await db('PATCH', T.posts, { query: `id=eq.${id}`, body: { ...row, updated_at: new Date().toISOString() } });
        const keep = new Set(imagesOf(row));
        await removeObjects(imagesOf(old[0]).filter((u) => !keep.has(u)).map(storagePathOf));
        return send(res, 200, { ok: true, id });
      }

      const newId = 'p' + crypto.randomBytes(6).toString('hex');
      await db('POST', T.posts, { body: { id: newId, ...row }, prefer: 'return=minimal' });
      return send(res, 200, { ok: true, id: newId });
    }

    if (req.method === 'DELETE') {
      if (!guard(req, res, { admin: true })) return;
      const id = queryParam(req, 'id');
      if (!/^[a-z0-9]{6,40}$/.test(id)) return send(res, 400, { ok: false, error: 'bad_id' });
      const old = await db('DELETE', T.posts, { query: `id=eq.${id}`, prefer: 'return=representation' });
      if (old?.[0]) await removeObjects(imagesOf(old[0]).map(storagePathOf));
      return send(res, 200, { ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  } catch (err) {
    console.error('posts', err);
    return send(res, 500, { ok: false, error: 'server_error' });
  }
}
