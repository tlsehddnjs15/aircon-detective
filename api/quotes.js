// 견적 문의 관리 (관리자 전용): 목록(GET) · 상태 변경(PATCH) · 삭제(DELETE)
import { QUOTE_STATUS, T, db, guard, queryParam, readBody, send } from './_lib.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const toClient = (r) => ({
  id: r.id, name: r.name, phone: r.phone, service: r.service, memo: r.memo,
  area: r.area, aircon: r.aircon, photos: Array.isArray(r.photos) ? r.photos : [], status: r.status, smsSent: r.sms_sent, createdAt: r.created_at,
});

export default async function handler(req, res) {
  if (!guard(req, res, { admin: true })) return;
  try {
    if (req.method === 'GET') {
      const rows = await db('GET', T.quotes, { query: 'select=*&order=created_at.desc&limit=1000' });
      return send(res, 200, { ok: true, quotes: (rows || []).map(toClient) });
    }

    const id = queryParam(req, 'id');
    if (!UUID.test(id)) return send(res, 400, { ok: false, error: 'bad_id' });

    if (req.method === 'PATCH') {
      const { status } = readBody(req);
      if (!QUOTE_STATUS.includes(status)) return send(res, 400, { ok: false, error: 'bad_status' });
      await db('PATCH', T.quotes, { query: `id=eq.${id}`, body: { status } });
      return send(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      await db('DELETE', T.quotes, { query: `id=eq.${id}` });
      return send(res, 200, { ok: true });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  } catch (err) {
    console.error('quotes', err);
    return send(res, 500, { ok: false, error: 'server_error' });
  }
}
