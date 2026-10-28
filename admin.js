// 관리자 로그인 확인(GET) · 로그인(POST) · 로그아웃(DELETE)
import { adminCookie, checkPassword, isAdmin, readBody, sameOrigin, send } from './_lib.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return send(res, 200, { ok: true, admin: isAdmin(req) });
  if (!sameOrigin(req)) return send(res, 403, { ok: false, error: 'bad_origin' });

  if (req.method === 'POST') {
    if (!process.env.ADMIN_PASSWORD) return send(res, 500, { ok: false, error: 'not_configured' });
    const { password } = readBody(req);
    if (!checkPassword(password)) {
      await new Promise((r) => setTimeout(r, 800)); // 비밀번호 맞히기 시도를 느리게
      return send(res, 401, { ok: false, error: 'wrong_password' });
    }
    adminCookie(res, true);
    return send(res, 200, { ok: true, admin: true });
  }

  if (req.method === 'DELETE') {
    adminCookie(res, false);
    return send(res, 200, { ok: true, admin: false });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return send(res, 405, { ok: false, error: 'method_not_allowed' });
}
